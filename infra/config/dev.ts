import type { StackProps } from 'aws-cdk-lib';

// 開発環境の共通設定。認証情報は含めず、AWSプロファイルで指定する。
export const devConfig = {
  env: { region: 'ap-northeast-1' },
  description: 'ECS hands-on infrastructure',
  analyticsReporting: false,
  tags: {
    Project: 'ecs',
    Environment: 'dev',
    ManagedBy: 'aws-cdk',
  },
} satisfies StackProps;
