#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { devConfig } from '../config/dev.js';
import { ApplicationStack } from '../lib/stacks/application-stack.js';
import { NetworkStack } from '../lib/stacks/network-stack.js';

const app = new App();

const networkStack = new NetworkStack(app, 'EcsDevNetworkStack', devConfig);

const applicationStack = new ApplicationStack(app, 'EcsDevStack', {
  ...devConfig,
  vpc: networkStack.vpc,
});

// アプリ側にリソースがない段階でも、ネットワークを先に作成する順序を明示する。
applicationStack.addStackDependency(networkStack);
