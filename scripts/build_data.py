"""Build offline data from archived official Spain sources; reviewed overrides are explicit."""
import json,re,pathlib,html,unicodedata
R=pathlib.Path(__file__).resolve().parents[1]
def load(p):return json.load(open(R/p))
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',str(s).lower()) if unicodedata.category(c)!='Mn')
def number(s):
 if s is None:return None
 m=re.search(r'[-+]?\d[\d.,]*',str(s))
 if not m:return None
 s=m[0]
 if ',' in s:s=s.replace('.','').replace(',','.')
 elif re.fullmatch(r'\d{1,2}\.\d{3}',s):s=s.replace('.','')
 try:return float(s)
 except:return None
mods=load('sources/models.json');manifest=load('sources/manifest.json');catalogeq=load('sources/catalog-equipment.json')
# Reviewed numeric values: local catalog technical pages (PDF page 5 or 7).
# Columns: battery, electric WLTP combined, city, system/motor kW, acceleration,
# AC kW, DC kW, DC10-80 minutes, DC30-80 minutes, AC time+interval, boot L,
# WLTP total PHEV, non-weighted WLTP fuel (not presented as weighted).
reviewed={
'dolphin':[(60.4,427,559,150,7,11,110,36,26,'6 h 12 min · 0–100% · 11 kW trifásico',364,None,None)]*2,
'atto-2':[(45.1,312,463,130,7.9,11,65,37,28,'5,5 h · 0–100% · 11 kW trifásico',400,None,None),(45.1,312,463,130,7.9,11,65,37,28,'5,5 h · 0–100% · 11 kW trifásico',400,None,None),(64.8,430,604,150,7.9,11,155,25,19,'7 h · 0–100% · 11 kW trifásico',450,None,None)],
'dolphin-g-dm-i':[(7.4,40,60,129,8.3,3.3,0,None,None,'2,8 h · 15–100% · 3,3 kW monofásico',425,1020,4.3)]+[(18.3,105,150,156,8.3,6.6,39,26,None,'2,9 h · 15–100% · 6,6 kW monofásico',425,1040,4.5)]*3,
'seal-6-dm-i':[(10.08,55,75,135,8.9,3.3,0,None,None,'3 h · 15–100% · 3,3 kW monofásico',491,1505,4.4),(19,105,140,156,8.5,6.6,26,None,23,'2,7 h · 15–100% · 6,6 kW monofásico',491,1455,4.8)],
'seal-6-dm-i-touring':[(10.08,50,75,135,8.9,3.3,0,None,None,'3 h · 15–100% · 3,3 kW monofásico',500,1350,4.8),(19,100,130,156,8.5,6.6,26,None,23,'2,7 h · 15–100% · 6,6 kW monofásico',500,1350,5)],
'seal-u':[(71.8,420,576,160,9.3,11,115,42,27,'7,5 h · 0–100% · 11 kW trifásico',425,None,None),(87,500,674,160,9.6,11,140,43,28,'9,3 h · 0–100% · 11 kW trifásico',425,None,None)],
'tang':[(108.8,530,681,380,4.9,11,170,46,30,'11 h · 0–100% · 11 kW trifásico',235,None,None)]}
# Catalog technical-table values missing from the tuples above, per version
# (sources/*-ocr.txt, seal-u-dm-i-ocr.json). None where the catalog cell is blank.
# Seal 6 'Par máximo del sistema 122' is the combustion-engine figure, so not used.
extra={
'dolphin':[dict(torque=310,topSpeed=160,weight=1658)]*2,
'atto-2':[dict(torque=290,topSpeed=160,weight=1570,towUnbraked=750,bootMax=1340)]*2+[dict(torque=310,topSpeed=160,weight=1720,towUnbraked=750,bootMax=1370)],
'seal-u':[dict(torque=310,topSpeed=175,weight=2020,tow=1300,towUnbraked=750,bootMax=1440),dict(torque=330,topSpeed=175,weight=2147,tow=1300,towUnbraked=750,bootMax=1440)],
'tang':[dict(topSpeed=190,weight=2630,tow=1500,towUnbraked=750,bootMax=1655)],
'dolphin-g-dm-i':[dict(torque=210,topSpeed=180,tank=42,weightedFuel=2.6,weight=1440,tow=750,towUnbraked=750,bootMax=1225)]+[dict(torque=210,topSpeed=180,tank=42,weightedFuel=1.4,weight=1555,tow=750,towUnbraked=750,bootMax=1225)]*3,
'seal-6-dm-i':[dict(topSpeed=180,tank=65,weightedFuel=2.3,bootMax=1370),dict(topSpeed=180,tank=65,weightedFuel=1.5,weight=1765,bootMax=1370)],
'seal-6-dm-i-touring':[dict(topSpeed=180,tank=65,weightedFuel=2.6,weight=1710,bootMax=1535),dict(topSpeed=180,tank=65,weightedFuel=1.7,weight=1805,bootMax=1535)],
'atto-2-dm-i':[dict(tow=750,towUnbraked=750,bootMax=1335)]*2,
'seal-u-dm-i':[dict(torque=300,tank=60),dict(torque=300,tank=60),dict(torque=550,tank=60)]}
# Chinese market class by length/positioning, and body style.
segments={'dolphin-surf':('A00','hatch'),'dolphin':('A0','hatch'),'dolphin-g-dm-i':('A0','hatch'),'atto-2':('A0','suv'),'atto-2-dm-i':('A0','suv'),'atto-3-evo':('A','suv'),'seal':('B','sedan'),'seal-u':('B','suv'),'seal-u-dm-i':('B','suv'),'sealion-7':('B','suv'),'seal-6-dm-i':('B','sedan'),'seal-6-dm-i-touring':('B','wagon'),'tang':('C','suv')}
fields=['battery','range','city','power','accel','ac','dc','dc1080','dc3080','acTime','boot','total','fuel']
dimensions={'dolphin':[4290,1770,1570,2700],'atto-2':[4310,1830,1675,2620],'dolphin-g-dm-i':[4160,1825,1570,2610],'seal-6-dm-i':[4840,1875,1495,2790],'seal-6-dm-i-touring':[4840,1875,1505,2790],'seal-u':[4785,1890,1668,2765],'tang':[4970,1955,1745,2820]}
pricepromo={'dolphin-surf':('Active',18780,12955),'atto-2':('Comfort',31921,24796),'dolphin':('Comfort',28990,21865),'seal':('Comfort',40775.34,33885),'atto-3-evo':('Design',36313,28888),'seal-u':('Comfort',37486,31161),'sealion-7':('Comfort',45150,38475),'dolphin-g-dm-i':('Active',21725,16675),'atto-2-dm-i':('Active',25990,20940),'seal-u-dm-i':('Boost',35790,29990),'seal-6-dm-i':('Boost',31790,26740),'seal-6-dm-i-touring':('Boost',33290,28240)}
consumption={'dolphin':[15.9,15.9],'atto-2':[16,16,17.4],'dolphin-g-dm-i':[15.8,16,16,16],'seal-6-dm-i':[14,15.5],'seal-6-dm-i-touring':[14.6,16.4],'seal-u':[19.9,20.5],'tang':[24]}
notes={
'atto-2':[['配置器摘要写城市续航 450 km，采用 catalog／正式对比表的 463 km。','El resumen indica 450 km urbanos; se usan 463 km del catálogo y comparador.']],
'dolphin-surf':[['Active 摘要的城市续航与参数表不一致；采用 catalog／参数表 356 km。接口原文 CSS2 为拼写差异，catalog 为 CCS2。配置器 JSON 的各版本设备项重复，配置采用 catalog；Comfort 才有座椅加热、360° 摄像头和无线充电。','El resumen Active discrepa; se usan 356 km urbanos del catálogo/comparador. El catálogo confirma CCS2 frente a CSS2 en el JSON. El JSON repite equipamiento; se usa catálogo: calefacción, cámara 360° y carga inalámbrica solo en Comfort.']],
'seal-u-dm-i':[['采用正式参数表逐版本数据；摘要所称 Comfort 四驱及 Design 继承大电池与表格不符。Boost／Comfort 前驱，Design 四驱、18.3 kWh。城市续航在 catalog 和新版对比表间有差异，采用当前对比表并保留 catalog。加权油耗：对比表 0.9／0.4／1.2 L，catalog 2.2／1.5／3.2 L，差异大，显示对比表数值，购车时以车辆认证为准。','Se usa la tabla por versión: Boost/Comfort FWD; Design AWD y 18,3 kWh. El resumen contiene referencias inconsistentes a AWD/batería. La autonomía urbana difiere del catálogo anterior; se mantiene el comparador actual. Consumo ponderado: comparador 0,9/0,4/1,2 L; catálogo 2,2/1,5/3,2 L. Se muestra el comparador; verificar homologación.']],
'atto-2-dm-i':[['当前配置器对比表（文件日期 2026-05-03）Boost：115 km／18.3 kWh／160 kW／1,100 km。catalog ES-V3：90 km／18 kWh／156 kW／1,000 km。此处采用当前对比表，购车时核对具体车辆认证；原 catalog 可查看。','Comparador actual (2026-05-03), Boost: 115 km/18,3 kWh/160 kW/1.100 km. Catálogo ES-V3: 90 km/18 kWh/156 kW/1.000 km. Se usa el comparador actual; comprobar homologación de la unidad.']],
'sealion-7':[['Excellence JSON 混用了 mph 与 km/h（最高速度写 133）；采用西班牙 catalog 的 215 km/h、0–100 km/h 4.5 s。','El JSON Excellence mezcla mph y km/h (133). Se usa el catálogo español: 215 km/h y 0–100 km/h en 4,5 s.']],
'seal-6-dm-i':[['catalog 还列有 Comfort Lite，但当前配置器只有 Boost、Comfort，故未列为可选在售版本。充电脚注泛指 11 kW，与版本表 3.3／6.6 kW 不一致，采用版本表。','El catálogo incluye Comfort Lite, no seleccionable en el configurador actual. La nota genérica menciona 11 kW; se usa la tabla por versión de 3,3/6,6 kW.']],
'seal-6-dm-i-touring':[['catalog 还列有 Comfort Lite，但当前配置器只有 Boost、Comfort，故未列为可选在售版本。后备箱按后排头枕高度口径 500 L；按车顶高度为 675 L。充电采用版本表 3.3／6.6 kW。','Comfort Lite aparece solo en catálogo, no seleccionable actualmente. Maletero 500 L hasta reposacabezas; 675 L hasta techo. Carga CA: tabla por versión de 3,3/6,6 kW.']],
'tang':[['配置器后台版本别名含 EV-NL；页面使用西班牙 catalog 的 Flagship 名称，价格保留西班牙配置器 EUR 数据。235 L 为三排座椅使用状态；收起第三排 940 L。','El alias interno contiene EV-NL; se muestra Flagship del catálogo español y precio EUR del configurador español. Maletero 235 L con tres filas; 940 L abatiendo la tercera.']]}

