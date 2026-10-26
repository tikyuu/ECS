"""Generate editable draw.io pages using embedded official AWS SVG icons."""
import base64
import pathlib
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/architecture'
FONT = 'Arial'
BLUE, PURPLE, ORANGE, GRAY = '#2563EB', '#7C3AED', '#D97706', '#64748B'
document = ET.Element('mxfile', host='app.diagrams.net', agent='ECS hands-on', version='29.0.0', compressed='false')


class Page:
    def __init__(self, name, width=1740, height=1510):
        diagram = ET.SubElement(document, 'diagram', id='page-' + str(len(document)), name=name)
        model = ET.SubElement(diagram, 'mxGraphModel', dx='1740', dy='1510', grid='1', gridSize='10', guides='1',
                              tooltips='1', connect='1', arrows='1', fold='1', page='1', pageScale='1',
                              pageWidth=str(width), pageHeight=str(height), math='0', shadow='0', background='#FFFFFF')
        self.root = ET.SubElement(model, 'root')
        ET.SubElement(self.root, 'mxCell', id='0')
        ET.SubElement(self.root, 'mxCell', id='1', parent='0')
        self.positions = {'1': (0, 0)}
        self.counter = 0

    def cell(self, id, value, x, y, w, h, style, parent='1'):
        px, py = self.positions[parent]
        c = ET.SubElement(self.root, 'mxCell', id=id, value=value, style=style, vertex='1', parent=parent)
        ET.SubElement(c, 'mxGeometry', x=str(x-px), y=str(y-py), width=str(w), height=str(h), **{'as': 'geometry'})
        self.positions[id] = (x, y)
        return id

    def text(self, id, value, x, y, w, h, size=16, color='#334155', bold=False, parent='1', align='left'):
        return self.cell(id, value, x, y, w, h,
                         f'text;html=0;whiteSpace=wrap;overflow=hidden;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;'
                         f'fontFamily={FONT};fontSize={size};fontColor={color};fontStyle={1 if bold else 0};spacing=3;', parent)

    def box(self, id, label, x, y, w, h, color, fill='#FFFFFF', parent='1', dashed=False):
        return self.cell(id, label, x, y, w, h,
                         f'rounded=0;html=0;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;'
                         f'fillColor={fill};strokeColor={color};strokeWidth=1.5;dashed={int(dashed)};'
                         f'align=left;verticalAlign=top;spacingLeft=14;spacingTop=10;fontFamily={FONT};fontSize=16;fontStyle=1;fontColor={color};', parent)

    def image(self, id, key, x, y, size, parent):
        data = base64.b64encode((OUT / 'assets' / (key + '.svg')).read_bytes()).decode()
        return self.cell(id, '', x, y, size, size, f'shape=image;imageAspect=0;aspect=fixed;image=data:image/svg+xml,{data};', parent)

    def node(self, id, key, title, detail, x, y, w=260, h=120, parent='1', color='#CBD5E1'):
        self.cell(id, '', x, y, w, h, f'rounded=1;arcSize=8;html=0;fillColor=#FFFFFF;strokeColor={color};strokeWidth=1.5;container=1;collapsible=0;', parent)
        self.image(id+'-icon', key, x+16, y+20, 48, id)
        self.text(id+'-title', title, x+77, y+14, w-87, 42, 16, '#1E293B', True, id)
        self.text(id+'-detail', detail, x+77, y+57, w-87, h-64, 13, '#64748B', parent=id)
        return id

    def edge(self, id, src, dst, label='', color=BLUE, dashed=False, points=(), exit=(.5,1), entry=(.5,0), both=False):
        c = ET.SubElement(self.root, 'mxCell', id=id, value=label, edge='1', parent='1', source=src, target=dst,
                          style=f'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=20;html=0;'
                          f'exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0;entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;'
                          f'strokeColor={color};strokeWidth=2;dashed={int(dashed)};endArrow=block;endFill=1;'
                          f'startArrow={"block" if both else "none"};startFill=1;fontFamily={FONT};fontSize=13;fontColor={color};'
                          'labelBackgroundColor=#FFFFFF;spacing=6;')
        geo = ET.SubElement(c, 'mxGeometry', relative='1', **{'as':'geometry'})
        if points:
            arr = ET.SubElement(geo, 'Array', **{'as':'points'})
            for x,y in points: ET.SubElement(arr, 'mxPoint', x=str(x), y=str(y))

    def symbol(self, id, key, title, detail, cx, y, parent='1', size=56, width=240, background='none'):
        """Keep the official icon intact; labels sit below, without a UI card."""
        x = cx - width / 2
        height = size + (58 if detail else 33)
        self.cell(id, '', x, y, width, height, f'shape=rectangle;container=1;collapsible=0;fillColor={background};strokeColor=none;', parent)
        self.image(id+'-icon', key, cx-size/2, y, size, id)
        self.text(id+'-title', title, x, y+size+8, width, 25, 16, '#172B4D', True, id, 'center')
        if detail:
            self.text(id+'-detail', detail, x-10, y+size+35, width+20, 23, 12, '#64748B', parent=id, align='center')
        return id


