import { IpAddresses, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Network extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: 'vpc-ecs-dev',
      ipAddresses: IpAddresses.cidr('10.0.0.0/20'),
      enableDnsSupport: true,
      enableDnsHostnames: true,

      // サブネット・IGW・NATは、後のステップで追加する。
      subnetConfiguration: [],
      natGateways: 0,
      createInternetGateway: false,

      // VPC単体の段階では、default SG変更用のCustom Resourceも作らない。
      restrictDefaultSecurityGroup: false,
    });
  }
}