def technical(params,v):
 for group,items in params.items():
  for key,value in items.items():
   k=norm(key);g=norm(group)
   pairs=[]
   if 'capacidad de la bateria' in k:pairs=[('battery',value)]
   elif 'autonomia' in k:
    if 'electrica' in k:pairs=[('city' if any(w in k for w in ['ciudad','urbano']) else 'range',value)]
    elif 'combinad' in k:pairs=[('total',value)]
   elif ('potencia max' in k or 'potencia máx' in k) and ('carga' in k or 'recarga' in k):pairs=[('ac' if re.search(r'\b(ac|ca)\b',k) else 'dc',value)]
   elif 'potencia maxima' in k and (k.endswith('(kw)') or 'total del sistema' in k):
    if 'motor' not in k:pairs=[('power',value)]
   elif 'aceleracion' in k:pairs=[('accel',value)]
   elif 'tipo de traccion' in k or 'tipo de transmision' in k:v['drive']=str(value)
   elif 'puerto de' in k:v['port']='CCS2' if str(value)=='CSS2' else str(value)
   elif 'par maximo' in k and 'motor' not in k:pairs=[('torque',value)]
   elif 'velocidad maxima' in k:pairs=[('topSpeed',value)]
   elif ('consumo' in k and 'combinad' in k):
    if 'combustible' in k:pairs=[('weightedFuel' if 'ponderad' in k else 'fuel',value)]
    elif 'kwh' in k:pairs=[('consumption',value)]
   elif 'peso en vacio' in k:pairs=[('weight',value)]
   elif 'remolque' in k:
    parts=str(value).split('/')
    if 'sin freno /' in k and len(parts)==2:pairs=[('towUnbraked',parts[0]),('tow',parts[1])]
    else:pairs=[('towUnbraked' if 'sin freno' in k else 'tow',value)]
   elif 'deposito' in k and 'combustible' not in g and 'tipo' not in k:pairs=[('tank',value)]
   elif 'maletero' in k:
    if 'delantero' in k:pairs=[('frunk',value)]
    elif 'abatid' not in k and 'arriba/abajo' not in k:pairs=[('boot',value)]
    elif 'arriba/abajo' in k:pairs=[('boot',str(value).split('/')[0]),('bootMax',str(value).split('/')[-1])]
    else:pairs=[('bootMax',value)]
   elif key in ['Longitud','Anchura','Altura','Distancia entre ejes']:pairs=[({'Longitud':'length','Anchura':'width','Altura':'height','Distancia entre ejes':'wheelbase'}[key],value)]
   for field,val in pairs:v[field]=number(val)
   if ('carga' in k or 'recarga' in k) and not 'potencia' in k and ('tiempo' in k or '%' in k):
    if re.search(r'\b(ac|ca)\b',k):
     if 'trifas' in k or not v.get('acTime'):
      interval=re.search(r'(\d+)\s*%?\s*[-–]\s*(\d+)\s*%',key)
      kw=re.search(r'(\d+(?:[.,]\d+)?)\s*kW',key,re.I)
      mode='trifásico' if 'trifas' in k else 'monofásico' if 'monofas' in k else ''
      v['acTime']=str(value)+(' · '+interval[1]+'–'+interval[2]+'%' if interval else '')+(' · '+kw[1]+' kW '+mode if kw else '')
    elif re.search(r'\b(dc|cc)\b',k):
     if re.search(r'10\s*%?\s*[-–]\s*80',k):v['dc1080']=number(value)
     if re.search(r'30\s*%?\s*[-–]\s*80',k):v['dc3080']=number(value)

