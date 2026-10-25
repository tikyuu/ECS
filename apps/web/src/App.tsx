import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDown, ArrowUpRight, Check, CheckCheck, ChevronDown, Circle, CircleCheck, Clock3, Columns3, Flag, LayoutGrid, List, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { priorityLabels, statusLabels, taskRepository, today } from './tasks';
import type { Priority, Status, Task, TaskInput } from './tasks';

type Scope = 'all' | 'today' | 'done';
type Notice = { message: string; undo?: { taskId: string; previousStatus: Status; nextStatus: Status } };
const statuses: Status[] = ['todo', 'in_progress', 'done'];
const emptyTask: TaskInput = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '' };
const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '期限なし';

function StatusIcon({ status }: { status: Status }) {
  return status === 'done' ? <CircleCheck size={17} /> : status === 'in_progress' ? <Clock3 size={17} /> : <Circle size={17} />;
}

function TaskEditor({ task, onClose, onSave, onDelete }: { task: Task | null; onClose: () => void; onSave: (input: TaskInput) => boolean; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<TaskInput>(task ? { ...task } : { ...emptyTask });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) { setSaveError('タイトルを入力してください。'); return; }
    if (onSave({ ...form, title: form.title.trim(), description: form.description.trim() })) onClose();
    else setSaveError('保存できませんでした。ブラウザの空き容量やストレージ設定をご確認ください。');
  };
  return <dialog ref={dialog} className="editor" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit}>
      <div className="dialog-heading"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>{task ? 'タスクを編集' : '新しいタスク'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="閉じる"><X size={20} /></button></div>
      <label>タイトル<span className="required"> *</span><input autoFocus required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="やることを入力してください" /></label>
      <label>説明<textarea rows={4} maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="詳細やメモを追加…" /></label>
      <div className="form-grid"><label>ステータス<select aria-label="ステータス" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><label>優先度<select aria-label="優先度" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>{(['high', 'medium', 'low'] as Priority[]).map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select></label></div>
      <label>期限<input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
      {saveError && <div className="error-banner" role="alert">{saveError}</div>}
      {confirmDelete && <div className="delete-confirm"><p>このタスクを削除しますか？ 元に戻せません。</p><button type="button" className="danger-button" onClick={onDelete}>削除する</button><button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>戻る</button></div>}
      <div className="dialog-footer">{task && <button type="button" className="delete-button" onClick={() => setConfirmDelete(true)} aria-label="タスクを削除"><Trash2 size={17} /></button>}<div className="footer-actions"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" type="submit">{task ? '変更を保存' : 'タスクを作成'}</button></div></div>
    </form>
  </dialog>;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('due');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [editor, setEditor] = useState<Task | 'new' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const load = () => { try { setTasks(taskRepository.list()); setError(''); setLoaded(true); } catch { setLoaded(false); setError('保存データを読み込めませんでした。ブラウザのストレージ設定をご確認ください。'); } };
  useEffect(() => { load(); const sync = (event: StorageEvent) => { if (event.key === 'taskflow.tasks.v1' || event.key === null) load(); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 6000); return () => clearTimeout(timer); }, [notice]);
  function persist(next: Task[], message: string, undo?: Notice['undo']) {
    try { taskRepository.save(next); setTasks(next); setError(''); setNotice({ message, undo }); return true; }
    catch { setError('変更を保存できませんでした。ブラウザの空き容量やストレージ設定をご確認ください。'); return false; }
  }
  const completed = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const todayTasks = tasks.filter(t => t.dueDate === today() && t.status !== 'done').length;
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today() && t.status !== 'done').length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const visible = useMemo(() => tasks.filter(t =>
    (scope === 'done' ? t.status === 'done' : t.status !== 'done')
    && (scope !== 'today' || t.dueDate === today())
    && (status === 'all' || t.status === status) && (priority === 'all' || t.priority === priority)
    && `${t.title} ${t.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  ).sort((a, b) => sort === 'priority' ? ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) : sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [tasks, scope, status, priority, search, sort]);
  const changeStatus = (task: Task, next: Status) => persist(
    tasks.map(t => t.id === task.id ? { ...t, status: next } : t),
    `「${task.title}」を${statusLabels[next]}にしました`,
    { taskId: task.id, previousStatus: task.status, nextStatus: next },
  );
  const undoStatus = () => {
    const undo = notice?.undo;
    if (!undo) return;
    const task = tasks.find(t => t.id === undo.taskId);
    if (!task || task.status !== undo.nextStatus) { setNotice(null); return; }
    persist(tasks.map(t => t.id === undo.taskId ? { ...t, status: undo.previousStatus } : t), 'ステータスの変更を元に戻しました');
  };
  const visibleStatuses = statuses.filter(s => scope === 'done' ? s === 'done' : s !== 'done');
  const resetFilters = () => { setSearch(''); setStatus('all'); setPriority('all'); };
  const title = scope === 'today' ? '今日のタスク' : scope === 'done' ? '完了したタスク' : '未完了のタスク';

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" aria-label="Taskflow ホーム" onClick={e => { e.preventDefault(); setScope('all'); resetFilters(); }}><span className="brand-mark"><CheckCheck size={23} /></span>taskflow<span className="brand-dot">.</span></a>
      <div className="workspace"><span className="workspace-avatar">M</span><div><strong>My workspace</strong><span>パーソナルワークスペース</span></div></div>
      <div className="nav-caption">ワークスペース</div><nav aria-label="メインナビゲーション">
        <button className={scope === 'all' ? 'nav-item active' : 'nav-item'} onClick={() => { setScope('all'); resetFilters(); }}><LayoutGrid size={18} />未完了のタスク<span>{tasks.length - completed}</span></button>
        <button className={scope === 'today' ? 'nav-item active' : 'nav-item'} onClick={() => { setScope('today'); resetFilters(); }}><Clock3 size={18} />今日のタスク<span>{todayTasks}</span></button>
        <button className={scope === 'done' ? 'nav-item active' : 'nav-item'} onClick={() => { setScope('done'); resetFilters(); }}><CircleCheck size={18} />完了したタスク<span>{completed}</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="small-progress"><span>少しずつ、着実に。</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><p>{tasks.length}件中{completed}件のタスクが完了</p><div className="profile"><span className="profile-avatar">Y</span><div><strong>Your workspace</strong><span>自分のペースで進めよう</span></div></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><span>ワークスペース <span className="breadcrumb-slash">/</span> <strong>タスク管理</strong></span><div className="topbar-right"><span className="date-today">{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</span><span className="profile-avatar small">Y</span></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div><h1>{title}<span className="heading-dot">.</span></h1><p>やることを整理して、今日の一歩をはじめよう。</p></div><button className="primary-button add-task" disabled={!loaded} onClick={() => setEditor('new')}><Plus size={18} />タスクを追加</button></div>
        {error && <div role="alert" className="error-banner">{error}<button onClick={load}>再読み込み</button></div>}
        <section className="stats" aria-label="タスクの概要">
          <div className="stat"><div className="stat-top"><span>すべてのタスク</span><span className="stat-icon purple"><LayoutGrid size={18} /></span></div><div className="stat-value">{tasks.length}<span>件</span></div><div className="stat-note">次の一歩を、ここから</div></div>
          <div className="stat"><div className="stat-top"><span>進行中</span><span className="stat-icon blue"><Clock3 size={18} /></span></div><div className="stat-value">{inProgress}<span>件</span></div><div className="stat-note"><i className="dot blue-dot" />集中して取り組んでいます</div></div>
          <div className="stat"><div className="stat-top"><span>完了したタスク</span><span className="stat-icon green"><CircleCheck size={18} /></span></div><div className="stat-value">{completed}<span>件</span><span className="completion-badge">{progress}% 達成</span></div><div className="stat-note">積み重ねた成果</div></div>
          <div className="stat"><div className="stat-top"><span>期限を過ぎたタスク</span><span className="stat-icon orange"><Flag size={18} /></span></div><div className="stat-value">{overdue}<span>件</span></div><div className="stat-note">{overdue ? '優先して確認しましょう' : 'いいペースで進んでいます'}</div></div>
        </section>
        <section className="task-section" aria-label={title}><div className="section-heading"><div className="section-title"><h2>タスク一覧</h2><span>{visible.length}</span></div><div className="view-switch" aria-label="表示形式"><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}><List size={16} />リスト</button><button className={view === 'board' ? 'selected' : ''} onClick={() => setView('board')} aria-pressed={view === 'board'}><Columns3 size={16} />ボード</button></div></div>
          <div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="タスクを検索" placeholder="タスクを検索…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="検索をクリア" onClick={() => setSearch('')}><X size={15} /></button>}</div><div className="filter-actions"><div className="select-wrap"><select aria-label="ステータスで絞り込み" value={status} onChange={e => setStatus(e.target.value)}><option value="all">すべてのステータス</option>{visibleStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select><ChevronDown size={14} /></div><button className={`secondary-button filter-toggle ${showFilters || priority !== 'all' ? 'filter-active' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} />フィルター{priority !== 'all' && <span className="dot blue-dot" />}</button><div className="select-wrap sort-wrap"><ArrowDown size={15} /><select aria-label="並び順" value={sort} onChange={e => setSort(e.target.value)}><option value="due">期限順</option><option value="priority">優先度順</option><option value="newest">作成日順</option></select></div></div></div>
          {showFilters && <div className="extra-filters"><label>優先度<select aria-label="優先度で絞り込み" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">すべて</option>{(['high', 'medium', 'low'] as Priority[]).map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select></label><button className="text-button" onClick={resetFilters}>絞り込みを解除</button></div>}
          {!visible.length ? <div className="empty-state"><span><CheckCheck size={30} /></span><h3>{search || status !== 'all' || priority !== 'all' ? '一致するタスクがありません' : scope === 'today' ? '今日が期限のタスクはありません' : scope === 'done' ? '完了したタスクはまだありません' : tasks.length ? '未完了のタスクはありません' : '最初のタスクを追加しましょう'}</h3><p>{search || status !== 'all' || priority !== 'all' ? '検索条件やフィルターを変えてみてください。' : '小さな一歩から、はじめてみましょう。'}</p>{(search || status !== 'all' || priority !== 'all') ? <button className="secondary-button" onClick={resetFilters}>絞り込みを解除</button> : <button className="secondary-button" disabled={!loaded} onClick={() => setEditor('new')}><Plus size={16} />タスクを追加</button>}</div>
            : view === 'list' ? <div className="table-scroll"><table><thead><tr><th className="check-col"><Check size={15} aria-label="完了" /></th><th>タスク名</th><th>ステータス</th><th>優先度</th><th>期限</th><th className="end-col"><span className="sr-only">編集</span></th></tr></thead><tbody>{visible.map(task => <tr key={task.id} className={task.status === 'done' ? 'completed-row' : ''}><td><button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} aria-label={`「${task.title}」を${task.status === 'done' ? '未完了に戻す' : '完了にする'}`} onClick={() => changeStatus(task, task.status === 'done' ? 'todo' : 'done')}>{task.status === 'done' && <Check size={12} />}</button></td><td><button className="task-title" onClick={() => setEditor(task)}>{task.title}</button><p className="task-description">{task.description || '説明はありません'}</p></td><td><span className={`status-chip ${task.status}`}><StatusIcon status={task.status} />{statusLabels[task.status]}</span></td><td><span className={`priority-label ${task.priority}`}><i />{priorityLabels[task.priority]}</span></td><td><span className={`due-date ${task.dueDate === today() ? 'is-today' : ''} ${task.dueDate && task.dueDate < today() && task.status !== 'done' ? 'is-overdue' : ''}`}>{task.dueDate === today() ? '今日' : dateLabel(task.dueDate)}</span></td><td><button className="icon-button row-open" aria-label={`「${task.title}」を編集`} onClick={() => setEditor(task)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>
              : <div className="board">{visibleStatuses.map(s => <section className="board-column" key={s}><h3><span className={`status-chip ${s}`}><StatusIcon status={s} />{statusLabels[s]}</span><span>{visible.filter(t => t.status === s).length}</span></h3>{visible.filter(t => t.status === s).map(task => <article key={task.id} className="task-card"><button className="card-title" onClick={() => setEditor(task)}>{task.title}</button><p>{task.description}</p><div className="card-meta"><span className={`priority-label ${task.priority}`}><i />優先度 {priorityLabels[task.priority]}</span><span className="due-date">{dateLabel(task.dueDate)}</span></div><select aria-label={`「${task.title}」のステータス`} value={task.status} onChange={e => changeStatus(task, e.target.value as Status)}>{statuses.map(st => <option key={st} value={st}>{statusLabels[st]}</option>)}</select></article>)}{!visible.some(t => t.status === s) && <p className="column-empty">タスクはありません</p>}</section>)}</div>}
          <div className="table-footer"><span>{visible.length}件のタスクを表示</span><span><span className="dot green-dot" />{loaded ? 'このブラウザに保存' : '読み込みを確認してください'}</span></div>
        </section><footer className="page-footer">大きな成果も、小さなタスクから。<span>Taskflow</span></footer>
      </main>
    </div>
    {editor && <TaskEditor key={editor === 'new' ? 'new' : editor.id} task={editor === 'new' ? null : editor} onClose={() => setEditor(null)} onSave={input => persist(editor === 'new' ? [...tasks, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] : tasks.map(t => t.id === editor.id ? { ...t, ...input } : t), editor === 'new' ? 'タスクを追加しました' : '変更を保存しました')} onDelete={() => { if (editor !== 'new' && persist(tasks.filter(t => t.id !== editor.id), 'タスクを削除しました')) setEditor(null); }} />}
    <div className="toast-region" role="status" aria-live="polite">{notice && <div className="toast"><CircleCheck size={18} /><span>{notice.message}</span>{notice.undo && <button className="undo-button" onClick={undoStatus}>元に戻す</button>}</div>}</div>
  </div>;
}
