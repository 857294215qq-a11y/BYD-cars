"""Download public official BYD Spain snapshots (curl uses system TLS)."""
import json,re,pathlib,subprocess,concurrent.futures,urllib.parse
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Attrs(HTMLParser):
 def __init__(self):super().__init__();self.values=[]
 def handle_starttag(self,t,a):self.values.extend(v for k,v in a if v)
def attrs(path):
 p=Attrs();p.feed(path.read_text());return '\n'.join(p.values)
def fetch(job):
 dest,url=job;dest.parent.mkdir(parents=True,exist_ok=True)
 url=urllib.parse.quote(url,safe=':/?=&%')
 x=subprocess.run(['curl','-sSL','--fail','--max-time','60','-o',str(dest),url],capture_output=True)
 return dest.name,x.returncode,dest.stat().st_size if dest.exists() else 0
mods=json.load(open(ROOT/'sources/models.json'));jobs=[];manifest={}
for m in mods:
 slug=m['btnList'][0]['link'].split('/')[-1];c=attrs(ROOT/f'sources/{slug}-config.html');s=attrs(ROOT/f'sources/{slug}-model.html')
 api=re.search(r'https://cms-api[^\s`\'"]+',c).group(0)
 comp=re.findall(r'dataJson\s*:\s*[`\'"]([^`\'"]+)',c)
 pdf=re.findall(r'(?:/material|/content)[^"\'`<>]*?\.pdf',s)[0]
 manifest[slug]={'api':api,'compare':'https://www.byd.com'+comp[0] if comp else None,'catalog':'https://www.byd.com'+pdf,'model':'https://www.byd.com'+m['btnList'][1]['link'],'config':'https://www.byd.com'+m['btnList'][0]['link'],'promo':'https://www.byd.com'+m['offerBtn']['link'],'image':'https://www.byd.com'+m['imgPc']}
 jobs.extend([(ROOT/f'sources/{slug}-api.json',api),(ROOT/f'catalog/{slug}.pdf',manifest[slug]['catalog']),(ROOT/f'assets/{slug}.webp',manifest[slug]['image'])])
 if comp:jobs.append((ROOT/f'sources/{slug}-compare.json',manifest[slug]['compare']))
 if m['offerBtn']['link']:jobs.append((ROOT/f'sources/{slug}-promo.html',manifest[slug]['promo']))
(ROOT/'sources/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for r in ex.map(fetch,jobs):print(r,flush=True)