EQ_GROUP_RE=r'exterior|interior|infoentre|infotain|comunica|seguridad|asisten|confort|comodidad|conveniencia|tecnologia'
FEATURES={
'panoramic':r'techo.*panoram', 'heatedWheel':r'volante.*calef', 'heatedRear':r'asientos traseros calef',
'heatedFront':r'asiento.*conductor.*calef',
'ventilatedFront':r'asiento.*conductor.*ventil',
'camera360':r'camara.*360','hud':r'head.?up|\(hud\)','tailgate':r'porton.*electric',
'frontSensors':r'sensores.*aparcamiento.*delanter','rearSensors':r'sensores.*aparcamiento.*traser',
'heatPump':r'bomba de calor','v2l':r'v2l','acc':r'\(acc\)','aeb':r'\(aeb\)','blindSpot':r'\(bsd\)',
'wireless':r'(carga|cargador|toma de carga).*inalamb','phone':r'apple carplay','driverElectric':r'(asiento|regulacion).*conductor.*electric',
'lumbar':r'(conductor.*lumbar|lumbar.*conductor)','google':r'google integrado'}
def features(eq):
 flat=[(norm(k),val) for d in eq.values() for k,val in d.items()];out={}
 for f,pat in FEATURES.items():
  vals=[val for k,val in flat if re.search(pat,k)]
  if not vals:out[f]=None
  elif any(val=='Sí' for val in vals):out[f]=True
  elif any(val=='Opcional' for val in vals):out[f]='Opcional'
  elif any(val=='—' for val in vals):out[f]=False
  else:out[f]=None
 for field,pat in [('screen',r'pantalla tactil'),('speakers',r'(sonido|audio).*altavoces')]:
  found=[]
  for key,val in flat:
   if val!='Sí' or not re.search(pat,key):continue
   m=re.search(r'(\d+[.,]?\d*)\s*(?:"|pulgadas)' if field=='screen' else r'(\d+)\s*altavoces',key)
   if m:found.append(number(m[1]))
  out[field]=max(found) if found else None
 return out