# Diagram text is limited to resource names, network labels, and protocols.
p = Page('01 全体構成', 1000, 1140)
p.text('title', 'Taskflow / AWS', 35, 25, 930, 42, 27, '#172B4D', True)
p.symbol('browser', 'users', 'ブラウザ', '', 120, 120, size=56, width=160)
p.symbol('cloudfront', 'cloudfront', 'CloudFront', '', 500, 120, size=56, width=200)
p.symbol('dns', 'route53', 'Route 53', '', 870, 120, size=56, width=160)

p.box('region', 'Tokyo / ap-northeast-1', 35, 290, 930, 810, '#B4BFCC', '#FFFFFF')
p.symbol('acm', 'acm', 'ACM', '', 170, 330, 'region', 48, 150)
p.symbol('s3', 's3', 'S3 / Frontend', '', 830, 330, 'region', 56, 210)
p.box('vpc', 'VPC / 10.0.0.0/20', 55, 470, 890, 610, '#9C88B5', '#FFFFFF', 'region')
p.box('az-a', 'AZ-A / ap-northeast-1a', 75, 520, 400, 540, '#CBD2DC', '#FBFCFE', 'vpc', True)
p.box('az-b', 'AZ-B / ap-northeast-1c', 525, 520, 400, 540, '#CBD2DC', '#FBFCFE', 'vpc', True)
p.box('public-a', 'Public A / 10.0.0.0/24', 95, 565, 360, 145, '#A7BF95', '#F7FAF4', 'az-a')
p.box('public-b', 'Public B / 10.0.1.0/24', 545, 565, 360, 145, '#A7BF95', '#F7FAF4', 'az-b')
p.box('private-a', 'Private A / 10.0.10.0/24', 95, 750, 360, 135, '#98B8CE', '#F4F9FC', 'az-a')
p.box('db-a', 'DB A / 10.0.12.0/24', 95, 925, 360, 125, '#A8B9D7', '#F5F7FC', 'az-a')
p.box('db-b', 'DB B / 10.0.13.0/24', 545, 925, 360, 125, '#A8B9D7', '#F5F7FC', 'az-b')

p.symbol('nat', 'nat', 'NAT Gateway', '', 230, 605, 'public-a', 48, 180)
p.symbol('alb', 'alb', 'ALB', '', 500, 605, 'vpc', 48, 160, '#FFFFFF')
p.symbol('api', 'fargate', 'ECS Fargate / API', '', 275, 795, 'private-a', 48, 230)
p.symbol('rds', 'rds', 'RDS PostgreSQL', '', 275, 960, 'db-a', 48, 230)

# IGWはサブネット内ではなくVPCに接続するため、VPC境界上に配置する。
p.cell('igw', '', 476, 446, 120, 48, 'container=1;collapsible=0;fillColor=#FFFFFF;strokeColor=none;', 'vpc')
p.image('igw-icon', 'igw', 476, 446, 48, 'igw')
p.text('igw-title', 'IGW', 530, 457, 60, 25, 16, '#172B4D', True, 'igw')

