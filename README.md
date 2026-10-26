# ECS hands-on

ECSの構築・デプロイ・監視・障害対応を学ぶためのタスク管理アプリです。フロントエンドとTypeScriptのCDK実行環境を用意し、現在はVPC、Public A用サブネット、IGWとVPCへの接続を定義しています。AWSへのデプロイは未実施です。会話で設定を確認しながら一段階ずつ実装します。

## CDK実行環境

`infra/` をnpm workspaceとして追加しています。グローバルのCDKをインストールせず、リポジトリのルートから実行します。

| パッケージ | 固定バージョン |
| --- | --- |
| AWS CDK CLI (`aws-cdk`) | 2.1146.1 |
| AWS CDKライブラリ (`aws-cdk-lib`) | 2.274.0 |
| Constructs | 10.8.1 |
| TypeScript（インフラ用） | 7.0.2 |
| tsx（TypeScriptの直接実行） | 4.23.15 |
| Node.js型定義（24系） | 24.19.2 |

2026年10月26日にnpm公式レジストリの最新公開版を確認し、上記のバージョンを固定しました（Node.js型定義は実行環境に合わせた24系の最新）。CDK CLIとライブラリは別々にバージョンが付くため、数字は一致しません。解決された依存関係はルートの `package-lock.json` で固定しています。フロントのTypeScriptは従来のバージョンを維持しています。

