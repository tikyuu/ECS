export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string;
  createdAt: string;
};
export type TaskInput = Omit<Task, 'id' | 'createdAt'>;

export const statusLabels: Record<Status, string> = { todo: '未着手', in_progress: '進行中', done: '完了' };
export const priorityLabels: Record<Priority, string> = { high: '高', medium: '中', low: '低' };
const storageKey = 'taskflow.tasks.v1';

function dateOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const today = () => dateOffset(0);

function initialTasks(): Task[] {
  return [
    ['プロジェクトの要件を整理する', '必要な機能と、最初のリリースで目指す状態をまとめる。', 'done', 'high', -1],
    ['タスク一覧画面のデザインを確認する', '一覧とボードの使い勝手、スマートフォンでの表示を確認する。', 'in_progress', 'high', 0],
    ['APIのエンドポイントを設計する', 'タスクの取得・作成・更新・削除の入出力を決める。', 'in_progress', 'high', 1],
    ['開発環境のセットアップ手順をまとめる', '初めて参加するメンバーがローカルで起動できるようにする。', 'todo', 'medium', 2],
    ['デプロイの流れを検討する', 'ビルドからリリース、問題が起きた際の復旧までを整理する。', 'todo', 'medium', 3],
    ['リリース前のチェック項目を作る', '主要な操作とエラー時の表示を確認する。', 'todo', 'low', 5],
  ].map(([title, description, status, priority, offset], index) => ({
    id: `sample-${index + 1}`, title: String(title), description: String(description),
    status: status as Status, priority: priority as Priority, dueDate: dateOffset(Number(offset)), createdAt: new Date().toISOString(),
  }));
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return ['id', 'title', 'description', 'dueDate', 'createdAt'].every(key => typeof t[key] === 'string')
    && ['todo', 'in_progress', 'done'].includes(String(t.status)) && ['high', 'medium', 'low'].includes(String(t.priority));
}

// Replace this adapter with HTTP requests when the backend contract is agreed.
// Storage failures deliberately propagate so the UI can show an actionable error.
export const taskRepository = {
  list(): Task[] {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) {
      const tasks = initialTasks();
      this.save(tasks);
      return tasks;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isTask)) throw new Error('保存データの形式が正しくありません。');
    return parsed;
  },
  save(tasks: Task[]) { localStorage.setItem(storageKey, JSON.stringify(tasks)); },
};
