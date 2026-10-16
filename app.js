(() => {
'use strict';
const D=BYD_DATA,C=BYDCore,I=BYDI18N;
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const VIEWS=['catalog','model','rank','cost','compare','learn','quote'];
const COST_DEFAULT={km:1500,home:0.15,pub:0.50,homeShare:0.8,petrol:1.55,ref:6.5,auto:true,phevShare:0.6};
function parseHash(){const [view,sub='']=location.hash.slice(1).split('/');return VIEWS.includes(view)?{view,sub:decodeURIComponent(sub)}:{view:'catalog',sub:''};}
// Storage can throw (blocked site data, sandboxed previews); never let it stop the first render.
let saved={};try{const v=JSON.parse(localStorage.getItem('byd-guide-v1')||'{}');if(v&&typeof v==='object')saved=v;}catch{}
let storedTheme=null;try{storedTheme=localStorage.getItem('byd-theme');}catch{}
const savedTheme = storedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const S={lang:saved.lang==='es'?'es':'zh',theme:saved.theme||savedTheme,...parseHash(),type:'',family:'',query:'',price:'msrp',budget:0,sort:'',seg:'',body:'',selected:(saved.selected||[]).filter(id=>D.versions.some(v=>v.id===id)).slice(0,4),familyVersion:{},rankSort:'total',rankDir:'',diff:false,eqQuery:'',cost:{...COST_DEFAULT,...(saved.cost||{})},quoteColor:{}};
document.documentElement.dataset.theme = S.theme;
let modalId=null,toastTimer;
const t=k=>I.strings[k]?.[S.lang==='es'?1:0]??k;
const text=(zh,es)=>S.lang==='es'?es:zh;
const locale=()=>S.lang==='es'?'es-ES':'zh-CN';
const fmt=(n,d=1)=>n==null?t('unknown'):new Intl.NumberFormat(locale(),{maximumFractionDigits:d}).format(n);
const money=n=>n==null?t('unknown'):new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR',maximumFractionDigits:Number.isInteger(n)?0:2}).format(n);
const cv=n=>Math.round(n*1.359621617);
const vget=id=>D.versions.find(v=>v.id===id),fget=id=>D.families.find(v=>v.id===id);
const icon=(name)=>{const p={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',check:'<path d="m5 12 4 4L19 6"/>',screen:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',print:'<path d="M7 8V3h10v5M7 17H4V9h16v8h-3"/><path d="M7 13h10v8H7z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/>',moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',sparkle:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'};return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.arrow}</svg>`;};
const btn=(label,action,id='',classes='')=>`<button class="btn ${classes}" data-action="${action}" ${id?`data-id="${esc(id)}"`:''}>${label}</button>`;
const typePill=type=>`<span class="pill ${type==='BEV'?'ev':'phev'}">${t(type==='BEV'?'bev':'phev')}</span>`;
const segmented=(action,active,opts)=>`<div class="seg" data-action-group="${action}"><div class="seg-glider" aria-hidden="true"></div>${opts.map(([val,label])=>`<button data-action="${action}" data-id="${val}" aria-pressed="${active===val}">${label}</button>`).join('')}</div>`;
const typeSeg=(action,active)=>segmented(action,active,[['',t('all')],['BEV',t('bev')],['PHEV',t('phev')]]);
const selected=id=>S.selected.includes(id);
const MOD_KEY=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'⌘':'Ctrl';
function save(){try{localStorage.setItem('byd-guide-v1',JSON.stringify({lang:S.lang,selected:S.selected,cost:S.cost,theme:S.theme}));}catch{}}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('on'),3000);}
// Capsule indicators for segmented controls, chips, sub-tabs and the nav.
// Position lives in --gx (scale is free for the press "lens"). Many controls are re-rendered on click,
// so the last on-screen position is remembered briefly and a new capsule slides from there.
const gliderMemo=new Map();
const gliderKey=seg=>S.view+':'+(seg.dataset.actionGroup||seg.querySelector(':scope > button[data-action]')?.dataset.action||seg.className);
function syncGliders(container=document){
 if(typeof window==='undefined'||!container)return;
 const SEL='.seg, .subnav, .chips, .nav-links';const list=container.matches?.(SEL)?[container]:Array.from(container.querySelectorAll?.(SEL)||[]);
 list.forEach(seg=>{
  if(seg.classList.contains('is-pressing'))return;
  const active=seg.querySelector(':scope > [aria-pressed="true"], :scope > [aria-selected="true"], :scope > [aria-current="page"]');
  let glider=seg.querySelector(':scope > .seg-glider');
  if(!glider){
   glider=document.createElement('div');
   glider.className='seg-glider';
   glider.setAttribute('aria-hidden','true');
   seg.prepend(glider);
  }
  if(active&&seg.offsetWidth>0&&active.offsetWidth>0){
   if(glider.style.opacity!=='1'){
    const key=gliderKey(seg),m=gliderMemo.get(key);gliderMemo.delete(key);
    glider.style.transition='none';
    if(m&&performance.now()-m.t<900&&!reduceMotion()){
     glider.style.setProperty('--gx',`${m.x}px`);glider.style.width=`${m.w}px`;
     if(m.lifted)glider.classList.add('settling');
    }else{glider.style.setProperty('--gx',`${active.offsetLeft}px`);glider.style.width=`${active.offsetWidth}px`;}
    glider.style.opacity='1';glider.offsetWidth;glider.style.transition='';glider.classList.remove('settling');
   }
   glider.style.setProperty('--gx',`${active.offsetLeft}px`);
   glider.style.width=`${active.offsetWidth}px`;
  }else if(!active){
   glider.style.opacity='0';
  }
 });
}
// Liquid press (after iOS 27 Liquid Glass): pressing lifts the capsule into a clear lens that swells past
// the track and magnifies the label under it; dragging scrubs across options; releasing picks one.
const LIQUID='.seg, .subnav, .chips';
let liq=null;
const liqButtons=el=>[...el.querySelectorAll(':scope > button:not(:disabled)')];
function liqMove(btn,x){
 const {el,g}=liq,w=btn.offsetWidth;
 let gx=btn.offsetLeft;
 if(x!=null){const first=liq.btns[0],last=liq.btns[liq.btns.length-1];gx=Math.max(first.offsetLeft,Math.min(last.offsetLeft+last.offsetWidth-w,x-w/2));}
 g.style.setProperty('--gx',`${gx}px`);g.style.width=`${w}px`;g.style.opacity='1';
 liq.btns.forEach(b=>b.classList.toggle('lens-target',b===btn));liq.cur=btn;
}
function liqLocalX(e){const r=liq.el.getBoundingClientRect();return e.clientX-r.left-liq.el.clientLeft+liq.el.scrollLeft;}
document.addEventListener('pointerdown',e=>{
 if(e.button!==0||reduceMotion())return;
 const el=e.target.closest(LIQUID),b=e.target.closest('button');
 if(!el||!b||b.parentElement!==el)return;
 const g=el.querySelector(':scope > .seg-glider');if(!g)return;
 // Touch on horizontally scrolling rows keeps native scrolling: lens only, no scrub.
 const scrub=e.pointerType!=='touch'||el.matches('.seg');
 liq={el,g,btns:liqButtons(el),start:b,cur:b,scrub,id:e.pointerId,x0:e.clientX,moved:false};
 el.classList.add('is-pressing');liqMove(b);
},true);
document.addEventListener('pointermove',e=>{
 if(!liq||e.pointerId!==liq.id||!liq.scrub)return;
 if(!liq.moved&&Math.abs(e.clientX-liq.x0)<5)return;
 liq.moved=true;liq.el.classList.add('is-scrubbing');
 const x=liqLocalX(e),near=liq.btns.reduce((a,b)=>Math.abs(b.offsetLeft+b.offsetWidth/2-x)<Math.abs(a.offsetLeft+a.offsetWidth/2-x)?b:a);
 liqMove(near,x);
},{passive:true});
function liqEnd(e,cancel=false){
 if(!liq||e.pointerId!==liq.id)return;
 const {el,g,start,cur,moved}=liq;liq=null;
 // Remember where the lens is now, in case the click re-renders this control.
 const gr=g.getBoundingClientRect(),cr=el.getBoundingClientRect(),w=parseFloat(g.style.width)||gr.width;
 gliderMemo.set(gliderKey(el),{x:gr.left+gr.width/2-cr.left-el.clientLeft+el.scrollLeft-w/2,w,t:performance.now(),lifted:true});
 el.classList.remove('is-pressing','is-scrubbing');el.querySelectorAll(':scope > .lens-target').forEach(b=>b.classList.remove('lens-target'));
 if(!cancel&&moved&&cur!==start)cur.click(); // native click lands on the common parent, so pick here
 requestAnimationFrame(()=>{if(el.isConnected){gliderMemo.delete(gliderKey(el));syncGliders(el);}});
}
document.addEventListener('pointerup',e=>liqEnd(e),true);
document.addEventListener('pointercancel',e=>liqEnd(e,true),true);
function updateLevelChips(){
 document.querySelectorAll('.chips button[data-action="seg"]').forEach(btn=>{
  btn.setAttribute('aria-pressed',btn.dataset.id===S.seg);
 });
 document.querySelectorAll('.chips button[data-action="body"]').forEach(btn=>{
  btn.setAttribute('aria-pressed',btn.dataset.id===S.body);
 });
 document.querySelectorAll('.seg[data-action-group="type"] button').forEach(btn=>{
  btn.setAttribute('aria-pressed',btn.dataset.id===S.type);
 });
}
function refreshFilters(){
 if(S.view==='rank')renderLadder();
 else if(S.view==='cost')renderCostList();
 else {
  renderCards();
  updateLevelChips();
 }
 syncGliders();
}
function setHash(){const h='#'+S.view+(S.sub?'/'+S.sub:'');if(location.hash!==h)history.replaceState(null,'',h);}
function navigate(view,sub=''){S.view=view;S.sub=sub;setHash();closeFly();render();window.scrollTo({top:0,behavior:'instant'});}
// Both languages sit in the same grid cell, so every nav button is as wide as its longer label and the
// bar never resizes on a language switch; CSS cross-fades the labels with a blur.
const bi=key=>`<span class="bi"><span lang="zh-CN">${I.strings[key][0]}</span><span lang="es">${I.strings[key][1]}</span></span>`;
const NAV_KEYS=['catalog','rank','cost','compare','learn'];
function renderNav(){
 document.documentElement.lang=S.lang==='es'?'es':'zh-CN';document.documentElement.dataset.lang=S.lang;
 document.title=S.lang==='es'?'BYD España · Comparador de versiones':'BYD España · 车型与版本指南';
 const navEl=$('#nav');if(!navEl)return;
 if(!navEl.querySelector('.nav-links')){
  navEl.innerHTML=`<button class="brand" data-action="view" data-id="catalog" aria-label="BYD España"><span class="byd-logo">BYD</span><span class="brand-region">España</span></button><div class="nav-links">${NAV_KEYS.map(k=>{const menu=!['compare','cost'].includes(k);return `<button data-action="view" data-id="${k}" ${menu?`data-menu="${k}" aria-haspopup="true" aria-expanded="false"`:''}>${bi(k)}${menu?chevron:''}</button>`;}).join('')}</div><div class="nav-actions"><button class="search-toggle" data-action="palette">${icon('search')}</button><button class="theme-toggle btn compact" data-action="theme"></button><div class="seg lang" data-action-group="lang"><button data-action="lang" data-id="zh">中文</button><button data-action="lang" data-id="es">ES</button></div></div>`;
 }
 navEl.querySelectorAll('.nav-links [data-action="view"]').forEach(b=>{
  const k=b.dataset.id,cur=S.view===k||(k==='catalog'&&S.view==='model');
  if(cur)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  if(b.dataset.menu)b.setAttribute('aria-expanded',flyMenu===k);
 });
 const searchBtn=navEl.querySelector('.search-toggle');searchBtn.setAttribute('aria-label',t('search'));searchBtn.title=`${t('search')} · ${MOD_KEY} K`;
 const themeBtn=navEl.querySelector('.theme-toggle');
 themeBtn.setAttribute('aria-label',t('themeToggle'));themeBtn.title=t('themeToggle');themeBtn.innerHTML=icon(S.theme==='dark'?'sun':'moon');
 navEl.querySelectorAll('.seg.lang button').forEach(b=>b.setAttribute('aria-pressed',S.lang===b.dataset.id));
 $('#tray')?.setAttribute('aria-label',t('selected'));
 requestAnimationFrame(()=>syncGliders(navEl));
}
function footer(){return `<footer class="footer"><p>${t('snapshot')} · ${D.retrieved} · ${D.families.length} ${t('models')} / ${D.versions.length} ${t('versions')} · ${t('area')}</p><p>${t('localHint')}</p><p>${t('priceNote')} <a href="https://www.byd.com/es-es" target="_blank" rel="noopener">BYD España ${icon('arrow').replace('class="icon"','style="display:inline-block;width:12px;height:12px;vertical-align:middle"')}</a></p></footer>`;}
function hero(title,sub){return `<section class="page-hero"><h1>${esc(t(title)).replace(/\n/g,'<br>')}</h1><p>${t(sub)}</p></section>`;}
function filtered(){let rows=C.filter(D.versions,{family:S.family,type:S.type,seg:S.seg,body:S.body,query:S.query,budget:S.budget,price:S.price});if(S.sort){const key=S.sort==='price'?S.price:S.sort;const sorted=C.rank(rows,key);const ids=new Set(sorted.map(v=>v.id));rows=[...sorted,...rows.filter(v=>!ids.has(v.id))];}return rows;}
const units={range:'km',city:'km',total:'km',fuelRange:'km',tank:'L',weight:'kg',bootMax:'L',tow:'kg',towUnbraked:'kg',power:'kW',accel:'s',battery:'kWh',ac:'kW',dc:'kW',boot:'L',frunk:'L',seats:'',length:'mm',width:'mm',height:'mm',wheelbase:'mm',torque:'Nm',topSpeed:'km/h',consumption:'kWh/100 km',fuel:'L/100 km',weightedFuel:'L/100 km',dc1080:'min',dc3080:'min',screen:'″',speakers:''};
const currencyFields=new Set(['msrp','cash','finance']);
function value(v,key){return key==='total'?C.total(v):key in v?v[key]:v.features?.[key]??null;}
function displayValue(val,key,rich=false){
 if(val==null||(Array.isArray(val)&&!val.length))return `<span class="unknown">${t('unknown')}</span>`;
 if(Array.isArray(val))return esc(val.join(' / '));
 if(currencyFields.has(key))return `<span class="num">${money(val)}</span>`;
 if(key==='dc'&&val===0)return `<span class="unknown">${t('unsupported')}</span>`;
 if(key==='power')return `<span class="num">${fmt(val)} <small>kW · ≈${cv(val)} CV</small></span>`;
 if(typeof val==='boolean')return `<span class="state ${val?'yes':'no'}">${val?'● '+t('standard'):'— '+t('unavailable')}</span>`;
 if(val==='Sí'||val==='Opcional'||val==='—'||val==='-')return `<span class="state ${val==='Sí'?'yes':'no'}">${val==='Sí'?'● '+t('standard'):val==='Opcional'?'○ '+t('optional'):'— '+t('unavailable')}</span>`;
 if(key==='acTime')return esc(S.lang==='zh'?String(val).replace(/trifásic[oa]/gi,'三相').replace(/monofásic[oa]/gi,'单相'):val);
 if(key==='drive')return esc(S.lang==='zh'?({FWD:'前驱 · FWD',RWD:'后驱 · RWD',AWD:'四驱 · AWD'}[val]||val):val);
 if(typeof val==='number')return `<span class="num">${fmt(val,key.includes('Fuel')||key==='fuel'?2:1)} <small>${units[key]||''}</small></span>`;
 return esc(val);
}
function highlight(rows,key,label){
 const v=C.rank(rows,key)[0];if(!v)return '';
 return `<button class="highlight" data-action="detail" data-id="${v.id}"><div class="label">${t(label)}</div><div class="value num">${key==='power'?fmt(cv(v[key])):fmt(C.metric(v,key))} <small>${key==='power'?'CV':units[key]}</small></div><div class="who">${esc(v.name)} · ${v.version}</div>${icon('arrow')}</button>`;
}
function renderCatalog(){
 const rows=filtered(),families=[...new Set(rows.map(v=>v.family))];
 $('#main').innerHTML=`<div class="wrap">${chapterNav('')}<section class="hero"><div class="hero-copy"><h1>${esc(t('hero')).replace(/\n/g,'<br>')}</h1><p>${t('heroSub')}</p><div class="hero-meta"><span>${D.families.length} ${t('models')} · ${D.versions.length} ${t('versions')}</span><span>${t('snapshot')} ${D.retrieved}</span></div></div><div class="hero-media" data-action="detail" data-id="atto-3-evo-design" role="button" tabindex="0" aria-label="${t('details')} ATTO 3 EVO"><img src="assets/atto-3-evo-0.webp" alt="BYD ATTO 3 EVO" fetchpriority="high"><div class="hero-media-caption"><div><b>ATTO 3 EVO</b><br>${t('range')} 510 km · Design</div>${btn(t('details')+icon('arrow'),'detail','atto-3-evo-design','compact')}</div></div></section><div id="catalogHighlights" class="highlights">${highlight(rows,'total','longestTotal')}${highlight(rows,'power','powerful')}${highlight(rows,'dc','bestDC')}</div><div class="toolbar"><div class="type-filter">${typeSeg('type',S.type)}</div><div class="control query"><label for="query">${t('search')}</label><input id="query" type="search" placeholder="SEAL · Comfort · DM-i…" value="${esc(S.query)}"></div><div class="control"><label for="family">${t('catalog')}</label><select id="family"><option value="">${t('allModels')}</option>${D.families.filter(f=>!S.type||f.type===S.type).map(f=>`<option value="${f.id}" ${S.family===f.id?'selected':''}>${f.name}</option>`).join('')}</select></div><div class="control"><label for="price">${t('priceBasis')}</label><select id="price">${['msrp','cash','finance'].map(k=>`<option value="${k}" ${S.price===k?'selected':''}>${t(k)}</option>`).join('')}</select></div><div class="control"><label for="budget">${t('budget')}</label><select id="budget">${[0,25000,30000,35000,40000,45000,50000,60000,75000].map(n=>`<option value="${n}" ${S.budget===n?'selected':''}>${n?money(n):t('noLimit')}</option>`).join('')}</select></div><div class="control"><label for="sort">${t('sort')}</label><select id="sort">${[['','defaultOrder'],['price','priceLow'],['total','sortTotal'],['range','rangeHigh'],['power','powerHigh'],['accel','fastest'],['dc','dcHigh']].map(([v,l])=>`<option value="${v}" ${S.sort===v?'selected':''}>${t(l)}</option>`).join('')}</select></div><div class="reset-control">${btn(t('reset'),'reset','','compact')}</div></div>${levelBar()}<div class="results" id="results"></div><div class="catalog-grid" id="catalogGrid"></div>${footer()}</div>`;
 renderCards();
}
function renderCards(){
 const rows=filtered(),familyIds=[...new Set(rows.map(v=>v.family))];
 $('#results').innerHTML=`<span>${familyIds.length} ${t('models')} · ${rows.length} ${t('versions')}</span><span class="price-explain">${S.price==='finance'?t('financeNote'):S.price==='cash'?t('cashConditions'):t('fairPrice')}</span>`;
 $('#catalogHighlights').innerHTML=highlight(rows,'total','longestTotal')+highlight(rows,'power','powerful')+highlight(rows,'dc','bestDC');
 $('#catalogGrid').innerHTML=familyIds.length?familyIds.map(fid=>{
  const fam=fget(fid),vs=rows.filter(v=>v.family===fid),v=vs.find(v=>v.id===S.familyVersion[fid])||vs[0],price=v[S.price];
  return `<article class="car-card" data-family="${fid}"><div class="car-image-box" data-action="detail" data-id="${v.id}" role="button" tabindex="0" aria-label="${t('details')} ${esc(v.name)}"><img class="car-image" src="${v.image}" alt="BYD ${esc(v.name)} ${v.version}" loading="lazy"><span class="image-zoom-cue" aria-hidden="true">${icon('sparkle')} ${t('details')}</span></div><div class="card-content"><div class="card-name"><h3><button class="card-title" data-action="model" data-id="${fid}">${esc(v.name)}</button></h3>${typePill(v.type)}</div><div class="version-tabs" aria-label="${t('versions')}">${vs.map(b=>`<button data-action="version" data-id="${b.id}" aria-pressed="${b.id===v.id}">${b.version}</button>`).join('')}</div><div class="card-metrics"><div><b class="num">${fmt(C.total(v),0)} <small>km</small></b><span>${v.type==='PHEV'?`${t('evShort')} ${fmt(v.range,0)} + ${t('fuelShort')} ${fmt(v.fuelRange,0)}`:t('cardRange')}</span>${miniBar(v)}</div><div><b class="num">${cv(v.power)} <small>CV</small></b><span>${fmt(v.power)} kW · ${t('cardPower')}</span></div>${v.type==='PHEV'?`<div><b class="num">${fmt(v.fuel)} <small>L</small></b><span>${t('fuelCard')}</span></div>`:`<div><b class="num">${v.dc?fmt(v.dc,0):'—'} <small>${v.dc?'kW':''}</small></b><span>${v.dc?t('cardDC'):t('dc')+' '+t('unsupported')}</span></div>`}</div><div class="card-price"><div><b class="num">${money(price)}</b><span>${t(S.price)}</span></div><aside>${S.price==='msrp'&&liveCash(v)!=null?`${t('cash')}<strong>${money(v.cash)}</strong>`:`${t('ac')}<strong>${fmt(v.ac)} kW</strong>`}</aside></div><div class="card-actions">${btn(t('details'),'detail',v.id)}${btn((selected(v.id)?icon('check'):icon('plus'))+t(selected(v.id)?'added':'add'),'add',v.id,selected(v.id)?'selected':'primary')}</div><button class="family-link" data-action="familyCompare" data-id="${fid}">${t('compareFamily')} ${icon('arrow')}</button><p class="card-footnote">${v.type==='PHEV'?`${t('consumption')} ${fmt(v.consumption)} kWh/100 km · `:''}${t('ac')} ${fmt(v.ac)} kW${liveCash(v)!=null?' · '+t('promoUntil')+' 31/10/2026':''}</p></div></article>`;
 }).join(''):`<div class="empty" style="grid-column:1/-1"><h3>${t('empty')}</h3><p>${t('emptyHint')}</p>${btn(t('reset'),'reset','','primary')}</div>`;
 updateLevelChips();
 requestAnimationFrame(()=>syncGliders());
}
function renderTray(){
 const ids=S.selected;$('#tray').hidden=!ids.length;
 $('#tray').innerHTML=ids.length?`<div class="tray-title">${t('selected')}<b class="num">${ids.length} / 4</b></div><div class="tray-cars">${ids.map(id=>{const v=vget(id);return `<div class="tray-chip"><button class="tray-chip-name" data-action="detail" data-id="${id}" title="${t('details')}"><b>${v.name}</b><span>${v.version}</span></button><button class="tray-chip-del" data-action="add" data-id="${id}" aria-label="${t('remove')} ${v.name} ${v.version}">${icon('close')}</button></div>`;}).join('')}</div><div class="tray-actions"><button class="clear" data-action="clear">${t('clear')}</button>${btn(t('startCompare')+icon('arrow'),'selectedCompare','','primary')}</div>`:'';
}
let familyCompareIds=null;
function comparisonIds(){return familyCompareIds||S.selected;}
function add(id){const out=C.toggleSelection(S.selected,id);if(out.blocked){toast(t('limitReached'));return;}S.selected=out.ids;save();renderTray();if(S.view==='catalog')renderCards();if(S.view==='rank')renderLadder();if(S.view==='cost')renderCostList();if(S.view==='compare')renderCompare();if(modalId)renderDetail(modalId);}
function delta(vals,key,index){if(index===0||!C.present(vals[0])||!C.present(vals[index])||vals[index]===vals[0])return '';const n=vals[index]-vals[0];const good=C.lower.has(key)?n<0:n>0;return `<div class="delta ${good?'good':''}">${n>0?'+':'−'}${currencyFields.has(key)?money(Math.abs(n)):fmt(Math.abs(n))+' '+(units[key]||'')} · ${t('baseline')}</div>`;}
const metricGroups=[['overview',['msrp','cash','finance','total','range','fuelRange','city','power','accel']],['charging',['battery','ac','dc','port','acTime','dc1080','dc3080','v2l','heatPump']],['performance',['drive','torque','topSpeed','consumption','fuel','weightedFuel','tank','weight']],['space',['seats','boot','bootMax','frunk','tow','towUnbraked','length','width','height','wheelbase']],['keyEquipment',['wheels','interiors','screen','speakers','panoramic','heatedFront','ventilatedFront','heatedWheel','heatedRear','driverElectric','lumbar','hud','camera360','frontSensors','rearSensors','tailgate','wireless','phone','google','acc','aeb','blindSpot']]];
const extraLabels={port:['充电接口','Puerto de carga'],wheels:['轮毂','Llantas'],interiors:['内饰颜色','Colores interiores']};
const label=key=>extraLabels[key]?extraLabels[key][S.lang==='es'?1:0]:t(key);
function rowHtml(vs,key){
 const vals=vs.map(v=>value(v,key));if(['total','fuelRange','tank'].includes(key)&&vs.every(v=>v.type==='BEV'))return '';
 if(['fuel','weightedFuel','torque','topSpeed','frunk','weight','bootMax','tow','towUnbraked'].includes(key)&&vals.every(x=>x==null))return '';
 if(S.diff&&vs.length>1&&!C.isDifferent(vals))return '';
 const nums=vals.filter(C.present);const unique=new Set(nums);const best=unique.size>1&&(units[key]||currencyFields.has(key))?(C.lower.has(key)?Math.min(...nums):Math.max(...nums)):null;
 return `<tr><th scope="row" class="row-label">${label(key)}${key==='power'?`<span class="original">${text('纯电为电机功率；插混为系统最大功率。CV 由 kW 换算。','BEV: motor; PHEV: potencia total del sistema. CV calculados de kW.')}</span>`:''}</th>${vals.map((val,i)=>`<td ${best!=null&&val===best?'class="winning"':''}><div class="value">${displayValue(val,key,true)}</div>${delta(vals,key,i)}</td>`).join('')}</tr>`;
}
function comparisonTable(vs){
 const min=210+vs.length*220;
 return `<div class="compare-shell"><div class="table-scroll"><table class="compare-table" style="min-width:${min}px"><thead><tr><th class="row-label">${t('detailsTitle')}<p class="small muted" style="margin-top:14px">${t('snapshot')}<br>${D.retrieved}<br><br>${t('baseline')}</p></th>${vs.map(v=>`<th scope="col"><button class="compare-car-trigger" data-action="detail" data-id="${v.id}" title="${t('details')}"><img src="${v.image}" alt="${esc(v.name)} ${v.version}"><b>${v.name}</b><div class="version">${v.version} · ${t(v.type==='BEV'?'bev':'phev')}</div></button><div style="margin-top:12px">${btn(icon(selected(v.id)?'check':'plus')+t(selected(v.id)?'added':'add'),'add',v.id,'compact '+(selected(v.id)?'selected':''))}</div></th>`).join('')}</tr></thead><tbody>${metricGroups.map(([group,keys])=>{const rows=keys.map(k=>rowHtml(vs,k)).join('');return rows?`<tr class="section-row"><td colspan="${vs.length+1}">${t(group)}</td></tr>${rows}`:'';}).join('')}<tr class="section-row"><td colspan="${vs.length+1}">${t('sourceAndNotes')}</td></tr><tr><th class="row-label">${t('origin')}</th>${vs.map(v=>`<td class="source-cell">${t(v.specSource==='catalog'?'sourceCatalog':'sourceCompare')}<p>${text('逐项配置：西班牙官方 catalog。','Equipamiento detallado: catálogo oficial español.')}</p>${links(fget(v.family),true)}${fget(v.family).promotionExpiry?`<p>${t('promoUntil')} 31/10/2026</p>`:''}</td>`).join('')}</tr></tbody></table></div></div><p class="hint">${t('financeNote')} ${t('cashConditions')} ${t('rankNote')}</p>`;
}
function rawEquipment(vs){
 const all=new Map();
 vs.forEach((v,index)=>Object.entries(v.equipment).forEach(([g,items])=>Object.entries(items).forEach(([key,val])=>{
  const group=I.group(g),canonical=I.norm(key).replace(/[™®*?]/g,'').replace(/\s+/g,' ').trim();const id=group+'|'+canonical;
  if(!all.has(id))all.set(id,{group,key,values:Array(vs.length).fill(null)});all.get(id).values[index]=val;
 })));
 const query=I.norm(S.eqQuery);
 const filtered=[...all.values()].filter(r=>(!query||I.norm(r.key+' '+I.labelZh(r.key)).includes(query))&&(!S.diff||vs.length===1||C.isDifferent(r.values)));
 const groups=[...new Set([...all.values()].map(r=>r.group))];
 return `<section class="equipment-block"><h2>${t('fullEquipment')}</h2><p class="hint study-only">${t('equipmentHelp')}</p><div class="eq-controls"><input id="eqQuery" type="search" aria-label="${t('equipmentSearch')}" placeholder="${t('equipmentSearch')}" value="${esc(S.eqQuery)}"><span class="small muted">${filtered.length} ${text('项','elementos')}</span></div><div id="eqGroups">${groups.map(group=>{
  const rows=filtered.filter(r=>r.group===group);if(!rows.length)return '';
  return `<details class="eq-group" ${S.eqQuery?'open':''}><summary>${I.groups[group]?.[S.lang==='es'?1:0]||esc(group)} <span class="quiet small">· ${rows.length}</span></summary><div class="table-scroll"><table class="compare-table" style="min-width:${290+vs.length*200}px"><thead><tr><th class="row-label">${text('官方配置项目','Elemento oficial')}</th>${vs.map(v=>`<th scope="col" style="padding:15px 18px;font-size:12px">${v.name}<br>${v.version}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="original-row"><th scope="row" class="row-label">${esc(S.lang==='zh'?I.labelZh(r.key):r.key)}${S.lang==='zh'&&I.labelZh(r.key)!==r.key?`<span class="original">${esc(r.key)}</span>`:''}</th>${r.values.map(val=>`<td>${displayValue(val,'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
 }).join('')||`<div class="empty-group">${t('allSame')}</div>`}</div></section>`;
}
function links(f,compact=false){return `<div class="source-links">${[['model','modelPage'],['config','configPage'],['compare','compareJSON'],['promo','promoPage']].filter(([k])=>f.sources[k]&&!(k==='promo'&&f.id==='tang')).map(([k,l])=>`<a href="${esc(f.sources[k])}" target="_blank" rel="noopener">${t(l)}</a>`).join('')}<a href="catalog/${f.id}.pdf" target="_blank">${t('catalogPDF')}</a></div>`;}
function sourceCard(f){return `<article class="source-card"><h3>${f.name}</h3>${links(f)}${f.notes.length?`<div class="notice"><b>${t('notice')}</b>${f.notes.map(n=>`<p>${esc(n[S.lang==='es'?1:0])}</p>`).join('')}</div>`:''}${f.promotionOriginal?`<p class="hint">${t('promoUntil')} 31/10/2026 · ${t('expiryHint')}</p><details class="terms"><summary>${t('showOriginal')}</summary><p lang="es">${esc(f.promotionOriginal)}</p></details>`:''}</article>`;}
function sourcesFor(vs){return `<div class="source-columns">${[...new Set(vs.map(v=>v.family))].map(fid=>sourceCard(fget(fid))).join('')}</div>`;}
// Radar: each axis runs from the lowest to the highest of all versions, so "further out" is always better
// (axes marked lo are reversed). Up to three versions overlay in one chart; four become small multiples,
// because no fourth colour stays distinguishable when every outline can cross every other.
const RADAR_AXES=[['total','rd_total'],['range','rd_range'],['power','rd_power'],['accel','rd_accel',1],['dc','rd_dc'],['consumption','rd_cons',1],['msrp','rd_price',1],['boot','rd_boot']];
const RADAR_SHAPES=['circle','square','diamond'];
const radarSlots=new Map(); // version id → colour slot; survivors keep their colour when the selection changes
function radarSlot(vs){
 for(const id of [...radarSlots.keys()])if(!vs.some(v=>v.id===id))radarSlots.delete(id);
 vs.forEach(v=>{if(!radarSlots.has(v.id)){const used=new Set(radarSlots.values());let k=0;while(used.has(k))k++;radarSlots.set(v.id,k);}});
 return v=>radarSlots.get(v.id);
}
function radarValue(v,key){
 const x=C.metric(v,key);
 if(key==='msrp')return money(x);
 if(key==='dc')return x?`${fmt(x,0)} kW`:t('unsupported');
 if(key==='power')return `${fmt(x,0)} kW · ≈ ${cv(x)} CV`;
 if(key==='accel')return `${f1(x)} s`;
 if(key==='consumption')return `${f1(x)} kWh/100 km`;
 if(key==='boot')return `${fmt(x,0)} L`;
 return `${fmt(x,0)} km`;
}
function radarScore(v,key,lo){
 const all=D.versions.map(v=>C.metric(v,key)).filter(C.present),min=Math.min(...all),max=Math.max(...all),x=C.metric(v,key);
 if(!C.present(x))return null;
 const s=max>min?(x-min)/(max-min):1;
 return 0.12+0.88*(lo?1-s:s); // keep the weakest value off the dead centre
}
function radarMark(shape,x,y,r){
 if(shape==='square')return `<rect x="${(x-r*.85).toFixed(1)}" y="${(y-r*.85).toFixed(1)}" width="${(r*1.7).toFixed(1)}" height="${(r*1.7).toFixed(1)}" rx="1.5"/>`;
 if(shape==='diamond')return `<path d="M${x.toFixed(1)} ${(y-r*1.15).toFixed(1)}L${(x+r*1.15).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y+r*1.15).toFixed(1)}L${(x-r*1.15).toFixed(1)} ${y.toFixed(1)}Z"/>`;
 return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
}
// One SVG. series: [{v, cls, shape|null}] drawn in order (context first, focus last).
function radarSvg(series,label){
 const R=118,n=RADAR_AXES.length,ang=i=>-Math.PI/2+i*2*Math.PI/n,pt=(i,r)=>[Math.cos(ang(i))*R*r,Math.sin(ang(i))*R*r];
 const ring=f=>RADAR_AXES.map((_,i)=>pt(i,f).map(c=>c.toFixed(1)).join(',')).join(' ');
 let g=[0.25,0.5,0.75,1].map(f=>`<polygon class="rd-ring" points="${ring(f)}"/>`).join('')+RADAR_AXES.map((_,i)=>{const [x,y]=pt(i,1);return `<line class="rd-spoke" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;}).join('');
 g+=RADAR_AXES.map(([k,lab,lo],i)=>{const [x,y]=pt(i,1.16),c=Math.cos(ang(i)),anchor=Math.abs(c)<0.2?'middle':c>0?'start':'end',dy=Math.sin(ang(i))>0.5?12:Math.sin(ang(i))<-0.5?-4:4;
  return `<text class="rd-axis" x="${x.toFixed(1)}" y="${(y+dy).toFixed(1)}" text-anchor="${anchor}">${esc(t(lab))}${lo?' ↓':''}</text>`;}).join('');
 for(const s of series){
  const pts=RADAR_AXES.map(([k,,lo],i)=>{const r=radarScore(s.v,k,lo);return r==null?null:pt(i,r);});
  const poly=pts.filter(Boolean).map(p=>p.map(c=>c.toFixed(1)).join(',')).join(' ');
  g+=`<g class="rd-series ${s.cls}" data-id="${s.v.id}" data-shape="${s.shape||''}"><polygon class="rd-area" points="${poly}"/>`;
  if(s.shape)g+=pts.map((p,i)=>p?`<g class="rd-pt" data-axis="${i}">${radarMark(s.shape,p[0],p[1],4.5)}<title>${esc(`${s.v.name} ${s.v.version} · ${t(RADAR_AXES[i][1])}: ${radarValue(s.v,RADAR_AXES[i][0])}`)}</title></g>`:'').join('');
  g+='</g>';
 }
 return `<svg class="rd-svg" viewBox="-215 -160 430 322" role="img" aria-label="${esc(label)}"><line class="rd-cross" x1="0" y1="0" x2="0" y2="0"/>${g}</svg>`;
}
function radarBlock(vs){
 if(!vs.length)return '';
 const head=`<div class="rd-head"><h2>${t('radarTitle')}</h2><p>${t('radarNote')}</p></div>`;
 const name=v=>`${esc(v.name)} · ${esc(v.version)}`;
 if(vs.length<=3){
  const slot=radarSlot(vs),series=vs.map(v=>({v,cls:`s${slot(v)+1}`,shape:RADAR_SHAPES[slot(v)]}));
  const legend=vs.length>1?`<div class="rd-legend">${series.map(s=>`<button class="rd-key ${s.cls}" data-rd="${s.v.id}" aria-pressed="false"><svg viewBox="-7 -7 14 14" aria-hidden="true">${radarMark(s.shape,0,0,4.5)}</svg>${name(s.v)}</button>`).join('')}</div>`:'';
  return `<section class="radar">${head}${legend}<div class="rd-plot">${radarSvg(series,`${t('radarTitle')}: ${vs.map(v=>`${v.name} ${v.version}`).join(', ')}`)}<div class="rd-tip" role="status" hidden></div></div></section>`;
 }
 // Four versions: small multiples, each highlights one version against the others in grey.
 radarSlots.clear();
 return `<section class="radar">${head}<p class="rd-multi-note">${t('radarMulti')}</p><div class="rd-multi">${vs.map(v=>`<figure class="rd-plot"><figcaption>${name(v)}</figcaption>${radarSvg([...vs.filter(o=>o!==v).map(o=>({v:o,cls:'ctx',shape:null})),{v,cls:'s1',shape:'circle'}],`${t('radarTitle')}: ${v.name} ${v.version}`)}<div class="rd-tip" role="status" hidden></div></figure>`).join('')}</div></section>`;
}
const compareContent=vs=>radarBlock(vs)+comparisonTable(vs)+rawEquipment(vs)+sourcesFor(vs);
// Radar hover: the pointer picks the nearest axis (points of close versions overlap, so no pinpoint
// targets); the tooltip lists every version's value on that axis. Legend hover / press isolates one version.
function radarTip(e){
 const plot=e.target.closest?.('.rd-plot'),svg=plot?.querySelector('.rd-svg');if(!svg)return;
 const tip=plot.querySelector('.rd-tip'),cross=svg.querySelector('.rd-cross');
 const m=svg.getScreenCTM(),x=(e.clientX-m.e)/m.a,y=(e.clientY-m.f)/m.d,n=RADAR_AXES.length;
 svg.querySelectorAll('.rd-pt.on').forEach(el=>el.classList.remove('on'));
 if((e.type==='pointerleave'&&e.pointerType!=='touch')||Math.hypot(x,y)>150||Math.hypot(x,y)<14){tip.hidden=true;cross.setAttribute('x2',0);cross.setAttribute('y2',0);return;}
 const i=((Math.round((Math.atan2(y,x)+Math.PI/2)/(2*Math.PI/n))%n)+n)%n,[k,lab,lo]=RADAR_AXES[i],a=-Math.PI/2+i*2*Math.PI/n;
 cross.setAttribute('x2',(Math.cos(a)*118).toFixed(1));cross.setAttribute('y2',(Math.sin(a)*118).toFixed(1));
 svg.querySelectorAll(`.rd-pt[data-axis="${i}"]`).forEach(el=>el.classList.add('on'));
 // Legend order in the overlay; in a small multiple the highlighted version (drawn last) comes first.
 const groups=[...svg.querySelectorAll('.rd-series')];if(svg.querySelector('.rd-series.ctx'))groups.reverse();
 const rows=groups.map(g=>{const v=vget(g.dataset.id),sh=g.dataset.shape;
  return `<div class="${g.classList.contains('ctx')?'ctx':''}"><svg viewBox="-7 -7 14 14" class="${[...g.classList].find(c=>/^s\d$/.test(c))||'ctx'}" aria-hidden="true">${sh?radarMark(sh,0,0,4.5):'<rect x="-5" y="-1" width="10" height="2"/>'}</svg><em>${esc(v.name)} · ${esc(v.version)}</em><strong class="num">${esc(radarValue(v,k))}</strong></div>`;});
 tip.innerHTML=`<b>${esc(t(lab))}${lo?' ↓':''}</b>${rows.join('')}`;tip.hidden=false;
 const pr=plot.getBoundingClientRect(),ax=m.e+Math.cos(a)*118*m.a-pr.left,ay=m.f+Math.sin(a)*118*m.d-pr.top;
 tip.style.left=`${Math.min(Math.max(ax,tip.offsetWidth/2+4),pr.width-tip.offsetWidth/2-4)}px`;
 tip.style.top=`${Math.max(ay-12,tip.offsetHeight+4)}px`;
}
document.addEventListener('pointermove',radarTip,{passive:true});
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.rd-plot'))radarTip(e);else document.querySelectorAll('.rd-tip:not([hidden])').forEach(tip=>{tip.hidden=true;tip.closest('.rd-plot').querySelectorAll('.rd-pt.on').forEach(el=>el.classList.remove('on'));tip.closest('.rd-plot').querySelector('.rd-cross')?.setAttribute('x2',0);tip.closest('.rd-plot').querySelector('.rd-cross')?.setAttribute('y2',0);});},{passive:true});
document.addEventListener('pointerleave',e=>{if(e.target.classList?.contains('rd-plot'))radarTip(e);},true);
function radarFocus(radar,id){radar.classList.toggle('isolate',!!id);radar.querySelectorAll('.rd-series').forEach(g=>g.classList.toggle('focus',g.dataset.id===id));radar.querySelectorAll('.rd-key').forEach(b=>b.setAttribute('aria-pressed',b.dataset.rd===id));}
document.addEventListener('pointerover',e=>{const k=e.target.closest?.('.rd-key');if(k&&e.pointerType==='mouse')radarFocus(k.closest('.radar'),k.dataset.rd);},{passive:true});
document.addEventListener('pointerout',e=>{const k=e.target.closest?.('.rd-key');if(k&&e.pointerType==='mouse'&&!k.contains(e.relatedTarget)&&!k.closest('.radar').dataset.pinned)radarFocus(k.closest('.radar'),'');},{passive:true});
document.addEventListener('click',e=>{const k=e.target.closest?.('.rd-key');if(!k)return;const radar=k.closest('.radar'),on=radar.dataset.pinned===k.dataset.rd;radar.dataset.pinned=on?'':k.dataset.rd;radarFocus(radar,on?'':k.dataset.rd);});
function renderCompare(){
 const vs=comparisonIds().map(vget).filter(Boolean);
 $('#main').innerHTML=`<div class="wrap">${hero('compareTitle','compareSub')}${vs.length?`<div class="compare-actions"><label class="switch"><input type="checkbox" role="switch" id="onlyDiff" ${S.diff?'checked':''}><span class="sw" aria-hidden="true"><i></i></span>${t('onlyDiff')}</label><div>${btn(icon('print')+t('print'),'print','','compact')}${btn(t('backModels'),'view','catalog','compact')}${btn(t('clear'),'clear','','compact')}</div></div><div id="comparisonContent">${compareContent(vs)}</div>`:`<div class="empty"><h2>${t('noSelection')}</h2><p>${t('noSelectionSub')}</p><div class="quick-start">${btn('SEAL · '+t('compareFamily'),'familyCompare','seal','primary')}${btn('ATTO 2 DM-i · '+t('compareFamily'),'familyCompare','atto-2-dm-i')}${btn('DOLPHIN SURF · '+t('compareFamily'),'familyCompare','dolphin-surf')}</div></div>`}${footer()}</div>`;
}
// Ladder: every version on one shared km scale; electric + fuel range stacked, key numbers beside.
const SORTS=[['total','sortTotal'],['range','sortRange'],['fuelRange','sortFuelRange'],['msrp','sortPrice'],['consumption','sortConsumption'],['fuel','sortFuel'],['weightedFuel','sortWeighted'],['power','sortPower'],['accel','sortAccel'],['dc','sortDC'],['battery','sortBattery']];
const BREAKS={total:[300,400,500,1000,1400],range:[50,100,300,400,500],fuelRange:[900,1000,1200,1400],msrp:[25e3,30e3,35e3,40e3,45e3,50e3],consumption:[15,16,18,20],fuel:[4.5,5,6],weightedFuel:[1,2,3],power:[100,150,200,300],accel:[5,7,9],dc:[1,50,100,150,200],battery:[20,50,70,85]};
const COL_OF={total:'range',range:'range',fuelRange:'range',msrp:'msrp',consumption:'consumption',battery:'consumption',fuel:'fuel',weightedFuel:'fuel',power:'power',accel:'accel',dc:'dc'};
const LCOLS=['msrp','consumption','fuel','power','accel','dc'];
const SEGS=['A00','A0','A','B','C'],BODIES=['hatch','suv','sedan','wagon'];
const reduceMotion=()=>typeof matchMedia!=='undefined'?matchMedia('(prefers-reduced-motion: reduce)').matches:false;
const f1=n=>n==null?'—':new Intl.NumberFormat(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const kEuro=n=>n==null?'—':`${fmt(n/1000,n%1000?1:0)}k €`;
const driveShort=d=>S.lang==='zh'?({FWD:'前驱',RWD:'后驱',AWD:'四驱'}[d]||d||''):(d||'');
const ladderAsc=()=>S.rankDir?S.rankDir==='asc':C.lower.has(S.rankSort);
const maxTotal=Math.max(...D.versions.map(v=>C.total(v)||0));
function miniBar(v,max=maxTotal){
 const ev=v.range||0,fu=v.type==='PHEV'?v.fuelRange||0:0;
 return `<div class="mini-bar" aria-hidden="true"><div style="width:${(ev+fu)/max*100}%">${ev?`<i class="ev" style="flex:${ev}"></i>`:''}${fu?`<i class="fuel" style="flex:${fu}"></i>`:''}</div></div>`;
}
function levelBar(){
 const pool=D.versions.filter(v=>!S.type||v.type===S.type);
 const chip=(action,val,name,n)=>{const on=(action==='seg'?S.seg:S.body)===val;return `<button data-action="${action}" data-id="${val}" aria-pressed="${on}" ${n===0&&!on?'disabled':''}>${name}${val?` <span class="n num">${n}</span>`:''}</button>`;};
 return `<div class="levels"><div class="level-row"><span class="level-label">${t('levelSeg')}</span><div class="chips"><div class="seg-glider" aria-hidden="true"></div>${chip('seg','',t('all'))}${SEGS.map(g=>chip('seg',g,t('seg'+g),pool.filter(v=>v.segment===g&&(!S.body||v.body===S.body)).length)).join('')}</div></div><div class="level-row"><span class="level-label">${t('levelBody')}</span><div class="chips"><div class="seg-glider" aria-hidden="true"></div>${chip('body','',t('all'))}${BODIES.map(b=>chip('body',b,t('body_'+b),pool.filter(v=>v.body===b&&(!S.seg||v.segment===S.seg)).length)).join('')}</div></div></div>`;
}
function tierLabel(key,idx){
 const b=BREAKS[key],u=['total','range','fuelRange'].includes(key)?'km':units[key]||'';
 const f=n=>key==='msrp'?kEuro(n):`${fmt(n)} ${u}`;
 if(key==='dc'&&idx===0)return t('noDC');
 if(key==='dc'&&idx===1)return text(`${f(b[1])} 以下`,`Menos de ${f(b[1])}`);
 if(idx===0)return text(`${f(b[0])} 以下`,`Menos de ${f(b[0])}`);
 if(idx===b.length)return text(`${f(b[idx-1])} 及以上`,`${f(b[idx-1])} o más`);
 return `${f(b[idx-1])} – ${f(b[idx])}`;
}
function ladderRow(v,pos,max){
 const tot=C.total(v),ev=v.range,fu=v.type==='PHEV'?v.fuelRange:0,on=COL_OF[S.rankSort],sub=k=>S.rankSort===k?' class="key"':'';
 const cell=(col,main,small)=>`<div class="lc${on===col?' on':''}" data-label="${t('col_'+col)}"><b class="num">${main}</b>${small?`<small>${small}</small>`:''}</div>`;
 const dcTime=v.dc1080!=null?`10–80% · ${v.dc1080} min`:v.dc3080!=null?`30–80% · ${v.dc3080} min`:'';
 return `<div class="l-row${pos==null?' is-missing':pos<=3?' top':''}" role="listitem" data-id="${v.id}">
<span class="l-pos num">${pos??'–'}</span>
<button class="l-car" data-action="detail" data-id="${v.id}" aria-label="${t('details')} · ${esc(v.name)} ${esc(v.version)}"><img src="${v.image}" alt="" loading="lazy"><span class="l-name"><b>${esc(v.name)}</b><small>${esc(v.version)} · ${t('seg'+v.segment)} · ${t('body_'+v.body)}</small></span></button>
<div class="lc range${on==='range'?' on':''}"><div class="rtrack"><div class="rbar" style="width:${tot/max*100}%">${ev?`<i class="ev" style="flex:${ev}"></i>`:''}${fu?`<i class="fuel" style="flex:${fu}"></i>`:''}</div></div><div class="rval"><b class="num">${fmt(tot,0)} <small>km</small></b><small>${v.type==='PHEV'?`<span${sub('range')}>${t('evShort')} ${fmt(ev,0)}</span> + <span${sub('fuelRange')}>${t('fuelShort')} ${fmt(fu,0)}</span>`:t('bevOnly')}</small></div></div>
${cell('msrp',kEuro(v.msrp),liveCash(v)!=null?`${t('promoShort')} ${kEuro(v.cash)}`:'')}
${cell('consumption',`${f1(v.consumption)} <small>kWh</small>`,`<span${sub('battery')}>${t('batteryShort')} ${f1(v.battery)} kWh</span>`)}
${cell('fuel',v.type==='PHEV'?`${f1(v.fuel)} <small>L</small>`:'—',v.type==='PHEV'?`<span${sub('weightedFuel')}>${t('weightedShort')} ${v.weightedFuel!=null?f1(v.weightedFuel)+' L':'—'}</span> · ${t('tankShort')} ${v.tank!=null?v.tank+' L':'—'}`:t('noFuel'))}
${cell('power',`${fmt(v.power,0)} <small>kW</small>`,`≈ ${cv(v.power)} CV`)}
${cell('accel',`${f1(v.accel)} <small>s</small>`,driveShort(v.drive))}
${cell('dc',v.dc?`${fmt(v.dc,0)} <small>kW</small>`:'—',v.dc?dcTime:t('unsupported'))}
<button class="rank-add ${selected(v.id)?'active':''}" data-action="add" data-id="${v.id}" aria-label="${t(selected(v.id)?'remove':'add')} ${esc(v.name)} ${esc(v.version)}">${icon(selected(v.id)?'check':'plus')}</button></div>`;
}
function renderRank(){
 const g=RANK_GROUPS.find(x=>x[0]===S.sub);if(g&&!g[1].includes(S.rankSort)){S.rankSort=g[1][0];S.rankDir='';}
 $('#main').innerHTML=`<div class="wrap wide">${hero('rankTitle','rankSub')}<div class="ladder-controls" id="ladderControls"></div><div class="ladder" id="ladder" role="list"></div><p class="hint ladder-note">${t('ladderNote')}</p>${footer()}</div>`;
 renderLadder();
}
function setHashGroup(){if(S.view==='rank'){S.sub=groupOf(S.rankSort);setHash();}}
function renderLadder(){
 const key=S.rankSort,asc=ladderAsc(),on=COL_OF[key];
 const pool=C.filter(D.versions,{type:S.type,seg:S.seg,body:S.body});
 const ranked=C.rank(pool,key,S.rankDir),ids=new Set(ranked.map(v=>v.id)),missing=pool.filter(v=>!ids.has(v.id));
 const max=Math.max(1,...pool.map(v=>C.total(v)||0));
 const old=captureRows('#ladder');
 const arrow=`<svg class="icon dir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${asc?'M12 19V5m-6 6 6-6 6 6':'M12 5v14m-6-6 6 6 6-6'}"/></svg>`;
 setHashGroup();$('#ladderControls').innerHTML=`${subTabs(RANK_GROUPS.map(([g])=>[g,t('rg_'+g)]),groupOf(key),'rankGroup',t('rank'))}<div class="lc-top"><div class="type-filter">${typeSeg('type',S.type)}</div><div class="sort-box"><label for="rankSort">${t('sort')}</label><select id="rankSort">${RANK_GROUPS.map(([g,keys])=>`<optgroup label="${t('rg_'+g)}">${keys.map(k=>`<option value="${k}" ${key===k?'selected':''}>${t(SORTS.find(x=>x[0]===k)[1])}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn compact dir-btn" data-action="rankDir">${arrow}${t(asc?'lowFirst':'highFirst')}</button></div></div>${levelBar()}<div class="legend"><span><i class="sw ev"></i>${t('legendEV')}</span><span><i class="sw fuel"></i>${t('legendFuel')}</span><span class="legend-count">${pool.length} ${t('versions')}</span></div>`;
 const hcol=(col,k)=>`<button class="lh${on===col?' on':''}" data-action="rankSortBy" data-id="${k}" aria-pressed="${on===col}">${t('col_'+col)}${on===col?arrow:''}</button>`;
 let html=`<div class="l-head"><span></span><span class="lh-car">${t('col_car')}</span>${hcol('range','total')}${LCOLS.map(c=>hcol(c,c)).join('')}<span></span></div>`;
 const groups=[];ranked.forEach(v=>{const tr=C.tier(C.metric(v,key),BREAKS[key]);const g=groups[groups.length-1];g&&g.tier===tr?g.rows.push(v):groups.push({tier:tr,rows:[v]});});
 let pos=0;
 html+=groups.map(g=>`<div class="l-tier" data-tier="${g.tier}"><span>${tierLabel(key,g.tier)}</span><i></i><em class="num">${g.rows.length}</em></div>${g.rows.map(v=>ladderRow(v,++pos,max)).join('')}`).join('');
 if(missing.length)html+=`<div class="l-tier is-missing"><span>${t('notPublished')}</span><i></i><em class="num">${missing.length}</em></div>${missing.map(v=>ladderRow(v,null,max)).join('')}`;
 if(!pool.length)html=`<div class="empty"><h3>${t('empty')}</h3><p>${t('emptyHint')}</p>${btn(t('reset'),'resetLadder','','primary')}</div>`;
 $('#ladder').innerHTML=html;
 playRows('#ladder',old);
}
// FLIP for ranked lists: rows ([data-id]) slide to their new place, bars (.rbar) resize from their old width.
function captureRows(root){return new Map([...document.querySelectorAll(`${root} [data-id].l-row`)].map(el=>{const bar=el.querySelector('.rbar');return [el.dataset.id,{top:el.getBoundingClientRect().top,w:bar?bar.getBoundingClientRect().width:null}];}));}
function playRows(root,old){
 if(reduceMotion())return;
 const ease='cubic-bezier(.32,.72,0,1)';
 document.querySelectorAll(`${root} [data-id].l-row`).forEach((el,i)=>{
  const o=old.get(el.dataset.id),bar=el.querySelector('.rbar'),target=bar?.style.width;
  if(o){const dy=o.top-el.getBoundingClientRect().top;if(Math.abs(dy)>1)el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:560,easing:ease});if(bar&&o.w!=null)bar.animate([{width:o.w+'px'},{width:target}],{duration:560,easing:ease});}
  else{const d=Math.min(i,24)*18;el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:420,delay:d,easing:ease,fill:'backwards'});if(bar)bar.animate([{width:'0%'},{width:target}],{duration:900,delay:120+d,easing:ease,fill:'backwards'});}
 });
 if(!old.size)document.querySelectorAll(`${root} .l-tier`).forEach(el=>el.animate([{opacity:0},{opacity:1}],{duration:400,easing:'ease-out'}));
}
// Second-level navigation: nav flyouts, model strip, page tabs, model pages.
const RANK_GROUPS=[['range',['total','range','fuelRange']],['price',['msrp']],['energy',['consumption','fuel','weightedFuel']],['performance',['power','accel']],['charging',['dc','battery']]];
const LEARN_TABS=['terms','method','sources'];
const groupOf=key=>(RANK_GROUPS.find(g=>g[1].includes(key))||RANK_GROUPS[0])[0];
const famVersions=fid=>D.versions.filter(v=>v.family===fid);
const span=(vals,f)=>{const n=vals.filter(C.present);if(!n.length)return t('unknown');const lo=Math.min(...n),hi=Math.max(...n);return lo===hi?f(lo):`${f(lo)}–${f(hi)}`;};
const promoLive=fid=>{const e=fget(fid).promotionExpiry;return !e||new Date()<=new Date(e+'T23:59:59');};
const liveCash=v=>v.cash!=null&&promoLive(v.family)?v.cash:null;
const chevron=`<svg class="icon chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
function subTabs(items,active,action,label){return `<div class="subnav" role="tablist" aria-label="${esc(label)}" data-action-group="${action}"><div class="seg-glider" aria-hidden="true"></div>${items.map(([id,name])=>`<button role="tab" data-action="${action}" data-id="${id}" aria-selected="${active===id}">${name}</button>`).join('')}</div>`;}
function chapterNav(active){
 return `<nav class="chapter" aria-label="${t('allModels')}"><div class="chapter-track">${['BEV','PHEV'].map(tp=>`<div class="chapter-group"><span class="chapter-label">${t(tp==='BEV'?'bev':'phev')}</span><div class="chapter-items">${D.families.filter(f=>f.type===tp).map(f=>`<button data-action="model" data-id="${f.id}" ${active===f.id?'aria-current="page"':''}><img src="${f.image}" alt="" loading="lazy"><span>${esc(f.name)}</span></button>`).join('')}</div></div>`).join('')}</div></nav>`;
}
function flyoutHtml(menu){
 if(menu==='catalog')return `<div class="fly-cols">${['BEV','PHEV'].map(tp=>`<div><div class="fly-head">${t(tp==='BEV'?'bev':'phev')}</div><div class="fly-models">${D.families.filter(f=>f.type===tp).map(f=>{const vs=famVersions(f.id);return `<button class="fly-model" data-action="model" data-id="${f.id}"><img src="${f.image}" alt="" loading="lazy"><span><b>${esc(f.name)}</b><small>${t('from')} ${kEuro(Math.min(...vs.map(v=>v.msrp)))} · ${span(vs.map(C.total),n=>fmt(n,0))} km</small></span></button>`;}).join('')}</div></div>`).join('')}</div><div class="fly-foot"><button data-action="view" data-id="catalog">${t('allModelsLink')} · ${D.families.length} ${t('models')} / ${D.versions.length} ${t('versions')}</button></div>`;
 if(menu==='rank')return `<div class="fly-list">${RANK_GROUPS.map(([g])=>`<button class="fly-item" data-action="rankGroup" data-id="${g}"><b>${t('rg_'+g)}</b><small>${t('rgd_'+g)}</small></button>`).join('')}</div>`;
 if(menu==='learn')return `<div class="fly-list">${LEARN_TABS.map(k=>`<button class="fly-item" data-action="learnTab" data-id="${k}"><b>${t('lt_'+k)}</b><small>${t('ltd_'+k)}</small></button>`).join('')}</div>`;
 return '';
}
let flyMenu=null,flyTimer;
const canHover=()=>typeof matchMedia!=='undefined'?matchMedia('(hover: hover) and (pointer: fine)').matches:true;
function openFly(menu,focus=false){
 clearTimeout(flyTimer);const el=$('#flyout');
 if(flyMenu!==menu){el.innerHTML=`<div class="fly-inner fly-${menu}">${flyoutHtml(menu)}</div>`;flyMenu=menu;}
 el.hidden=false;document.body.classList.add('fly-open');requestAnimationFrame(()=>el.classList.add('on'));
 document.querySelectorAll('[data-menu]').forEach(b=>b.setAttribute('aria-expanded',b.dataset.menu===menu));
 if(focus)el.querySelector('button')?.focus();
}
function closeFly(delay=0){
 clearTimeout(flyTimer);
 flyTimer=setTimeout(()=>{const el=$('#flyout');el.classList.remove('on');document.body.classList.remove('fly-open');flyMenu=null;document.querySelectorAll('[data-menu]').forEach(b=>b.setAttribute('aria-expanded','false'));setTimeout(()=>{if(!flyMenu)el.hidden=true;},220);},delay);
}
function colorBlock(vs){
 const all=new Map();vs.forEach(v=>v.priceColor.forEach(c=>{if(!all.has(c.name))all.set(c.name,{...c,in:[]});all.get(c.name).in.push(v.version);}));
 if(!all.size)return '';
 const curColor = S.activeColor || all.keys().next().value;
 return `<div class="colors" role="radiogroup" aria-label="${t('colorsTitle')}">${[...all.values()].map(c=>`<button class="color ${c.name===curColor?'active':''}" data-action="pickColor" data-id="${esc(c.name)}" role="radio" aria-checked="${c.name===curColor}"><span class="swatch">${c.icon?`<img src="${esc(c.icon)}" alt="" loading="lazy" onerror="this.remove()">`:''}</span><b>${esc(c.name)}</b><small>${c.price?'+ '+money(c.price):t('noCharge')}</small>${vs.length>1&&c.in.length<vs.length?`<small class="only">${t('onlyOn')} ${c.in.map(esc).join(' / ')}</small>`:''}</button>`).join('')}</div>`;
}
const UPGRADE_KEYS=['panoramic','heatedFront','ventilatedFront','heatedWheel','heatedRear','driverElectric','lumbar','hud','camera360','frontSensors','tailgate','wireless','heatPump','v2l','blindSpot','acc'];
function upgrades(prev,cur){
 const out=[];const num=(k,u,d=0)=>{const a=prev[k],b=cur[k],f=n=>k==='dc'&&n===0?t('unsupported'):`${fmt(n,d)} ${u}`;if(C.present(a)&&C.present(b)&&b!==a)out.push(`${label(k)} ${f(a)} → ${f(b)}`);};
 num('battery','kWh',1);num('range','km');num('power','kW');num('dc','kW');
 UPGRADE_KEYS.forEach(k=>{if(cur.features[k]===true&&prev.features[k]!==true)out.push('+ '+label(k));});
 ['screen','speakers'].forEach(k=>{const a=prev.features[k],b=cur.features[k];if(C.present(a)&&C.present(b)&&b>a)out.push(`${label(k)} ${fmt(a)} → ${fmt(b)}${k==='screen'?'″':''}`);});
 if(cur.drive!==prev.drive&&cur.drive)out.push(displayValue(cur.drive,'drive'));
 return out;
}
function renderModel(fid){
 const f=fget(fid);if(!f){navigate('catalog');return;}
 const vs=famVersions(fid),fromCash=vs.map(liveCash).filter(C.present);
 const expiry=f.promotionExpiry&&promoLive(fid)?Math.ceil((new Date(f.promotionExpiry+'T23:59:59')-new Date())/864e5):null;
 $('#main').innerHTML=`<div class="wrap">${chapterNav(fid)}
<section class="model-hero"><div class="model-copy">${typePill(f.type)} <span class="pill">${t('seg'+f.segment)} · ${t('body_'+f.body)}</span><h1>${esc(f.name)}</h1><p class="model-slogan" lang="es">${esc(f.description)}</p>
<dl class="model-stats"><div><dt>${t('from')}</dt><dd class="num">${money(Math.min(...vs.map(v=>v.msrp)))}</dd>${fromCash.length?`<dd class="sub">${t('cash')} ${money(Math.min(...fromCash))}</dd>`:''}</div><div><dt>${t('col_range')}</dt><dd class="num">${span(vs.map(C.total),n=>fmt(n,0))} <small>km</small></dd></div><div><dt>${t('power')}</dt><dd class="num">${span(vs.map(v=>v.power),n=>fmt(n,0))} <small>kW</small></dd></div><div><dt>${t('versions')}</dt><dd class="num">${vs.length}</dd></div></dl>
<div class="model-actions">${vs.length>1?btn(t('compareFamily'),'familyCompare',fid,'primary'):btn(t('makeQuote'),'quote',vs[0].id,'primary')}${btn(t('viewInLadder'),'ladderModel',fid)}</div>${expiry!=null&&expiry<=21?`<p class="promo-alert">${t('promoUntil')} ${f.promotionExpiry.split('-').reverse().join('/')} · ${text(`还剩 ${expiry} 天`,`quedan ${expiry} días`)}</p>`:''}</div><div class="model-image-box" data-action="detail" data-id="${vs[0].id}" role="button" tabindex="0" title="${t('details')}"><img class="model-image" src="${vs[0].image}" alt="BYD ${esc(f.name)}"><span class="image-zoom-cue" aria-hidden="true">${icon('sparkle')} ${t('details')}</span></div></section>
<section class="model-section"><h2>${t('versionsTitle')}</h2><div class="version-grid">${vs.map((v,i)=>{const up=i?upgrades(vs[i-1],v):[];const cash=liveCash(v);return `<article class="version-card"><div class="car-image-box" data-action="detail" data-id="${v.id}" role="button" tabindex="0" title="${t('details')}"><img class="car-image" src="${v.image}" alt="${esc(v.name)} ${esc(v.version)}" loading="lazy"><span class="image-zoom-cue" aria-hidden="true">${icon('sparkle')} ${t('details')}</span></div><div class="vc-body"><h3>${esc(v.version)}</h3><p class="vc-price"><b class="num">${money(v.msrp)}</b>${cash!=null?`<span>${t('cash')} ${money(cash)}</span>`:''}</p><div class="vc-range"><b class="num">${fmt(C.total(v),0)} <small>km</small></b><small>${v.type==='PHEV'?`${t('evShort')} ${fmt(v.range,0)} + ${t('fuelShort')} ${fmt(v.fuelRange,0)}`:t('cardRange')}</small>${miniBar(v,Math.max(...vs.map(C.total)))}</div><ul class="vc-specs"><li><span>${t('power')}</span><b class="num">${fmt(v.power,0)} kW</b></li><li><span>0–100</span><b class="num">${f1(v.accel)} s</b></li><li><span>${t('col_dc')}</span><b class="num">${v.dc?fmt(v.dc,0)+' kW':t('unsupported')}</b></li>${v.type==='PHEV'?`<li><span>${t('col_fuel')}</span><b class="num">${f1(v.fuel)} L</b></li>`:`<li><span>${t('battery')}</span><b class="num">${f1(v.battery)} kWh</b></li>`}</ul>${i?`<div class="vc-up"><span>${text(`相比 ${esc(vs[i-1].version)} 的变化`,`Cambios frente a ${esc(vs[i-1].version)}`)}</span>${up.length?`<ul>${up.slice(0,7).map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p>${t('upgradeEquip')}</p>`}</div>`:`<div class="vc-up"><span>${t('entryVersion')}</span></div>`}<div class="vc-actions">${btn(t('details'),'detail',v.id,'compact')}${btn(t('makeQuote'),'quote',v.id,'compact')}${btn(icon(selected(v.id)?'check':'plus')+t(selected(v.id)?'added':'add'),'add',v.id,'compact '+(selected(v.id)?'selected':'primary'))}</div></div></article>`;}).join('')}</div></section>
<section class="model-section"><h2>${t('colorsTitle')}</h2><p class="hint">${t('colorsHint')}</p>${colorBlock(vs)}<div class="trim"><div><h3>${t('interiorsLabel')}</h3>${vs.map(v=>`<p><b>${esc(v.version)}</b> ${esc(v.interiors.join(' / ')||t('unknown'))}</p>`).join('')}</div><div><h3>${t('wheelsLabel')}</h3>${vs.map(v=>`<p><b>${esc(v.version)}</b> ${esc(v.wheels||t('unknown'))}</p>`).join('')}</div></div></section>
<section class="model-section"><h2>${t('warrantyTitle')}</h2>${warrantyBlock(f)}</section>
<section class="model-section"><h2>${t('keySpecs')}</h2>${comparisonTable(vs)}</section>
<section class="model-section">${sourceCard(f)}</section>${footer()}</div>`;
}
// Running cost: editable assumptions, every version on one €/month scale, petrol car as reference line.
const COST_INPUTS=[['km',300,5000,50],['home',0.05,0.40,0.01],['pub',0.20,0.90,0.01],['homeShare',0,1,0.05],['petrol',1.00,2.20,0.01],['ref',4,10,0.1]];
const f2=n=>new Intl.NumberFormat(locale(),{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const costVal=(k,n)=>k==='km'?`${fmt(n,0)} km`:k==='homeShare'?`${Math.round(n*100)}%`:k==='ref'?`${f1(n)} L/100 km`:k==='petrol'?`${f2(n)} €/L`:`${f2(n)} €/kWh`;
const costParams=()=>({...S.cost,phevShare:S.cost.auto?null:S.cost.phevShare,realFactor:0.85});
const refCost=()=>S.cost.km/100*S.cost.ref*S.cost.petrol;
const euro0=n=>new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
// Sliders grouped by what they describe; the filled part of each track shows where the value sits.
const COST_GROUPS=[['cg_use',['km']],['cg_elec',['home','pub','homeShare']],['cg_fuel',['petrol','ref']]];
const pct=(k,n)=>{const [,min,max]=COST_INPUTS.find(x=>x[0]===k)||[k,0,1];return `${(n-min)/(max-min)*100}%`;};
function costSlider(k){const [,min,max,step]=COST_INPUTS.find(x=>x[0]===k)||['phevShare',0,1,0.05];return `<input type="range" data-cost="${k}" min="${min}" max="${max}" step="${step}" value="${S.cost[k]}" style="--p:${pct(k,S.cost[k])}" aria-label="${t('ci_'+k)}">`;}
function costInputs(){
 return `<h2 class="cost-h">${t('costAssume')}</h2>${COST_GROUPS.map(([g,keys])=>`<div class="cost-group"><h3>${t(g)}</h3>${keys.map(k=>`<label class="cost-field"><span><em>${t('ci_'+k)}</em><b id="cv_${k}" class="num">${costVal(k,S.cost[k])}</b></span>${costSlider(k)}</label>`).join('')}</div>`).join('')}
<div class="cost-group"><h3>${t('cg_phev')}</h3><div class="cost-field"><span><em>${t('ci_phev')}</em>${S.cost.auto?'':`<b id="cv_phevShare" class="num">${Math.round(S.cost.phevShare*100)}%</b>`}</span>${segmented('costAuto',S.cost.auto?'auto':'manual',[['auto',t('phevAuto')],['manual',t('phevManual')]])}${S.cost.auto?`<small class="cost-help">${t('phevAutoHelp')}</small>`:costSlider('phevShare')}</div></div>
<div class="cost-foot">${btn(t('costReset'),'costReset','','compact text')}</div>`;
}
function renderCost(){
 $('#main').innerHTML=`<div class="wrap wide">${hero('costTitle','costSub')}<div class="cost-layout"><aside class="cost-panel">${costInputs()}</aside><section class="cost-results"><div id="costFilters"></div><div id="costSummary" class="cost-summary"></div><div class="cost-list" id="costList" role="list"></div><p class="hint">${t('costNote')}</p></section></div>${footer()}</div>`;
 renderCostList();
}
function renderCostList(){
 $('#costFilters').innerHTML=`<div class="lc-top"><div class="type-filter">${typeSeg('type',S.type)}</div></div>${levelBar()}`;
 const p=costParams(),ref=refCost();
 const rows=C.filter(D.versions,{type:S.type,seg:S.seg,body:S.body}).map(v=>({v,c:C.energyCost(v,p)})).filter(r=>r.c).sort((a,b)=>a.c.total-b.c.total||a.v.id.localeCompare(b.v.id));
 const max=Math.max(ref,...rows.map(r=>r.c.total))*1.05,refPos=ref/max*100;
 const best=rows[0];
 $('#costSummary').innerHTML=best?`<div><span>${t('cheapest')}</span><b class="num">${euro0(best.c.total)}<small>/${t('month')}</small></b><em>${esc(best.v.name)} · ${esc(best.v.version)}</em></div><div><span>${t('refCar')}</span><b class="num">${euro0(ref)}<small>/${t('month')}</small></b><em>${f1(S.cost.ref)} L/100 km · ${fmt(S.cost.km,0)} km/${t('month')}</em></div><div class="save"><span>${t('yearSaveMax')}</span><b class="num">${euro0((ref-best.c.total)*12)}<small>/${t('year')}</small></b><em>${t('vsRef')}</em></div>`:'';
 const old=captureRows('#costList');
 $('#costList').innerHTML=rows.length?`<div class="l-head c-head"><span></span><span>${t('col_car')}</span><span class="c-legend"><i class="sw ev"></i>${t('costElec')} <i class="sw fuel"></i>${t('costFuel')} <i class="sw ref"></i>${t('refLine')}</span><span>${t('perMonth')}</span><span>${t('yearDiff')}</span><span></span></div>${rows.map(({v,c},i)=>{const save=(ref-c.total)*12;return `<div class="l-row c-row" role="listitem" data-id="${v.id}"><span class="l-pos num">${i+1}</span><button class="l-car" data-action="detail" data-id="${v.id}"><img src="${v.image}" alt="" loading="lazy"><span class="l-name"><b>${esc(v.name)}</b><small>${esc(v.version)} · ${v.type==='PHEV'?`${t('evShare')} ${Math.round(c.share*100)}%`:`${f1(v.consumption)} kWh/100 km`}</small></span></button><div class="c-track"><div class="rtrack"><div class="rbar" style="width:${c.total/max*100}%">${c.elec?`<i class="ev" style="flex:${c.elec}"></i>`:''}${c.fuel?`<i class="fuel" style="flex:${c.fuel}"></i>`:''}</div></div><i class="ref-line" style="left:${refPos}%"></i></div><div class="lc"><b class="num">${euro0(c.total)}</b><small>${f2(c.total/S.cost.km*100)} € / 100 km</small></div><div class="lc ${save>=0?'good':'bad'}"><b class="num">${save>=0?'−':'+'}${euro0(Math.abs(save))}</b><small>${t(save>=0?'yearLess':'yearMore')}</small></div><button class="rank-add ${selected(v.id)?'active':''}" data-action="add" data-id="${v.id}" aria-label="${t(selected(v.id)?'remove':'add')} ${esc(v.name)} ${esc(v.version)}">${icon(selected(v.id)?'check':'plus')}</button></div>`;}).join('')}`:`<div class="empty"><h3>${t('empty')}</h3>${btn(t('reset'),'resetLadder','','primary')}</div>`;
 playRows('#costList',old);
}
let costFrame;
function onCostInput(el){
 const k=el.dataset.cost;S.cost[k]=Number(el.value);save();el.style.setProperty('--p',k==='phevShare'?`${S.cost[k]*100}%`:pct(k,S.cost[k]));
 const out=$('#cv_'+k);if(out)out.textContent=k==='phevShare'?`${Math.round(S.cost[k]*100)}%`:costVal(k,S.cost[k]);
 cancelAnimationFrame(costFrame);costFrame=requestAnimationFrame(renderCostList);
}
// Warranty, as written on each official model page.
function warrantyBlock(f,compact=false){
 const w=f.warranty;if(!w)return '';
 const tile=(k,val,extra='')=>`<div class="w-tile"><span>${t('w_'+k)}</span>${val?`<b class="num">${val[0]} ${t('years')}</b><small>${fmt(val[1],0)} km${extra}</small>`:`<b class="muted">${t('notStated')}</b>`}</div>`;
 return `<div class="warranty${compact?' compact':''}">${tile('general',w.general)}${tile('battery',w.battery,w.soh?` · SOH ≥ ${w.soh}%`:'')}${tile('motor',w.motor)}</div>${compact?'':`<p class="hint" lang="es">${esc(w.original)} ${t('warrantyHint')}</p>`}`;
}
// One-page customer quote (print / save as PDF).
function renderQuote(id){
 const v=vget(id);if(!v){navigate('catalog');return;}
 const f=fget(v.family),color=v.priceColor.find(c=>c.name===S.quoteColor[id])||v.priceColor[0],surcharge=color?.price||0,cash=liveCash(v);
 const c=C.energyCost(v,costParams()),ref=refCost();let adv={};try{adv=JSON.parse(localStorage.getItem('byd-quote-advisor')||'{}');}catch{}
 const row=(k,val)=>`<tr><th>${k}</th><td>${val}</td></tr>`;
 $('#main').innerHTML=`<div class="wrap quote-wrap"><div class="quote-tools">${btn(t('back'),'model',v.family,'compact')}<span class="sub">${t('quoteHelp')}</span>${btn(icon('print')+t('printQuote'),'print','','primary')}</div>
<article class="quote"><header class="q-head"><div class="q-brand"><span class="byd-logo">BYD</span><span>España</span></div><div class="q-meta"><b>${t('quoteTitle')}</b><span class="num">${new Date().toLocaleDateString(locale())}</span></div></header>
<section class="q-hero"><img src="${v.image}" alt="BYD ${esc(v.name)} ${esc(v.version)}"><div>${typePill(v.type)}<h1>${esc(v.name)}</h1><p class="q-version">${esc(v.version)} · ${t('seg'+v.segment)} · ${t('body_'+v.body)} · ${displayValue(v.drive,'drive')}</p><div class="q-price"><span>${t('quoteTotal')}</span><b class="num">${money(v.msrp+surcharge)}</b><small>${t('msrp')} ${money(v.msrp)}${surcharge?` + ${esc(color.name)} ${money(surcharge)}`:''}</small></div></div></section>
<section class="q-grid">
<div class="q-block"><h3>${t('priceBlock')}</h3><table>${row(t('msrp'),money(v.msrp))}${row(t('quoteColor'),`<select id="quoteColor" data-id="${v.id}">${v.priceColor.map(cl=>`<option value="${esc(cl.name)}" ${cl===color?'selected':''}>${esc(cl.name)} · ${cl.price?'+ '+money(cl.price):t('noCharge')}</option>`).join('')}</select><span class="print-only">${esc(color?.name||'')}</span>`)}${row(t('cash'),cash!=null?`${money(cash)}<small>${t('promoUntil')} 31/10/2026</small>`:`<span class="muted">${t('unknown')}</span>`)}${row(t('finance'),v.finance!=null&&cash!=null?money(v.finance):`<span class="muted">${t('unknown')}</span>`)}</table><p class="q-note">${t('cashConditions')} ${t('financeNote')}</p></div>
<div class="q-block"><h3>${t('rangeBlock')}</h3><table>${row(t('total'),`${fmt(C.total(v),0)} km`)}${v.type==='PHEV'?row(t('range'),`${fmt(v.range,0)} km`)+row(t('fuelRange'),`${fmt(v.fuelRange,0)} km`)+row(t('fuel'),`${f1(v.fuel)} L/100 km`)+row(t('tank'),v.tank?v.tank+' L':t('unknown')):row(t('city'),`${fmt(v.city,0)} km`)}${row(t('consumption'),`${f1(v.consumption)} kWh/100 km`)}${row(t('battery'),`${f1(v.battery)} kWh`)}</table></div>
<div class="q-block"><h3>${t('driveBlock')}</h3><table>${row(t('power'),`${fmt(v.power,0)} kW · ≈ ${cv(v.power)} CV`)}${row('0–100 km/h',`${f1(v.accel)} s`)}${row(t('ac'),`${fmt(v.ac)} kW`)}${row(t('dc'),v.dc?`${fmt(v.dc,0)} kW${v.dc1080!=null?` · 10–80% ${v.dc1080} min`:v.dc3080!=null?` · 30–80% ${v.dc3080} min`:''}`:t('unsupported'))}</table></div>
<div class="q-block"><h3>${t('space')}</h3><table>${row(t('seats'),v.seats)}${row(t('boot'),`${fmt(v.boot,0)} L${v.bootMax?` / ${fmt(v.bootMax,0)} L`:''}`)}${row(t('length'),`${fmt(v.length,0)} mm`)}${row(t('wheelsLabel'),esc(v.wheels||t('unknown')))}${row(t('interiorsLabel'),esc(v.interiors.join(' / ')||t('unknown')))}</table></div>
<div class="q-block"><h3>${t('costTitleShort')}</h3>${c?`<p class="q-cost"><b class="num">${euro0(c.total)}</b> / ${t('month')}<small>${fmt(S.cost.km,0)} km · ${t('refCar')} ${euro0(ref)} · ${t('yearDiff')} ${euro0((ref-c.total)*12)}</small></p><p class="q-note">${t('quoteCostNote')} ${f2(S.cost.home)} €/kWh · ${f2(S.cost.pub)} €/kWh · ${f2(S.cost.petrol)} €/L.</p>`:t('unknown')}</div>
<div class="q-block"><h3>${t('warrantyTitle')}</h3>${warrantyBlock(f,true)}</div>
</section>
<section class="q-people"><label>${t('quoteClient')}<input type="text" autocomplete="off"></label><label>${t('quoteAdvisor')}<input type="text" id="qAdvisor" value="${esc(adv.name||'')}"></label><label>${t('quotePhone')}<input type="tel" id="qPhone" value="${esc(adv.phone||'')}"></label></section>
<footer class="q-foot">${t('quoteDisclaimer')} ${t('snapshot')} ${D.retrieved} · byd.com/es-es</footer></article></div>`;
}
function knowledge(){
 const cards=[
  ['CA / AC · corriente alterna','家用充电，看 AC。','Para cargar en casa, mira CA.', '交流电通常来自家用插座、家用充电桩和部分公共桩。车载充电机把交流电转成电池所需的直流电。实际功率由车辆、充电桩、线路和供电共同限制；车辆支持 11 kW，不意味着普通插座也能提供 11 kW。三相和单相条件要对应看。','La corriente alterna procede de enchufes, wallbox y algunos puntos públicos. El cargador del vehículo la convierte a continua. La potencia depende del coche, punto, instalación y suministro; admitir 11 kW no significa obtenerlos de un enchufe doméstico. Comprueba condiciones mono/trifásicas.','插座 / 桩 → 车载充电机 → 电池','Red / punto → cargador a bordo → batería'],
  ['CC / DC · corriente continua','出行快充，看 DC 和时间。','Para viajar, mira CC y el tiempo.','直流桩在车外完成转换，直接给电池充电。最大 kW 是峰值，电池电量与温度改变时功率也会变化。比较时间要看相同电量区间：10–80% 与 30–80% 不能直接比较。本网页分别列出两种官方时间，不自行估算。','El punto convierte la energía fuera del coche. Los kW máximos son un pico: la potencia cambia con temperatura y estado de carga. Compara el mismo intervalo: 10–80% y 30–80% no son equivalentes. Aquí se separan tiempos oficiales, sin estimaciones.','峰值 kW ≠ 全程平均功率','kW de pico ≠ potencia media'],
  ['WLTP · autonomía','城市续航，别当综合续航。','Urbana y combinada son distintas.','WLTP 是标准测试口径，不是对真实行驶里程的保证。城市与综合续航分开显示。插混纯电续航描述不使用燃油可行驶的测试里程；总续航同时考虑燃油和电力，两者不会混为一个指标。','WLTP es una referencia de ensayo, no una garantía de autonomía real. Urbana y combinada se muestran separadas. En un PHEV, la autonomía eléctrica describe el recorrido sin gasolina; la total contempla combustible y electricidad. Son indicadores distintos.','纯电续航 / 城市续航 / 插混总续航','Eléctrica / urbana / total PHEV'],
  ['kW · CV · kWh','功率与电量，是两件事。','Potencia y energía son diferentes.','kW 用于电机功率和充电功率，kWh 用于电池电量。1 kW 约等于 1.36 CV，本网页的 CV 根据官方 kW 换算。插混采用官方系统最大功率，不把发动机和电机功率简单相加。V2L 是为外部设备供电，不等于车辆支持双向并网。','kW mide potencia del motor o de carga; kWh, energía de la batería. 1 kW ≈ 1,36 CV; los CV se calculan a partir de kW oficiales. En PHEV se usa la potencia máxima del sistema, sin sumar motor térmico y eléctrico. V2L alimenta dispositivos; no implica V2G.','kW → 功率 · kWh → 电量','kW → potencia · kWh → energía'],
  ['PVP · contado · financiado','低价，也要看条件。','El precio necesita contexto.','建议零售价对应默认基础配置，便于完整车型横向比较。现金促销可能仍有 CAE 等条件；融资广告价可能包含补贴预支、融资折扣与 CAE，不等于最终总付款。贷款还需要核对首付、利息、TAE、费用、末期大额款和优惠资格；原始官方条款可在各车型来源中展开。','El PVP corresponde a configuración base y permite comparar toda la gama. El contado puede incluir CAE u otras condiciones. El precio financiado puede sumar anticipo de ayudas y descuentos, sin ser el importe total a plazos. Comprueba entrada, intereses, TAE, comisiones, cuota final y elegibilidad; consulta términos oficiales por modelo.','建议零售价 / 现金促销价 / 融资广告价','PVP / contado / financiado'],
  ['Equipamiento · versiones','贵的版本，多了什么？','¿Qué añade la versión superior?','先选同款车型的全部版本，再勾选“只看差异”。常用配置统一名称，完整表保留西班牙语原文，方便对照客人报价。标配、选配、不提供、未公布分别展示；同名条目没在另一份文件出现，不表示另一款没有这项配置。','Compara las versiones del mismo modelo y activa Solo diferencias. Los elementos principales usan nombres comunes; la tabla conserva originales españoles para contrastar presupuestos. Se distinguen serie, opción, no disponible y no publicado. La ausencia de un nombre en otro documento no significa ausencia de equipamiento.','标配 ● / 选配 ○ / 不提供 — / 未公布','Serie ● / opción ○ / no disponible — / no publicado']
 ];
 return `<div class="knowledge-grid">${cards.map(a=>`<article class="knowledge"><div class="term">${a[0]}</div><h3>${esc(a[S.lang==='es'?2:1])}</h3><p>${esc(a[S.lang==='es'?4:3])}</p><div class="formula"><span>${esc(a[S.lang==='es'?6:5])}</span></div></article>`).join('')}</div>`;
}
function renderLearn(){
 const tab=LEARN_TABS.includes(S.sub)?S.sub:'terms';
 const body={terms:knowledge(),method:`<div class="method"><h3>${t('sourceMethod')}</h3><p style="margin-top:12px">${D.methodology[S.lang]}</p><p>${t('sourceDate')}</p><p>${t('area')} ${t('localHint')}</p><p>${text('资料采集跨越 10 月 12–13 日；车型与促销页于 12 日下载。官网导航当前没有 HAN 或老款 ATTO 3，因此不混入其他市场或历史版本。','La preparación abarcó el 12–13 de octubre; páginas/modelos/promociones descargados el día 12. HAN y ATTO 3 anterior no figuran en la navegación actual y no se mezclan con esta gama.')}</p></div>`,sources:`<div class="section-head"><h2>${t('sourceTitle')}</h2><p>${t('originalTerms')}</p></div><div class="source-columns">${D.families.map(sourceCard).join('')}</div>`}[tab];
 $('#main').innerHTML=`<div class="wrap">${hero('learnTitle','learnSub')}${subTabs(LEARN_TABS.map(k=>[k,t('lt_'+k)]),tab,'learnTab',t('learn'))}<div class="learn-body">${body}</div>${footer()}</div>`;
}

function detailBodyHtml(v,f){
 return `<div class="dialog-top"><div><h2>${v.name} · ${v.version}</h2><p>${t('detailsTitle')}</p></div>${btn(icon('close')+t('close'),'close','','compact')}</div><div class="dialog-content"><div class="dialog-hero"><div class="dialog-hero-media"><img src="${v.image}" alt="BYD ${v.name} ${v.version}"></div><div>${typePill(v.type)}<h3 style="margin-top:10px">${v.name}</h3><p class="version">${v.version} · ${displayValue(v.drive,'drive')}</p><div class="stats"><div><b class="num">${fmt(C.total(v),0)}</b> <small>km</small><span>${v.type==='PHEV'?`${t('evShort')} ${fmt(v.range,0)} + ${t('fuelShort')} ${fmt(v.fuelRange,0)}`:t('cardRange')}</span>${miniBar(v)}</div><div><b class="num">${cv(v.power)}</b> <small>CV</small><span>${fmt(v.power)} kW · ${t('power')}</span></div><div><b class="num">${v.dc||'—'}</b> <small>${v.dc?'kW':''}</small><span>${t('dc')}${v.dc?'':' · '+t('unsupported')}</span></div></div><div class="price-lines">${['msrp','cash','finance'].map(k=>`<div><span>${t(k)}</span><b>${money(v[k])}</b></div>`).join('')}</div>${btn(icon(selected(v.id)?'check':'plus')+t(selected(v.id)?'added':'add'),'add',v.id,selected(v.id)?'selected':'primary')} ${btn(t('compareFamily'),'familyCompare',v.family)} ${btn(t('modelPage2'),'model',v.family)} ${btn(t('makeQuote'),'quote',v.id)}</div></div><p class="hint">${t('priceNote')} ${t('financeNote')} ${t('cashConditions')}</p>${f.notes&&f.notes.length?`<div class="notice"><b>${t('notice')}</b>${f.notes.map(n=>`<p>${esc(n[S.lang==='es'?1:0])}</p>`).join('')}</div>`:''}<h3 class="detail-sub">${t('colorsTitle')}</h3>${colorBlock([v])}${comparisonTable([v])}${rawEquipment([v])}${sourcesFor([v])}</div>`;
}
// Card → window morph. Everything runs inside the dialog (top layer), so no backdrop ever covers it.
// The card's surface grows into the window; its content zooms and blurs away while the window content
// sharpens in; the photo and the model name are shared and fly to their new place without fading.
let morphSrc=null,morphing=false;
const SRC_SEL='.car-card, .version-card, .l-row, .highlight, .hero-media, .tray-chip, th';
const SRC_IMG='.car-image, .model-image, img';
const SRC_TITLE='.card-name h3, .l-name b, .tray-chip b, th b';
const EASE_OUT='cubic-bezier(.25,.8,.25,1)';
// Play keyframes forwards for opening; for closing run the mirror image with the same ease-out,
// so both directions start fast and settle gently.
function play(el,frames,dur,open,extra={}){
 const f=open?frames:frames.slice().reverse().map(k=>k.offset==null?k:{...k,offset:1-k.offset});
 return el.animate(f,{duration:dur,easing:EASE_OUT,fill:'both',...extra});
}
const box=r=>({left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
function radiusOf(el){let n=el;for(let i=0;n&&i<3;i++,n=n.parentElement){const r=parseFloat(getComputedStyle(n).borderTopLeftRadius);if(r)return r;}return 0;}
function textClone(dst){
 const c=dst.cloneNode(true),cs=getComputedStyle(dst),r=dst.getBoundingClientRect();
 c.className='morph-text';c.removeAttribute('style');
 Object.assign(c.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width+4}px`,fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,letterSpacing:cs.letterSpacing,lineHeight:cs.lineHeight,color:cs.color,margin:'0'});
 return c;
}
function morph(open){
 const d=$('#detail'),panel=$('#detailPanel'),back=d.querySelector('.dlg-backdrop');
 const src=morphSrc&&morphSrc.isConnected?morphSrc:null,R=src?.getBoundingClientRect();
 const onScreen=R&&R.width>0&&R.bottom>0&&R.top<innerHeight;
 const done=()=>{morphing=false;d.classList.remove('morphing');[panel,back].forEach(el=>el.getAnimations().forEach(a=>a.cancel()));if(!open)finishClose();};
 if(reduceMotion()){if(!open)finishClose();return;}
 morphing=true;
 if(!onScreen){ // card scrolled away or gone: quiet zoom + blur
  play(back,[{opacity:0},{opacity:1}],open?420:260,open);
  play(panel,[{opacity:0,transform:'scale(.94)',filter:'blur(10px)'},{opacity:1,transform:'none',filter:'blur(0)'}],open?460:260,open).finished.then(done);
  return;
 }
 const dur=open?640:500;
 src.style.visibility='hidden';
 d.classList.add('morphing');
 const F=panel.getBoundingClientRect(),r0=radiusOf(src)||18,r1=parseFloat(getComputedStyle(panel).borderTopLeftRadius)||28;
 const layer=document.createElement('div');layer.className='morph-layer';
 // Surface + the card's own content, zooming with it.
 const shell=document.createElement('div');shell.className='morph-shell';
 const clone=src.cloneNode(true);clone.classList.add('morph-clone');clone.removeAttribute('id');
 Object.assign(clone.style,{width:`${R.width}px`,height:`${R.height}px`,visibility:'visible'});
 [SRC_IMG,SRC_TITLE].forEach(sel=>{const el=clone.querySelector(sel);if(el)el.style.visibility='hidden';});
 shell.append(clone);layer.append(shell);
 // Shared elements: photo and model name.
 const hidden=[];
 const sImg=src.querySelector(SRC_IMG),dImg=panel.querySelector('.dialog-hero-media img');
 if(sImg&&dImg){
  const a=sImg.getBoundingClientRect(),b=dImg.getBoundingClientRect(),img=new Image();
  img.src=dImg.currentSrc||dImg.src;img.className='morph-img';img.alt='';layer.append(img);hidden.push(dImg);
  play(img,[{...box(a),borderRadius:`${radiusOf(sImg)}px`},{...box(b),borderRadius:`${radiusOf(dImg)}px`}],dur,open);
 }
 const sTitle=src.querySelector(SRC_TITLE),dTitle=panel.querySelector('.dialog-hero h3');
 if(sTitle&&dTitle){
  const a=sTitle.getBoundingClientRect(),b=dTitle.getBoundingClientRect(),txt=textClone(dTitle);layer.append(txt);hidden.push(dTitle);
  play(txt,[{transform:`translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.height/b.height})`},{transform:'none'}],dur,open);
 }
 d.append(layer);hidden.forEach(el=>el.style.visibility='hidden');
 const grow=F.width/R.width,k=Math.min(R.width/F.width,R.height/F.height);
 play(back,[{opacity:0},{opacity:1}],dur,open);
 play(shell,[{...box(R),borderRadius:`${r0}px`},{...box(F),borderRadius:`${r1}px`}],dur,open);
 play(clone,[{transform:'scale(1)',opacity:1,filter:'blur(0)'},{offset:.42,opacity:0,filter:'blur(12px)'},{transform:`scale(${grow})`,opacity:0,filter:'blur(16px)'}],dur,open);
 play(panel,[{transform:`translate(${R.left-F.left}px,${R.top-F.top}px) scale(${k})`,opacity:0,filter:'blur(16px)'},{offset:.3,opacity:0},{transform:'none',opacity:1,filter:'blur(0)'}],dur,open)
  .finished.then(()=>{layer.remove();if(open)hidden.forEach(el=>el.style.visibility='');done();});
}
function renderDetail(id,srcEl=null){
 const v=vget(id);if(!v||morphing)return;const f=fget(v.family),d=$('#detail');
 modalId=id;$('#detailPanel').dataset.type=v.type;
 if(d.open){$('#detailBody').innerHTML=detailBodyHtml(v,f);return;}
 $('#detailBody').innerHTML=detailBodyHtml(v,f);
 d.showModal();$('#detailPanel').scrollTop=0;
 const src=srcEl?.closest?.(SRC_SEL)||null;
 morphSrc=src&&src.getClientRects().length?src:null;
 morph(true);
}
function finishClose(){const d=$('#detail');try{d.close();}catch{}if(morphSrc)morphSrc.style.visibility='';morphSrc=null;}
// quick: the page is about to change underneath, so don't fly back into a card that is going away.
function closeDialog(quick=false){
 const d=$('#detail');if(!d.open||morphing)return;
 modalId=null;
 if(quick&&morphSrc){morphSrc.style.visibility='';morphSrc=null;}
 morph(false);
}
function render(){
 renderNav();
 if(S.view==='model')renderModel(S.sub);
 else if(S.view==='quote')renderQuote(S.sub);
 else({catalog:renderCatalog,rank:renderRank,cost:renderCost,compare:renderCompare,learn:renderLearn}[S.view])();
 renderTray();
 const m=$('#main');
 if(m){
  m.classList.remove('view-enter');
  void m.offsetWidth;
  m.classList.add('view-enter');
 }
 requestAnimationFrame(()=>syncGliders());
}
function refreshEquipment(){
 const vs=(modalId?[vget(modalId)]:comparisonIds().map(vget)).filter(Boolean);const block=modalId?$('#detailBody .equipment-block'):$('#main .equipment-block');
 if(!block)return;const temp=document.createElement('div');temp.innerHTML=rawEquipment(vs);block.querySelector('#eqGroups').innerHTML=temp.querySelector('#eqGroups').innerHTML;block.querySelector('.eq-controls .small').textContent=temp.querySelector('.eq-controls .small').textContent;
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,id=b.dataset.id;
 if(action==='theme'){
  S.theme=S.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=S.theme;
  try{localStorage.setItem('byd-theme',S.theme);}catch{}
  save();
  renderNav();
  return;
 }
 if(action==='view'){if(b.dataset.menu&&!canHover()&&flyMenu!==id){event.preventDefault();openFly(id);return;}if(modalId)closeDialog(true);if(id==='compare')familyCompareIds=null;navigate(id);}
 if(action==='model'){if(modalId)closeDialog(true);navigate('model',id);}
 if(action==='rankGroup'){const g=RANK_GROUPS.find(x=>x[0]===id);S.rankSort=g[1][0];S.rankDir='';if(S.view==='rank'){closeFly();renderLadder();}else navigate('rank',id);}
 if(action==='learnTab'){navigate('learn',id);}
 if(action==='ladderModel'){const f=fget(id);Object.assign(S,{type:f.type,seg:f.segment,body:''});navigate('rank',groupOf(S.rankSort));}
 if(action==='selectedCompare'){if(modalId)closeDialog(true);familyCompareIds=null;S.eqQuery='';navigate('compare');}
 if(action==='lang'){S.lang=id;save();render();if(modalId)renderDetail(modalId);}
 if(action==='type'){S.type=id;S.family='';refreshFilters();}
 if(action==='seg'||action==='body'){S[action]=id;refreshFilters();}
 if(action==='costAuto'){S.cost.auto=id==='auto';save();document.querySelector('.cost-panel').innerHTML=costInputs();renderCostList();}
 if(action==='costReset'){S.cost={...COST_DEFAULT};save();document.querySelector('.cost-panel').innerHTML=costInputs();renderCostList();}
 if(action==='quote'){if(modalId)closeDialog(true);navigate('quote',id);}
 if(action==='rankDir'){S.rankDir=ladderAsc()?'desc':'asc';renderLadder();}
 if(action==='rankSortBy'){if(S.rankSort===id)S.rankDir=ladderAsc()?'desc':'asc';else{S.rankSort=id;S.rankDir='';}renderLadder();}
 if(action==='resetLadder'){Object.assign(S,{type:'',seg:'',body:''});refreshFilters();}
 if(action==='version'){S.familyVersion[vget(id).family]=id;renderCards();}
 if(action==='add')add(id);
 if(action==='pickColor'){
  S.activeColor=id;
  if(modalId){
   const v=vget(modalId);
   if(v)S.quoteColor[v.id]=id;
  }
  document.querySelectorAll('.colors .color').forEach(el=>{
   const on=el.dataset.id===id;
   el.classList.toggle('active',on);
   el.setAttribute('aria-checked',on);
  });
  return;
 }
 if(action==='detail'){
  S.eqQuery='';
  const origin=b.closest('.car-card, .l-row, .version-card, .highlight, .hero-media, th, .tray-chip, .model-image-box')||b;
  renderDetail(id,origin);
 }
 if(action==='close')closeDialog();
 if(action==='palette')openPalette();
 if(action==='clear'){S.selected=[];familyCompareIds=null;save();render();}
 if(action==='reset'){Object.assign(S,{type:'',family:'',seg:'',body:'',query:'',price:'msrp',budget:0,sort:''});renderCatalog();}
 if(action==='familyCompare'){if(modalId)closeDialog(true);familyCompareIds=D.versions.filter(v=>v.family===id).map(v=>v.id);S.diff=false;S.eqQuery='';navigate('compare');}
 if(action==='print')window.print();
});
document.addEventListener('input',event=>{const el=event.target;if(el.dataset.cost){onCostInput(el);return;}if(el.id==='qAdvisor'||el.id==='qPhone'){try{localStorage.setItem('byd-quote-advisor',JSON.stringify({name:$('#qAdvisor').value,phone:$('#qPhone').value}));}catch{}return;}if(el.id==='query'){S.query=el.value;renderCards();}if(el.id==='eqQuery'){S.eqQuery=el.value;refreshEquipment();}});
document.addEventListener('change',event=>{
 const el=event.target,id=el.id;
 if(['family','price','sort','budget'].includes(id)){S[id]=id==='budget'?Number(el.value):el.value;renderCards();}
 if(id==='rankSort'){S.rankSort=el.value;S.rankDir='';renderLadder();}
 if(id==='quoteColor'){S.quoteColor[el.dataset.id]=el.value;renderQuote(el.dataset.id);}
 if(id==='onlyDiff'){S.diff=el.checked;$('#comparisonContent').innerHTML=compareContent(comparisonIds().map(vget).filter(Boolean));}
});
// Flyouts: hover on pointer devices, tap on touch, ArrowDown / Escape from the keyboard.
$('#nav').addEventListener('mouseover',e=>{if(!canHover())return;const b=e.target.closest('[data-menu]');if(b)openFly(b.dataset.menu);else if(e.target.closest('.nav-links button,.nav-actions,.brand'))closeFly(120);});
$('#nav').addEventListener('mouseleave',()=>{if(canHover())closeFly(220);});
$('#flyout').addEventListener('mouseenter',()=>clearTimeout(flyTimer));
$('#flyout').addEventListener('mouseleave',()=>{if(canHover())closeFly(220);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&flyMenu){const m=flyMenu;closeFly();document.querySelector(`[data-menu="${m}"]`)?.focus();}if(e.key==='ArrowDown'&&e.target.matches('[data-menu]')){e.preventDefault();openFly(e.target.dataset.menu,true);}});
document.addEventListener('click',e=>{if(flyMenu&&!e.target.closest('#nav,#flyout'))closeFly();},true);
$('#nav').addEventListener('pointermove',e=>{const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--nx',`${(e.clientX-r.left).toFixed(0)}px`);},{passive:true});
document.addEventListener('pointermove',e=>{
 const card=e.target.closest('.car-card, .highlight, .hero-media, .version-card, .source-card, .knowledge, .dialog-hero-media');
 if(card){
  const rect=card.getBoundingClientRect();
  card.style.setProperty('--mx',`${(e.clientX-rect.left).toFixed(1)}px`);
  card.style.setProperty('--my',`${(e.clientY-rect.top).toFixed(1)}px`);
 }
},{passive:true});
window.addEventListener('resize',()=>syncGliders(),{passive:true});
$('#detail').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
$('#detail').addEventListener('close',()=>{modalId=null;});
window.addEventListener('hashchange',()=>{Object.assign(S,parseHash());if(S.view==='rank'&&S.sub&&groupOf(S.rankSort)!==S.sub){const g=RANK_GROUPS.find(x=>x[0]===S.sub);if(g){S.rankSort=g[1][0];S.rankDir='';}}closeFly();render();window.scrollTo({top:0,behavior:'instant'});});
// Quick search (⌘K on Mac, Ctrl K elsewhere, or "/"): jump straight to a model page or a version's details.
let palItems=[],palActive=0;
const compact=s=>s.replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
function palIndex(){
 // Type words include everyday short forms (插混, 电车, EV…) as well as the interface labels.
 const words=(type,seg,body)=>[I.strings[type==='BEV'?'bev':'phev'],type==='BEV'?'ev 电动 电车':'插混 混动 hybrid hibrido',I.strings['seg'+seg],I.strings['body_'+body]].filter(Boolean).flat().join(' ');
 const models=D.families.map(f=>{const vs=D.versions.filter(v=>v.family===f.id),lo=Math.min(...vs.map(v=>v.msrp).filter(C.present));
  return {kind:'model',id:f.id,title:f.name,sub:`${t(f.type==='BEV'?'bev':'phev')} · ${vs.length} ${t('versions')}`,right:Number.isFinite(lo)?`${t('from')} ${kEuro(lo)}`:'',img:f.image,hay:I.norm(`${f.name} ${f.id} ${f.type} ${words(f.type,f.segment,f.body)}`)};});
 const versions=D.versions.map(v=>({kind:'version',id:v.id,title:`${v.name} · ${v.version}`,sub:`${fmt(C.total(v),0)} km · ${cv(v.power)} CV`,right:kEuro(v.msrp),img:v.image,hay:I.norm(`${v.name} ${v.version} ${v.type} ${words(v.type,v.segment,v.body)}`)}));
 return [...models,...versions];
}
function palSearch(q){
 const all=palIndex(),tokens=I.norm(q).split(/\s+/).filter(Boolean);
 if(!tokens.length)return all.filter(x=>x.kind==='model');
 const hit=x=>tokens.every(k=>x.hay.includes(k)||(compact(k)&&compact(x.hay).includes(compact(k))));
 // Prefer titles starting with the query, then matches at word starts ("dolphin g" → DOLPHIN G, not "Design"), models before versions.
 const wordStart=(h,k)=>new RegExp('(^|[^a-z0-9])'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(h)||/[^\x00-\x7f]/.test(k);
 const score=x=>{const n=I.norm(x.title);return (n.startsWith(tokens[0])?0:4)+(tokens.every(k=>wordStart(x.hay,k))?0:2)+(x.kind==='model'?0:1);};
 return all.filter(hit).map((x,i)=>({x,i,s:score(x)})).sort((a,b)=>a.s-b.s||a.i-b.i).map(r=>r.x).slice(0,14);
}
function renderPalette(){
 const q=$('#palQuery').value;palItems=palSearch(q);palActive=Math.min(palActive,Math.max(0,palItems.length-1));
 let last='';
 $('#palList').innerHTML=palItems.length?palItems.map((x,i)=>{const head=x.kind!==last?`<div class="pal-group" role="presentation">${t(x.kind==='model'?'catalog':'palVersions')}</div>`:'';last=x.kind;
  return `${head}<button class="pal-item" role="option" id="pal-${i}" data-pal="${i}" aria-selected="${i===palActive}" tabindex="-1"><img src="${x.img}" alt="" loading="lazy"><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><em class="num">${esc(x.right)}</em></button>`;}).join(''):`<p class="pal-empty">${t('palEmpty')}</p>`;
 $('#palQuery').setAttribute('aria-activedescendant',palItems.length?`pal-${palActive}`:'');
}
function palMove(i){palActive=(i+palItems.length)%palItems.length;$('#palList').querySelectorAll('.pal-item').forEach((el,j)=>el.setAttribute('aria-selected',j===palActive));$('#pal-'+palActive)?.scrollIntoView({block:'nearest'});$('#palQuery').setAttribute('aria-activedescendant','pal-'+palActive);}
function openPalette(){
 const p=$('#palette');if(!p||p.open)return;closeFly();
 $('#palQuery').placeholder=t('search');$('#palQuery').setAttribute('aria-label',t('search'));$('#palHint').textContent=t('palHint');
 $('#palQuery').value='';palActive=0;renderPalette();p.showModal();$('#palQuery').focus();
}
function palPick(i){
 const x=palItems[i];if(!x)return;$('#palette').close();
 if(x.kind==='model'){if(modalId)closeDialog(true);navigate('model',x.id);}else{S.eqQuery='';renderDetail(x.id);}
}
$('#palQuery').addEventListener('input',()=>{palActive=0;renderPalette();});
$('#palQuery').addEventListener('keydown',e=>{
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(palItems.length)palMove(palActive+(e.key==='ArrowDown'?1:-1));}
 if(e.key==='Enter'){e.preventDefault();palPick(palActive);}
});
$('#palList').addEventListener('click',e=>{const b=e.target.closest('[data-pal]');if(b)palPick(Number(b.dataset.pal));});
$('#palList').addEventListener('pointermove',e=>{const b=e.target.closest('[data-pal]');if(b&&Number(b.dataset.pal)!==palActive)palMove(Number(b.dataset.pal));});
$('#palette').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
const typing=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='k'){e.preventDefault();const p=$('#palette');p.open?p.close():openPalette();return;}
 if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!typing(e.target)){e.preventDefault();openPalette();}
});
// Row lens: one clear glass capsule glides to the hovered row of the ranking and cost lists (mouse only).
document.addEventListener('pointerover',e=>{
 if(e.pointerType!=='mouse')return;
 const row=e.target.closest?.('#ladder > .l-row, #costList > .l-row');if(!row)return;
 const box=row.parentElement;let lens=box.querySelector(':scope > .row-lens');
 if(!lens){lens=document.createElement('div');lens.className='row-lens';lens.setAttribute('aria-hidden','true');box.prepend(lens);box.classList.add('has-row-lens');}
 const jump=!lens.classList.contains('on');if(jump)lens.style.transition='none';
 lens.style.setProperty('--ly',`${row.offsetTop}px`);lens.style.height=`${row.offsetHeight}px`;
 if(jump){void lens.offsetWidth;lens.style.transition='';}
 lens.classList.add('on');
},{passive:true});
document.addEventListener('pointerout',e=>{const box=e.target.closest?.('#ladder, #costList');if(box&&!box.contains(e.relatedTarget))box.querySelector(':scope > .row-lens')?.classList.remove('on');},{passive:true});
render();
})();