families=[];versions=[]
for m in mods:
 slug=m['btnList'][0]['link'].split('/')[-1];apis=load(f'sources/{slug}-api.json');cmp_path=R/f'sources/{slug}-compare.json';cmp=json.load(open(cmp_path)) if cmp_path.exists() else []
 fam={'id':slug,'name':m['title'].removeprefix('BYD '),'type':'BEV' if m['type']=='electric' else 'PHEV','segment':segments[slug][0],'body':segments[slug][1],'description':m['desc'],'image':f'assets/{slug}.webp','sources':manifest[slug],'notes':notes.get(slug,[])}
 families.append(fam)
 for i,a in enumerate(apis):
  ver=a['productNameAlias']['val'];ver='Flagship' if slug=='tang' else ver
  v={'id':slug+'-'+ver.lower().replace(' ','-'),'family':slug,'name':fam['name'],'version':ver,'type':fam['type'],'msrp':float(a['productPrice']),'cash':None,'finance':None,'seats':4 if slug=='dolphin-surf' else 7 if slug=='tang' else 5,'specSource':None,'equipmentSource':None}
  imageurl=a['imageList'][0]['imagePc'];v['image']=f'assets/{slug}-{i}'+pathlib.Path(imageurl).suffix
  cv=next((b for b in cmp if b['versionName'].lower().startswith(ver.lower())),None)
  if cv:
   technical(cv['parameterList'],v);v['specSource']='compare';v['equipmentSource']='compare'
   v['equipment']={g:d for g,d in cv['parameterList'].items() if re.search(EQ_GROUP_RE,norm(g))}
   v['technicalOriginal']={g:d for g,d in cv['parameterList'].items() if not re.search(EQ_GROUP_RE,norm(g))}
  else:v['equipment']={};v['technicalOriginal']={}
  if slug in reviewed:
   v.update(dict(zip(fields,reviewed[slug][i])));v['specSource']='catalog';v['consumption']=consumption[slug][i]
   v.update(dict(zip(['length','width','height','wheelbase'],dimensions[slug])))
   v['drive']='AWD' if slug=='tang' else 'FWD';v['port']='Type 2' if v['dc']==0 and slug=='dolphin-g-dm-i' else 'CCS2'
  if slug in catalogeq:
   eq=catalogeq[slug].get(ver) or next((d for name,d in catalogeq[slug].items() if name.lower()==ver.lower()+' awd'),None)
   if eq:v['equipment']=eq;v['equipmentSource']='catalog'
  if slug in extra:v.update(extra[slug][i])
  if slug=='seal-u-dm-i':v['power']=[160,160,238][i];v['powerSource']='catalog'
  if slug=='sealion-7':v['topSpeed']=215;v['accel']=6.7 if i==0 else 4.5
  if slug=='dolphin-surf' and i==0:v['acTime']='3 h 30 min · 0–100% · 11 kW trifásico'
  if slug=='atto-2-dm-i':v['dc']=0;v['port']='Type 2'
  for key in fields+['torque','topSpeed','consumption','weightedFuel','frunk','drive','port','tank','weight','tow','towUnbraked','bootMax']:
   v.setdefault(key,None)
  v['segment'],v['body']=segments[slug]
  # Fuel-only share of the official WLTP total; cross-checks with tank / fuel × 100 within ~3%.
  v['fuelRange']=round(v['total']-v['range']) if v['type']=='PHEV' and v['total'] and v['range'] else None
  if slug in pricepromo and ver==pricepromo[slug][0]:v['cash'],v['finance']=pricepromo[slug][1:]
  v['priceColor']=(a['specification'].get('colors') or {}).get('list',[])
  # Swatch icons stay on byd.com (shown when online; names and surcharges work offline).
  v['priceColor']=[{'name':c.get('nameInLang') or c['name'],'price':float(c.get('price') or 0),'icon':'https://www.byd.com'+c['icon'] if c.get('icon') else None} for c in v['priceColor']]
  spec=a['specification']
  v['interiors']=[x.get('nameInLang') or x['name'] for x in (spec.get('interior') or {}).get('list',[])]
  v['wheels']=next((x.get('nameInLang') or x['name'] for x in (spec.get('wheels') or {}).get('list',[])),None)
  v['features']=features(v['equipment'])
  # Repair extraction gaps using specific official config summaries (not inherited marketing text).
  if slug=='atto-2':v['features'].update({'screen':10.1 if i==0 else 12.8,'speakers':6 if i==0 else 8,'camera360':i>0,'frontSensors':i>0,'heatedWheel':i>0,'heatedFront':i>0,'wireless':i>0})
  if slug in ['seal-6-dm-i','seal-6-dm-i-touring']:v['features']['speakers']=6 if i==0 else 8
  if slug=='dolphin':v['features'].update({'camera360':True,'screen':12.8,'panoramic':i==1,'wireless':i==1,'ventilatedFront':i==1,'heatedFront':True})
  # Remove OCR footnote bleed; keep original catalog available for verification.
  for group,items in v['equipment'].items():
   for key in list(items):
    if len(key)>200 or 'información detallada. El cable' in key:
     val=items.pop(key);short=key.split('1.')[0].split(' de navegación en tiempo')[0].split(' información detallada. El cable')[0].strip();items[short]=val
  v['summaryOriginal']=[s.strip().removeprefix('●').strip() for s in a['salesTopic'] if not s.lower().startswith('todo')]
  if slug=='tang':v['summaryOriginal']=list(dict.fromkeys(v['summaryOriginal']))
  versions.append(v)
