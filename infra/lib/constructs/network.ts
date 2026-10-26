import { CfnInternetGateway, CfnVPCGatewayAttachment, IpAddresses, PublicSubnet, Vpc } from 'aws-cdk-lib/aws-ec2';
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

      // サブネット・IGW・ルートは個別に定義し、NATは後のステップで追加する。
      subnetConfiguration: [],
      natGateways: 0,
      createInternetGateway: false,

      // VPC単体の段階では、default SG変更用のCustom Resourceも作らない。
      restrictDefaultSecurityGroup: false,
    });

    // 自動サブネット作成を使わないため、IGWとVPCへの接続を明示する。
    const internetGateway = new CfnInternetGateway(this, 'InternetGateway');
    const internetGatewayAttachment = new CfnVPCGatewayAttachment(this, 'InternetGatewayAttachment', {
      vpcId: this.vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });

    this.publicSubnetA = new PublicSubnet(this, 'PublicSubnetA', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1a',
      cidrBlock: '10.0.0.0/24',
      mapPublicIpOnLaunch: false,
    });

    // IGWのVPC接続後に、Public Aのインターネット向けIPv4ルートを作成する。
    this.publicSubnetA.addDefaultInternetRoute(internetGateway.ref, internetGatewayAttachment);
  }
}
