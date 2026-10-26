import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/stacks/network-stack.js';

const stack = new NetworkStack(new App(), 'TestNetwork', {
  env: { region: 'ap-northeast-1' },
});
const template = Template.fromStack(stack);
const subnetRef = (cidr: string) => {
  const entries = Object.entries(template.findResources('AWS::EC2::Subnet', {
    Properties: { CidrBlock: cidr },
  }));
  assert.equal(entries.length, 1);
  return { Ref: entries[0][0] };
};
const routeTableRef = (cidr: string) => {
  const associations = Object.values(template.findResources('AWS::EC2::SubnetRouteTableAssociation', {
    Properties: { SubnetId: subnetRef(cidr) },
  }));
  assert.equal(associations.length, 1);
  return associations[0].Properties.RouteTableId;
};
const onlyResource = (type: string) => {
  const resources = Object.entries(template.findResources(type));
  assert.equal(resources.length, 1);
  return { id: resources[0][0], resource: resources[0][1] };
};

test('5つのサブネットが指定AZにあり、VPC内でCIDRが重複しない', () => {
  const expected = [
    ['10.0.0.0/24', 'ap-northeast-1a'],
    ['10.0.1.0/24', 'ap-northeast-1c'],
    ['10.0.10.0/24', 'ap-northeast-1a'],
    ['10.0.12.0/24', 'ap-northeast-1a'],
    ['10.0.13.0/24', 'ap-northeast-1c'],
  ];
  template.resourceCountIs('AWS::EC2::Subnet', 5);
  template.resourceCountIs('AWS::EC2::RouteTable', 5);
  template.resourceCountIs('AWS::EC2::SubnetRouteTableAssociation', 5);
  const vpc = onlyResource('AWS::EC2::VPC');
  assert.equal(vpc.resource.Properties.CidrBlock, '10.0.0.0/20');
  const ranges = expected.map(([cidr, az]) => {
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: cidr, AvailabilityZone: az, MapPublicIpOnLaunch: false,
      VpcId: { Ref: vpc.id },
    });
    const [address, prefix] = cidr.split('/');
    const start = address.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
    return { start, end: start + 2 ** (32 - Number(prefix)) - 1 };
  }).sort((a, b) => a.start - b.start);
  const vpcStart = 10 * 2 ** 24;
  for (const [index, range] of ranges.entries()) {
    assert.ok(range.start >= vpcStart && range.end < vpcStart + 4096);
    if (index) assert.ok(ranges[index - 1].end < range.start);
  }
  // 後続スタックへ渡す参照が、対応するサブネットを指していることも確認する。
  for (const [subnet, cidr] of [
    [stack.publicSubnetA, '10.0.0.0/24'], [stack.publicSubnetB, '10.0.1.0/24'],
    [stack.privateSubnetA, '10.0.10.0/24'], [stack.dbSubnetA, '10.0.12.0/24'],
    [stack.dbSubnetB, '10.0.13.0/24'],
  ] as const) assert.deepEqual(stack.resolve(subnet.subnetId), subnetRef(cidr));
});

test('Public A/Bのルートは同じIGWを指し、VPC接続後に作成する', () => {
  const igw = onlyResource('AWS::EC2::InternetGateway');
  const attachment = onlyResource('AWS::EC2::VPCGatewayAttachment');
  assert.deepEqual(attachment.resource.Properties, {
    InternetGatewayId: { Ref: igw.id }, VpcId: { Ref: onlyResource('AWS::EC2::VPC').id },
  });
  for (const cidr of ['10.0.0.0/24', '10.0.1.0/24']) {
    const routes = Object.values(template.findResources('AWS::EC2::Route', {
      Properties: { RouteTableId: routeTableRef(cidr) },
    }));
    assert.equal(routes.length, 1);
    assert.deepEqual(routes[0].Properties, {
      RouteTableId: routeTableRef(cidr), DestinationCidrBlock: '0.0.0.0/0', GatewayId: { Ref: igw.id },
    });
    assert.ok(routes[0].DependsOn.includes(attachment.id));
  }
});

test('NATとEIPは1つずつで、Private AだけがPublic AのNATを使う', () => {
  const nat = onlyResource('AWS::EC2::NatGateway');
  const eip = onlyResource('AWS::EC2::EIP');
  assert.equal(eip.resource.Properties.Domain, 'vpc');
  assert.deepEqual(nat.resource.Properties.SubnetId, subnetRef('10.0.0.0/24'));
  assert.deepEqual(nat.resource.Properties.AllocationId, { 'Fn::GetAtt': [eip.id, 'AllocationId'] });
  const publicRoute = Object.keys(template.findResources('AWS::EC2::Route', {
    Properties: { RouteTableId: routeTableRef('10.0.0.0/24') },
  }))[0];
  assert.ok(nat.resource.DependsOn.includes(publicRoute));
  template.hasResourceProperties('AWS::EC2::Route', {
    RouteTableId: routeTableRef('10.0.10.0/24'),
    DestinationCidrBlock: '0.0.0.0/0', NatGatewayId: { Ref: nat.id },
  });
  template.resourceCountIs('AWS::EC2::Route', 3);
});

test('DB A/Bには外向きルートがなく、S3エンドポイントも関連付けない', () => {
  for (const cidr of ['10.0.12.0/24', '10.0.13.0/24']) {
    assert.deepEqual(template.findResources('AWS::EC2::Route', {
      Properties: { RouteTableId: routeTableRef(cidr) },
    }), {});
  }
  const endpoint = onlyResource('AWS::EC2::VPCEndpoint');
  assert.equal(endpoint.resource.Properties.VpcEndpointType, 'Gateway');
  assert.deepEqual(endpoint.resource.Properties.RouteTableIds, [routeTableRef('10.0.10.0/24')]);
  // デプロイ先リージョンを参照するS3サービス名になっていることを確認する。
  assert.deepEqual(endpoint.resource.Properties.ServiceName, {
    'Fn::Join': ['', ['com.amazonaws.', { Ref: 'AWS::Region' }, '.s3']],
  });
  assert.deepEqual(endpoint.resource.Properties.VpcId, { Ref: onlyResource('AWS::EC2::VPC').id });
});