# Spanish source condition paragraphs (kept as original, links provided alongside bilingual explanation).
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
  if t=='br' and not self.skip:self.parts.append('\n')
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip=max(0,self.skip-1)
  if t in ['p','li','h1','h2','h3','div'] and not self.skip:self.parts.append('\n')
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
# Warranty clause from each archived model page (same wording across the range; DOLPHIN G adds SOH).
for f in families:
 t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape((R/f"sources/{f['id']}-model.html").read_text(errors='ignore'))))
 w={}
 m=re.search(r'Bater[ií]a (\d+) años/([\d.]+) km, Motor (\d+) años/([\d.]+) km y General (\d+) años/([\d.]+) km',t)
 if m:w={'battery':[int(m[1]),int(m[2].replace('.',''))],'motor':[int(m[3]),int(m[4].replace('.',''))],'general':[int(m[5]),int(m[6].replace('.',''))],'original':m[0]}
 else:
  m=re.search(r'garant[ií]a de fabricante de (\d+) años / ([\d.]+) km, mientras que la Blade Battery está protegida hasta (\d+) años / ([\d.]+) km',t)
  if m:w={'general':[int(m[1]),int(m[2].replace('.',''))],'battery':[int(m[3]),int(m[4].replace('.',''))],'motor':None,'original':m[0]}
 soh=re.search(r'\(SOH\) garantizado de al menos el (\d+) ?%',t)
 if w and soh:w['soh']=int(soh[1])
 f['warranty']=w or None
