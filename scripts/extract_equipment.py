"""Extract catalog equipment using PDF text baselines; OCR repairs unmapped fonts."""
import json,re,pathlib,statistics
import pdfplumber
ROOT=pathlib.Path(__file__).resolve().parents[1]
JOBS={'dolphin':([2,3],['Comfort','Design']),'seal-u':([2,3,4],['Comfort','Design']),'tang':([2,3,4],['Flagship']),'dolphin-g-dm-i':([4,5],['Active','Boost','Comfort','Sport']),'seal-6-dm-i':([4,5],['Boost','Comfort Lite','Comfort']),'seal-6-dm-i-touring':([4,5],['Boost','Comfort Lite','Comfort']),'atto-2':([4,5],['Active','Boost','Comfort'])}
JOBS.update({'dolphin-surf':([4,5],['Active','Boost','Comfort']),'seal':([4,5],['Comfort','Design','Excellence AWD']),'atto-3-evo':([4,5],['Design','Excellence']),'sealion-7':([4,5,6],['Comfort','Design AWD','Excellence AWD']),'seal-u-dm-i':([2,3],['Boost','Comfort','Design']),'atto-2-dm-i':([4,5],['Active','Boost'])})
CATEGORIES=['Exterior','Interior','Comunicación e infoentretenimiento','Seguridad','Sistemas de Asistencia a la Conducción','Confort y eficiencia','Tecnología']
results={}
for slug,(pages,versions) in JOBS.items():
 ocr={a['page']:a['rows'] for a in json.load(open(ROOT/f'sources/{slug}-equipment-ocr.json'))};out={v:{} for v in versions}
 with pdfplumber.open(ROOT/f'catalog/{slug}.pdf') as pdf:
  for n in pages:
   page=pdf.pages[n-1];cs=page.chars
   marks=[c for c in cs if c['text'] in ['●','○','—'] and c['x0']>page.width*.5]
   colxs=sorted(set(round(c['x0']) for c in marks))
   # Repeated column positions (single occasional font artifacts ignored).
   colxs=[x for x in colxs if sum(abs(c['x0']-x)<2 for c in marks)>4]
   merged=[]
   for x in colxs:
    if not merged or x-merged[-1]>15:merged.append(x)
   colxs=merged
   if len(colxs)!=len(versions):print('COLUMN CHECK',slug,n,colxs);continue
   cut=colxs[0]-12
   lines=[]
   for c in sorted(cs,key=lambda c:(-c['matrix'][5],c['x0'])):
    y=page.height-c['matrix'][5]
    if lines and abs(y-lines[-1]['baseline'])<2:lines[-1]['chars'].append(c)
    else:lines.append({'baseline':y,'chars':[c]})
   group=None;lastkey=None
   offsets=[]
   for line in lines:
    left=[c for c in line['chars'] if c['x0']<cut]
    label=''.join(c['text'] for c in sorted(left,key=lambda c:c['x0'])).strip()
    if not left or '�' in label or '(cid:' in label:continue
    matches=[r for r in ocr[n] if r['x']<cut/page.width and r['text'].strip()==label]
    if matches:
     mid=statistics.mean(c['top']+c['height']/2 for c in left)
     offsets.append(mid-matches[0]['y']*page.height)
   offset=statistics.median(offsets) if offsets else 7.5
   for line in lines:
    cc=sorted(line['chars'],key=lambda c:c['x0']);left=[c for c in cc if c['x0']<cut];label=''.join(c['text'] for c in left).strip()
    cells=[next((c['text'] for c in cc if abs(c['x0']-x)<4 and c['text'] in ['●','○','—']),None) for x in colxs]
    if label and ('�' in label or '(cid:' in label or '\x01' in label or any(ord(c)>60000 for c in label)):
     mid=statistics.mean(c['top']+c['height']/2 for c in left)
     candidates=[r for r in ocr[n] if r['x']<cut/page.width and abs(r['y']*page.height+offset-mid)<3]
     if candidates:label=' '.join(r['text'] for r in sorted(candidates,key=lambda r:r['x']))
     else:continue
    label=re.sub(r'\s+',' ',label)
    matching=next((k for k in CATEGORIES if label.lower().startswith(k.lower())),None)
    if matching and not any(cells):group=matching;lastkey=None;continue
    if label.startswith('Colores') or label.startswith('Interior Colour'):group=None;continue
    if not group or not label:continue
    if bool(re.match(r'^\d+[.,]\s',label)) or label.startswith('*') or label.startswith('Toda la') or 'www.' in label:group=None;continue
    if any(cells):
     lastkey=label
     for v,val in zip(versions,cells):out[v].setdefault(group,{})[label]={'●':'Sí','○':'Opcional','—':'—','i':'—'}.get(val,None)
    elif lastkey and label not in versions and not label.startswith('Colores') and len(label)<180 and not re.search(r'\d+\.\s?(Apple|El |Para |La |Los )|^de navegaci|^10 años|^Apple CarPlay',label) and not re.match(r'^[.,*]|^[1234]\s|^Póngase|^El sistema|^La activ|^países',label):
     # Wrapped second line belongs to preceding equipment row.
     for v in versions:
      g=out[v][group]
      if lastkey in g:g[lastkey+' '+label]=g.pop(lastkey)
     lastkey+=' '+label
 results[slug]=out
 print(slug,{v:sum(len(g) for g in d.values()) for v,d in out.items()})
(ROOT/'sources/catalog-equipment.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
