#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ApplicationStack } from '../lib/stacks/application-stack.js';

const app = new App();

// Configure the deployment account and regions when adding AWS resources.
new ApplicationStack(app, 'TaskflowDevStack', {
  description: 'Taskflow hands-on infrastructure',
  analyticsReporting: false,
  tags: {
    Project: 'taskflow',
    Environment: 'dev',
    ManagedBy: 'aws-cdk',
  },
});
