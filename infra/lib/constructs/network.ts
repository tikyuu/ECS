import { CfnInternetGateway, CfnVPCGatewayAttachment, GatewayVpcEndpointAwsService, IpAddresses, PrivateSubnet, PublicSubnet, Subnet, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Network extends Construct {
  public readonly vpc: Vpc;
  public readonly publicSubnetA: PublicSubnet;
  public readonly publicSubnetB: PublicSubnet;
  public readonly privateSubnetA: PrivateSubnet;
  public readonly dbSubnetA: Subnet;
  public readonly dbSubnetB: Subnet;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: 'vpc-ecs-dev',
      ipAddresses: IpAddresses.cidr('10.0.0.0/20'),
      enableDnsSupport: true,
      enableDnsHostnames: true,

      // 自動作成を無効にし、サブネット・IGW・NAT・ルートを個別に定義する。
      subnetConfiguration: [],
      natGateways: 0,
      createInternetGateway: false,

      // default SG変更用のCustom Resourceは作成しない。
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

    this.publicSubnetB = new PublicSubnet(this, 'PublicSubnetB', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1c',
      cidrBlock: '10.0.1.0/24',
      mapPublicIpOnLaunch: false,
    });
    this.publicSubnetB.addDefaultInternetRoute(internetGateway.ref, internetGatewayAttachment);

    this.privateSubnetA = new PrivateSubnet(this, 'PrivateSubnetA', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1a',
      cidrBlock: '10.0.10.0/24',
      mapPublicIpOnLaunch: false,
    });

    // DB用サブネットには、IGWやNATへ向かうデフォルトルートを追加しない。
    this.dbSubnetA = new Subnet(this, 'DbSubnetA', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1a',
      cidrBlock: '10.0.12.0/24',
      mapPublicIpOnLaunch: false,
    });
    this.dbSubnetB = new Subnet(this, 'DbSubnetB', {
      vpcId: this.vpc.vpcId,
      availabilityZone: 'ap-northeast-1c',
      cidrBlock: '10.0.13.0/24',
      mapPublicIpOnLaunch: false,
    });

    // Public AにNATとElastic IPを1つずつ作成し、Private Aの出口にする。
    // addNatGatewayはPublic AのIGW向けルートが作成された後にNATを作成する。
    const natGateway = this.publicSubnetA.addNatGateway();
    this.privateSubnetA.addDefaultNatRoute(natGateway.ref);

    // 個別作成したPrivate Aを明示的に選び、S3向け通信はNATを経由させない。
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnets: [this.privateSubnetA] }],
    });
  }
}
