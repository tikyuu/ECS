import { Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { IVpc } from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

export interface ApplicationStackProps extends StackProps {
  readonly vpc: IVpc;
}

export class ApplicationStack extends Stack {
  public readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    // ネットワークはNetworkStackで管理し、ここでは受け取ったVPCを使用する。
    this.vpc = props.vpc;
  }
}
