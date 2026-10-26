import { IpAddresses, PublicSubnet, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Network extends Construct {
  public readonly vpc: Vpc;
  public readonly publicSubnetA: PublicSubnet;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: 'vpc-ecs-dev',
      ipAddresses: IpAddresses.cidr('10.0.0.0/20'),
      enableDnsSupport: true,
      enableDnsHostnames: true,

      // サブネットはこの後で個別に定義し、IGW・NATは後のステップで追加する。
      subnetConfiguration: [],
      natGateways: 0,
      createInternetGateway: false,

      // VPC単体の段階では、default SG変更用のCustom Resourceも作らない。
      restrictDefaultSecurityGroup: false,
    });

    this.publicSubnetA = new PublicSubnet(this, 'PublicSubnetA', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1a',
      cidrBlock: '10.0.0.0/24',
      mapPublicIpOnLaunch: false,
    });
  }
}
