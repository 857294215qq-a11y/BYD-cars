/* Pure comparison rules, shared by catalogue and charts. */
var BYDCore = (() => {
 const lower=new Set(['accel','msrp','cash','finance','fuel','weightedFuel','consumption']);
 const present=v=>typeof v==='number'&&Number.isFinite(v);
 // Total WLTP range: PHEV official combined total; BEV electric range is the whole range.
 const total=v=>v.type==='PHEV'?v.total:v.range;
 const metric=(v,key)=>key==='total'?total(v):v[key];
 const rank=(rows,key,dir)=>{const asc=dir?dir==='asc':lower.has(key);return rows.filter(v=>present(metric(v,key))).slice().sort((a,b)=>(asc?metric(a,key)-metric(b,key):metric(b,key)-metric(a,key))||a.id.localeCompare(b.id));};
 const toggleSelection=(ids,id)=>ids.includes(id)?{ids:ids.filter(x=>x!==id),blocked:false}:ids.length>=4?{ids:ids.slice(),blocked:true}:{ids:[...ids,id],blocked:false};
 const isDifferent=values=>new Set(values.map(v=>v==null?'__unknown__':JSON.stringify(v))).size>1;
 const filter=(rows,f)=>rows.filter(v=>(!f.family||v.family===f.family)&&(!f.type||v.type===f.type)&&(!f.seg||v.segment===f.seg)&&(!f.body||v.body===f.body)&&(!f.query||`${v.name} ${v.version}`.toLowerCase().includes(f.query.toLowerCase().trim()))&&(!f.budget||(present(v[f.price||'msrp'])&&v[f.price||'msrp']<=f.budget)));
 // Tier index = how many breakpoints the value reaches; used for ladder bands.
 const tier=(value,breaks)=>breaks.filter(b=>value>=b).length;
 // Monthly energy cost. PHEV electric share: fixed, or one full charge per day of real-world range (WLTP × realFactor).
 const energyCost=(v,p)=>{
  const price=p.homeShare*p.home+(1-p.homeShare)*p.pub,k=p.km/100;
  if(!present(v.consumption))return null;
  if(v.type!=='PHEV'){const e=k*v.consumption*price;return {elec:e,fuel:0,share:1,total:e};}
  if(!present(v.fuel)||!present(v.range))return null;
  const share=p.phevShare!=null?p.phevShare:Math.min(1,v.range*p.realFactor/(p.km/30));
  const e=k*share*v.consumption*price,f=k*(1-share)*v.fuel*p.petrol;
  return {elec:e,fuel:f,share,total:e+f};
 };
 return {rank,toggleSelection,isDifferent,filter,present,lower,total,metric,tier,energyCost};
})();
