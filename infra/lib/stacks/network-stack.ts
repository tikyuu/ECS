import { Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { ISubnet, IVpc } from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import { Network } from '../constructs/network.js';

export class NetworkStack extends Stack {
  public readonly vpc: IVpc;
  public readonly publicSubnetA: ISubnet;
  public readonly publicSubnetB: ISubnet;
  public readonly privateSubnetA: ISubnet;
  public readonly dbSubnetA: ISubnet;
  public readonly dbSubnetB: ISubnet;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'Network');
    this.vpc = network.vpc;
    this.publicSubnetA = network.publicSubnetA;
    this.publicSubnetB = network.publicSubnetB;
    this.privateSubnetA = network.privateSubnetA;
    this.dbSubnetA = network.dbSubnetA;
    this.dbSubnetB = network.dbSubnetB;
  }
}