for f in families:
 p=R/f"sources/{f['id']}-promo.html"
 if p.exists():
  parser=Text();parser.feed(p.read_text());s='\n'.join(re.sub(r'\s+',' ',line).strip() for line in ''.join(parser.parts).splitlines() if line.strip())
  anchors=[s.find(k) for k in ['*BYD','Oferta válida para Financiación','Oferta válida para BYD','Precio Recomendado','PVPR']]
  idx=min((i for i in anchors if i>=0),default=-1)
  f['promotionOriginal']=s[idx:] if idx>=0 else s
  f['promotionOriginal']=f['promotionOriginal'][:18000]
 else:f['promotionOriginal']=None
 f['promotionExpiry']='2026-10-31' if f['id']!='tang' else None
out={'retrieved':'2026-10-12','market':'España · Península y Baleares','families':families,'versions':versions,'methodology':{'zh':'版本名单按西班牙官网当前导航与配置器。参数采用当前官网对比表或西班牙 catalog；缺失保留未知。价格以默认配置建议零售价为统一比较基准；广告现金价与融资价仅列已明确对应的版本，不推算其他版本优惠。融资价可能包含补贴预支、CAE 和贷款条件，不是最终总付款。','es':'Versiones según navegación y configurador español actuales. Datos del comparador oficial o catálogo de España; lo no publicado queda desconocido. Comparación de precios por PVP de configuración base; ofertas al contado/financiadas solo para versiones expresamente identificadas. El precio financiado puede incluir anticipo de ayudas, CAE y condiciones de crédito; no equivale al importe total a plazos.'}}
(R/'data.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));(R/'data.js').write_text('var BYD_DATA = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
print('Built',len(families),'models,',len(versions),'versions,',sum(sum(len(g) for g in v['equipment'].values()) for v in versions),'equipment cells')
for v in versions:print(v['id'],v['range'],v['power'],v['ac'],v['dc'],len(v['equipment']),v['features'].get('screen'))