実行にはNode.js 22以降が必要です。AWSはActive LTSの利用を推奨しています。この環境では既存のNode.js **24.14.0** / npm **11.9.0** を使用します。Node.jsやnpmのシステム全体のバージョンは変更していません。[AWS公式の前提条件](https://docs.aws.amazon.com/cdk/v2/guide/prerequisites.html)

```sh
npm ci
npm run cdk -- --version
npm run cdk -- ls
npm run infra:build
npm run infra:synth
```

`infra:build` はTypeScriptを `infra/dist/` へコンパイルします。`infra:synth` は `tsx` でアプリを実行してCloudFormationテンプレートを `infra/cdk.out/` へ生成します。`npm run typecheck` でフロントとインフラの両方を型チェックできます。

ネットワーク専用の `EcsDevNetworkStack`（クラス名は `NetworkStack`）から `Network` Constructを呼び出し、名前 `vpc-ecs-dev`、CIDR `10.0.0.0/20` のVPCを定義しています。DNSは有効です。Gitの初回コミットは、このVPC実装を追加する前の空のスタックです。

`EcsDevStack`（クラス名は `ApplicationStack`）はNetworkStackからVPCを受け取り、将来ALBやECSなどを追加するための枠です。現在アプリ側のAWSリソースはなく、synth時には空のスタックについての検証警告が出ます。ネットワークを先にデプロイする依存関係を `app.ts` で明示しています。

L2の `PublicSubnet` でPublic A（`10.0.0.0/24`、`ap-northeast-1a`）を個別に定義しました。VPCの自動サブネット作成は無効のままです。サブネット専用のルートテーブルと関連付けも生成されます。パブリックIPの自動割り当ては無効です。IGW本体とVPCへの接続は `CfnInternetGateway` / `CfnVPCGatewayAttachment` で明示的に定義しています。`subnetConfiguration: []` の構成では `createInternetGateway: true` だけでIGWが自動作成されないためです。IGWへの経路は未追加で、名前はPublic Aですがインターネット接続はまだできません。NATやdefault SG変更用の追加リソースも作成しません。

`NetworkStack.publicSubnetA` からサブネットを参照できます。個別に作ったサブネットなので、後続リソースへはこの参照を明示して渡します（`vpc.publicSubnets` に自動登録される方式ではありません）。

`config/dev.ts` に東京リージョン（`ap-northeast-1`）、Projectタグ `ecs` などの共通設定をまとめ、`app.ts` から両スタックへ渡します。AWS認証情報はconfigに書きません。アカウントは未固定で、synthはAWS認証情報なしで実行できます。デプロイ先アカウントとCDKの推奨feature flagsは別のステップで扱います。

AWS CLIはインストール済みです。認証設定の確認、`cdk bootstrap`、`cdk deploy` はまだ実施していません。

```text
infra/
  bin/app.ts                           CDKアプリのエントリーポイント
  config/dev.ts                        開発環境の共通設定
  lib/stacks/network-stack.ts           ネットワーク用スタック
  lib/stacks/application-stack.ts       VPCを受け取るアプリ用スタック
  lib/constructs/network.ts             VPC・Public A用サブネット・IGWの定義
  cdk.json                             アプリの実行コマンド
  tsconfig.json                        TypeScript設定
```

## AWS構成図（設計案）

構成図はVPCのCIDR変更（`/16` → `/20`）前の案です。サブネットは次の会話で再設計し、合意後に図とコードを更新します。図中のDB用 `10.0.20.0/24`・`10.0.21.0/24` は新しいVPCの範囲外なので、そのまま採用しません。

[編集可能なdraw.ioファイル](docs/architecture/taskflow-aws-v5.drawio) は2ページ構成です。

図中の文章による説明は省き、サービス名・ネットワーク名・CIDR・通信ラベルのみを表示しています。左右のAZと対応するサブネットは同寸です。構成上の補足は以下に記載しています。

1. [全体構成](docs/architecture/taskflow-aws-v5-preview.png)：S3＋CloudFrontの画面配信、VPC・AZ・サブネット、CloudFrontからIGW経由で公開ALBへ、ALBからAPI、APIからRDSへの通信
2. [外向き通信](docs/architecture/taskflow-aws-v5-network.png)：NAT・IGW経由でのECR API・CloudWatch Logs・Secrets Managerへの通信と、S3 Gateway経由のイメージレイヤー取得

フロントは非公開S3バケット＋CloudFront（OAC）で配信し、ECSはAPIのみ動かします。CloudFrontは通常パスをS3へ、`/api/*`をALBへ転送し、APIはキャッシュしない案です。ALBのオリジン接続には東京リージョン、CloudFrontの閲覧者向けHTTPSにはus-east-1のACM証明書を使用します。

ECSとRDSはAZ-Aのみで動かし、単一ALBを2AZで有効化します。RDSのDB subnet groupに必要なDBサブネットもAZ-Bに用意します。外向き通信はNAT 1台＋無料のS3 Gatewayエンドポイント1個を使う案です。Interfaceエンドポイントは作成しません。`tasks.tikyuu.click`、`origin.tasks.tikyuu.click`、CIDR、ポートは提案値です。AWSリソースは未構築です。

[AWS公式アイコンページ](https://aws.amazon.com/architecture/icons/)で2026年10月25日に確認した最新配布パッケージ（2026年7月31日版）のSVGをファイル内に埋め込んでいます。出典とハッシュは [assets/sources.json](docs/architecture/assets/sources.json) に記録しています。各ページのSVG版も同じフォルダにあります。

再生成：`python3 scripts/generate-architecture.py`（Python標準ライブラリのみ使用）。

## 起動

Node.js 22.12以降（推奨: Node.js 24）、npmを使用します。

```sh
npm ci
npm run dev
```

http://127.0.0.1:5173 を開いてください。

```sh
npm run typecheck
npm run build
```

ビルド結果は `apps/web/dist/` に生成されます。

## 現在使っている仕組み

| 技術 | 役割 |
| --- | --- |
| React | 画面、フォーム、検索、一覧とボードの切り替え |
| TypeScript | タスクやフォームのデータ型をチェック |
| Vite | 開発サーバーと本番用の静的ファイルの生成 |
| React標準のuseState / useMemo | 画面の状態と表示対象の管理 |
| 通常のCSS | レスポンシブレイアウト、配色、スタイル |
| Lucide React | UIのアイコン |
| localStorage | このブラウザ内でタスクを保存する仮のデータ層 |

Viteの構成は [公式ガイド](https://vite.dev/guide/) に基づいています。フォントはGoogle Fontsを利用し、取得できない場合は端末のフォントに切り替わります。

## 画面の機能

- タスクの追加・編集・削除（削除時に確認）
- 未着手・進行中・完了のステータス管理
- チェックで完了すると未完了一覧・今日の一覧から非表示。「完了したタスク」から確認・未完了へ復元可能
- ステータス変更直後の通知に6秒間「元に戻す」を表示（変更前のステータスへ復元）
- 優先度、期限、説明の設定
- 検索、ステータス・優先度の絞り込み、期限・優先度・作成日順の並び替え
- 一覧 / ボード表示、今日が期限の未完了タスク / 完了タスクの表示
- 件数、完了率、期限超過件数の集計
- ブラウザ再起動後のデータ保持、別タブでの変更の反映
- 空の状態、保存・読み込み失敗の表示、スマートフォン用レイアウト

初回起動時のみサンプルデータを作成します。全件削除後は空の状態を保持します。localStorageのキーは `taskflow.tasks.v1` です。端末・ブラウザ・オリジンごとに別のデータになり、共有や認証はありません。ブラウザのデータを消すとタスクも消えます。

## ファイル構成

```text
apps/web/
  src/App.tsx      画面と操作
  src/tasks.ts     型・ラベル・ブラウザ保存アダプター
  src/styles.css   スタイル
```

## 次に相談すること

API・認証・AWSリソースは未実装です。以下は候補で、まだ確定していません。

1. フロントはS3 + CloudFrontで配信する方針。パス別のAPI転送とオリジン保護の詳細
2. バックエンドの言語・フレームワークと、タスクのAPI仕様
3. DB（RDSなど）と認証の必要範囲
4. CDKでのネットワーク、ECS、権限、ログ、デプロイの構成

バックエンドの仕様が決まったら `src/tasks.ts` の保存処理をHTTP APIに置き換えます。非同期化に伴って画面に通信中・リトライ等の制御も加えます。