p.edge('dns-lookup', 'browser-icon', 'dns-icon', 'DNS', PURPLE, True, points=[(120,95),(870,95)], exit=(.5,0), entry=(.5,0), both=True)
p.edge('browser-cf', 'browser-icon', 'cloudfront-icon', 'HTTPS', exit=(1,.5), entry=(0,.5))
p.edge('cf-static', 'cloudfront-icon', 's3-icon', 'HTTPS / OAC', points=[(580,148),(580,250),(830,250)], exit=(1,.5))
p.edge('cf-api', 'cloudfront', 'igw-icon', '/api/* / HTTPS', exit=(.5,1))
p.edge('igw-alb', 'igw-icon', 'alb-icon')
p.edge('alb-api', 'alb', 'api-icon', 'HTTP :3000', points=[(500,819)], entry=(1,.5))
p.edge('api-db', 'api', 'rds-icon', 'TLS :5432')


q = Page('02 外向き通信', 1000, 850)
q.text('title', 'Taskflow / Egress', 35, 25, 930, 42, 27, '#172B4D', True)
q.box('region', 'Tokyo / ap-northeast-1', 35, 100, 930, 710, '#B4BFCC', '#FFFFFF')
q.box('vpc', 'VPC / 10.0.0.0/20', 55, 145, 610, 630, '#9C88B5', '#FFFFFF', 'region')
q.box('private', 'Private A / 10.0.10.0/24', 75, 200, 220, 230, '#98B8CE', '#F4F9FC', 'vpc')
q.box('public', 'Public A / 10.0.0.0/24', 325, 200, 220, 230, '#A7BF95', '#F7FAF4', 'vpc')
q.symbol('api', 'fargate', 'API', '', 185, 270, 'private', 48, 160)
q.symbol('nat', 'nat', 'NAT Gateway', '', 435, 270, 'public', 48, 180)
q.symbol('igw', 'igw', 'IGW', '', 620, 270, 'vpc', 48, 110)
q.symbol('gateway', 'endpoint', 'S3 Gateway', '', 500, 650, 'vpc', 48, 180)
q.box('services', 'AWS services', 705, 145, 240, 630, '#CBD2DC', '#FBFCFE', 'region')
q.symbol('ecr', 'ecr', 'ECR', '', 825, 190, 'services', 48, 180)
q.symbol('logs', 'cloudwatch', 'CloudWatch Logs', '', 825, 330, 'services', 48, 210)
q.symbol('secrets', 'secrets', 'Secrets Manager', '', 825, 470, 'services', 48, 210)
q.symbol('layers', 's3', 'S3 / ECR layers', '', 825, 650, 'services', 48, 210)
q.edge('api-nat', 'api-icon', 'nat-icon', 'HTTPS', ORANGE, exit=(1,.5), entry=(0,.5))
q.edge('nat-igw', 'nat-icon', 'igw-icon', '', ORANGE, exit=(1,.5), entry=(0,.5))
q.edge('igw-ecr', 'igw-icon', 'ecr-icon', '', ORANGE, points=[(680,294),(680,214)], exit=(1,.5), entry=(0,.5))
# AWSサービスへの分岐位置を揃え、CloudWatch向けの線が他の線を横切らないようにする。
q.edge('igw-logs', 'igw-icon', 'logs-icon', '', ORANGE, points=[(680,294),(680,354)], exit=(1,.5), entry=(0,.5))
q.edge('igw-secrets', 'igw-icon', 'secrets-icon', '', ORANGE, points=[(680,294),(680,494)], exit=(1,.5), entry=(0,.5))
q.edge('api-gateway', 'api-icon', 'gateway-icon', 'HTTPS', '#438A36', points=[(130,294),(130,674)], exit=(0,.5), entry=(0,.5))
q.edge('gateway-s3', 'gateway-icon', 'layers-icon', '', '#438A36', exit=(1,.5), entry=(0,.5))

path = OUT / 'taskflow-aws-v5.drawio'
ET.ElementTree(document).write(path, encoding='utf-8', xml_declaration=True)
print(path)
