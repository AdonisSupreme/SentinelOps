"""Build every shipped operator PDF/HTML from the same catalog used by React.

Run: python scripts/build_operator_guides.py
Requires reportlab. No credentials, API calls or operational database access.
"""
from pathlib import Path
import hashlib
import html
import json
import re
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, KeepTogether, Table, TableStyle
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'src/content/operatorGuides.json'
data = json.loads(CATALOG.read_text(encoding='utf-8'))
registry = {m['module_key']: m for m in json.loads((ROOT / 'src/policies/modules.json').read_text(encoding='utf-8'))}
assert len(data['guides']) == len(registry)
assert {g['key'] for g in data['guides']} == set(registry)
guides = sorted(data['guides'], key=lambda g: list(registry).index(g['key']))
for guide in guides:
    guide['title'] = registry[guide['key']]['name']
    guide['group'] = registry[guide['key']]['page_key']
    assert guide['tasks'] and guide['sources']
    for source in guide['sources']:
        assert (ROOT / source).is_file(), source

OUT = ROOT / 'public/manual'
(OUT / 'modules').mkdir(parents=True, exist_ok=True)
ink, muted, teal, line = map(colors.HexColor, ['#193447','#536d80','#087e82','#d4e2eb'])
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('Kicker', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=teal, spaceAfter=9))
styles.add(ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=34, leading=40, textColor=ink, spaceAfter=20))
styles.add(ParagraphStyle('ModuleTitle', fontName='Helvetica-Bold', fontSize=23, leading=28, textColor=ink, spaceAfter=12, keepWithNext=True))
styles.add(ParagraphStyle('TaskTitle', fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=ink, spaceBefore=12, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle('Copy', fontName='Helvetica', fontSize=10, leading=14, textColor=ink, spaceAfter=6))
styles.add(ParagraphStyle('MutedCopy', parent=styles['Copy'], textColor=muted))
styles.add(ParagraphStyle('StepTitle', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=teal, spaceBefore=4, spaceAfter=2, keepWithNext=True))
styles.add(ParagraphStyle('SmallCopy', parent=styles['Copy'], fontSize=8, leading=12, textColor=muted))
styles.add(ParagraphStyle('Contents', fontName='Helvetica', fontSize=10, leading=16, textColor=ink, leftIndent=0, firstLineIndent=0, spaceBefore=6))

def clean(text):
    return str(text).translate(str.maketrans({'—':'-','–':'-','‑':'-','’':"'",'‘':"'",'“':'"','”':'"','…':'...','·':' / ','≥':'>=','→':'->'}))

compact_modules = set()
compact = False

def p(text, style='Copy'):
    selected = styles[style]
    if compact:
        selected = ParagraphStyle(style+'Compact', parent=selected, leading=selected.leading*.9,
                                  spaceBefore=selected.spaceBefore*.5, spaceAfter=selected.spaceAfter*.5)
    return Paragraph(html.escape(clean(text)), selected)

class GuideDoc(BaseDocTemplate):
    def __init__(self, path, title):
        super().__init__(str(path), pagesize=A4, leftMargin=48, rightMargin=48, topMargin=60, bottomMargin=48,
                         title=clean(title), author='SentinelOps', subject='Operator procedures / '+data['edition'])
        self.running_title = title
        self.addPageTemplates(PageTemplate(id='guide', frames=[Frame(48,48,A4[0]-96,A4[1]-108,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=self.decorate))
    def decorate(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(teal); canvas.rect(0,A4[1]-8,A4[0],8,fill=1,stroke=0)
        canvas.setFont('Helvetica-Bold',10); canvas.drawString(48,A4[1]-32,'SentinelOps')
        canvas.setFillColor(muted); canvas.setFont('Helvetica',8)
        canvas.drawRightString(A4[0]-48,A4[1]-32,'OPERATOR FIELD GUIDE')
        canvas.setStrokeColor(line); canvas.line(48,37,A4[0]-48,37)
        canvas.drawString(48,24,'Reviewed '+data['edition']+' / Reference copy - verify current guidance')
        canvas.drawRightString(A4[0]-48,24,str(doc.page))
        canvas.restoreState()
    def afterFlowable(self, flowable):
        if getattr(flowable,'guide_key',None):
            key=flowable.guide_key
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(clean(flowable.guide_title),key,0)
            self.notify('TOCEntry',(0,html.escape(clean(flowable.guide_title)),self.page,key))

def callout(label,text):
    table=Table([[p(label,'StepTitle')],[p(text,'Copy')]],colWidths=[A4[0]-116])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#f2f7fa')),('BOX',(0,0),(-1,-1),.6,line),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,0),7),('BOTTOMPADDING',(0,-1),(-1,-1),7)]))
    return table

def module_story(guide):
    global compact
    compact = guide['key'] in compact_modules
    heading=p(guide['title'],'ModuleTitle'); heading.guide_key=guide['key']; heading.guide_title=guide['title']
    story=[p(guide['group'].upper(),'Kicker'),heading,p(guide['summary']),p('Where to go: '+guide['path'],'SmallCopy'),callout('Access and authority',guide['access']),Spacer(1,10)]
    for index,task in enumerate(guide['tasks'],1):
        opening = [p(f"{index:02d} / {task['title']}",'TaskTitle'),p('Before you begin: '+task['needs'],'MutedCopy')]
        for step_index,step in enumerate(task['steps'],1):
            block = [p(f"{step_index}. {step['title']}",'StepTitle'),p(step['body'])]
            story += [KeepTogether((opening if step_index == 1 else []) + block)]
        story += [KeepTogether([p('How to confirm success','StepTitle'),p(task['result']),p('Stop and check','StepTitle'),p(task['stop'],'MutedCopy')])]
    help_heading = [p('Something is blocking you?','TaskTitle')]
    for problem in guide['problems']:
        story += [KeepTogether(help_heading + [p(problem['symptom'],'StepTitle'),p(problem['action'])])]
        help_heading = []
    if guide['terms']:
        story += [p('Terms in plain language','TaskTitle')]
        for term in guide['terms']:
            story += [KeepTogether([p(term['term'],'StepTitle'),p(term['meaning'])])]
    story += [Spacer(1,10),p('Procedure reference: '+guide['key']+' / '+data['edition'],'SmallCopy')]
    return story

def build(path,title,selected):
    global compact
    compact = False
    story=[]
    if len(selected)>1:
        story += [Spacer(1,55),p('CLARITY. CONTINUITY. CONTROL.','Kicker'),p(title,'CoverTitle'),p('Practical procedures for confident daily operation. Choose the task, check the prerequisites, follow the steps and verify the result.','MutedCopy'),Spacer(1,20),callout('This edition',f"{len(selected)} modules / {sum(len(g['tasks']) for g in selected)} procedures / Reviewed {data['edition']}"),Spacer(1,22)]
        story += [p(item,'MutedCopy') for item in data['principles']]
        story += [PageBreak(),p('Find your workspace','ModuleTitle')]
        toc=TableOfContents();toc.levelStyles=[styles['Contents']];story += [toc,PageBreak()]
    for i,guide in enumerate(selected):
        if i: story.append(PageBreak())
        story.extend(module_story(guide))
    GuideDoc(path,title).multiBuild(story)

for guide in guides:
    target = OUT/'modules'/f"{guide['key']}.pdf"
    build(target,guide['title'],[guide])
    reader = PdfReader(target)
    if len(reader.pages) > 1 and len(reader.pages[-1].extract_text()) < 700:
        # Tighten spacing, never font size, to avoid a nearly empty continuation page.
        compact_modules.add(guide['key'])
        build(target,guide['title'],[guide])
build(OUT/'SentinelOps_User_Manual.pdf','SentinelOps operating manual',guides)
build(OUT/'Sentinel_Nexus_Operator_Manual.pdf','Nexus operating manual',[g for g in guides if g['key'].startswith('nexus.')])
build(OUT/'SentinelOps_Funds_Custody_Operating_Guide.pdf','Unauthorized Debit Clearing',[g for g in guides if g['key']=='funds_custody.workspace'])

def html_manual(selected,title):
    sections=[]
    for g in selected:
        parts=[f"<section id='{g['key']}'><h2>{html.escape(g['title'])}</h2><p>{html.escape(g['summary'])}</p><p><b>Access:</b> {html.escape(g['access'])}</p><p>Navigate to {html.escape(g['path'])}</p>"]
        for t in g['tasks']:
            parts += [f"<h3>{html.escape(t['title'])}</h3><p><b>Before you begin:</b> {html.escape(t['needs'])}</p><ol>"]
            parts += [f"<li><b>{html.escape(s['title'])}</b><p>{html.escape(s['body'])}</p></li>" for s in t['steps']]
            parts += [f"</ol><p><b>Confirm success:</b> {html.escape(t['result'])}</p><p><b>Stop and check:</b> {html.escape(t['stop'])}</p>"]
        parts += ['<h3>Troubleshooting</h3>']+[f"<h4>{html.escape(p['symptom'])}</h4><p>{html.escape(p['action'])}</p>" for p in g['problems']]
        parts += ['<h3>Terms</h3>']+[f"<p><b>{html.escape(t['term'])}:</b> {html.escape(t['meaning'])}</p>" for t in g['terms']]
        sections.append(''.join(parts)+'</section>')
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title><style>body{font:16px/1.7 system-ui;color:#193447;background:#f2f7fa;max-width:960px;margin:auto;padding:24px}section{background:white;padding:28px;border:1px solid #d4e2eb;border-radius:12px;margin:24px 0}h1,h2,h3{line-height:1.3}h2,h3{color:#087e82}a{color:#087e82}@media print{body{background:white}section{break-before:page;border:0}}</style><h1>'+html.escape(title)+'</h1><p>Reviewed '+data['edition']+'</p><nav>'+''.join(f"<p><a href='#{g['key']}'>{html.escape(g['title'])}</a></p>" for g in selected)+'</nav>'+''.join(sections)+'</html>'

(OUT/'sentinelops-user-manual.html').write_text(html_manual(guides,'SentinelOps operating manual'),encoding='utf-8')
(OUT/'sentinel-nexus-operator-manual.html').write_text(html_manual([g for g in guides if g['key'].startswith('nexus.')],'Nexus operating manual'),encoding='utf-8')
manifest={'edition':data['edition'],'catalog_sha256':hashlib.sha256(CATALOG.read_bytes()).hexdigest(),'registry_sha256':hashlib.sha256((ROOT / 'src/policies/modules.json').read_bytes()).hexdigest(),'modules':len(guides),'procedures':sum(len(g['tasks']) for g in guides),'files':{p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.rglob('*.pdf'))}}
(OUT/'operator-guides-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f"Built {len(guides)} module guides and 3 combined manuals; {manifest['procedures']} procedures.")
