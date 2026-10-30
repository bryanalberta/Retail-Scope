/* RetailScope analysis engine. No external analytics dependency. UTC calendar dates. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const aliases = {
    invoice:['invoice','invoiceno','orderid','transactionid','idtransaksi','nomorpesanan'],
    date:['date','invoicedate','orderdate','transactiondate','trxdate','tanggal','tanggaltransaksi','waktupesanandibuat','tgl'],
    customer:['customerid','custid','idpelanggan','pelangganid','userid','buyerid'],
    product:['stockcode','productid','kodeproduk','sku'],
    description:['description','productname','namaproduk','product','name'],
    category:['productcategories','category','categories','kategori','kategoriproduk'],
    quantity:['quantity','qty','jumlah','kuantitas','quantityorder','totalqty'],
    price:['price','unitprice','itemprice','priceperunit','unitpriceidr','hargasatuan'],
    amount:['totalpembayaran','ordertotal','totalpayment','totalamount'],
    payment:['metodepembayaran','paymentmethod','payment','carabayar','metodebayar'],
    shipping:['opsipengiriman','shippingoption','shippingmethod','kurir','ekspedisi','jasaekspedisi'],
    region:['province','provinsi','shippingprovince','region','area','country'],
    city:['city','kota','shippingcity','kotakabupaten'],
    status:['status','orderstatus','statuspesanan'],
    line:['itemid','lineid','salesid','rowid']
  };
  const norm = s => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const str = s => String(s ?? '').trim();
  function detect(headers) {
    return Object.fromEntries(Object.entries(aliases).map(([key,names]) => [key,headers.find(h=>names.includes(norm(h))) || '']));
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/,'');
    const first = text.split(/\r?\n/)[0];
    const delim = (first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length ? ';' : ',';
    const records=[]; let row=[], value='', quoted=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') { if(quoted && text[i+1]==='"') {value+='"';i++;} else quoted=!quoted; }
      else if(!quoted && c===delim) {row.push(value);value='';}
      else if(!quoted && (c==='\n'||c==='\r')) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))records.push(row);row=[];value='';}
      else value+=c;
    }
    if(quoted) throw Error('CSV memiliki tanda kutip yang belum ditutup.');
    row.push(value);if(row.some(x=>x.trim()))records.push(row);
    if(records.length<2)throw Error('File harus berisi header dan sedikitnya satu baris data.');
    const headers=records.shift().map(str);
    if(new Set(headers).size!==headers.length || headers.some(h=>!h))throw Error('Nama kolom harus terisi dan unik.');
    const bad=records.findIndex(r=>r.length!==headers.length);
    if(bad>=0)throw Error('Jumlah kolom CSV tidak konsisten pada baris '+(bad+2)+'.');
    return {headers,rows:records.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])))};
  }
  function dateValue(v,order='dmy') {
    if(v instanceof Date) return Date.UTC(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate());
    if(typeof v==='number')return Math.floor((v-25569))*DAY;
    const s=str(v); let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/),y,mo,d;
    if(m) [,y,mo,d]=m.map(Number);
    else {m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s.*)?$/);if(!m)return NaN;y=+m[3];mo=+(order==='mdy'?m[1]:m[2]);d=+(order==='mdy'?m[2]:m[1]);}
    const dt=Date.UTC(y,mo-1,d), check=new Date(dt);
    return y>=1900&&y<=2100&&check.getUTCFullYear()===y&&check.getUTCMonth()===mo-1&&check.getUTCDate()===d ?dt:NaN;
  }
  function numeric(v,format='plain') {
    if(typeof v==='number')return v;
    let s=str(v).replace(/^Rp\s*/i,''); if(!s)return NaN;
    if(format==='id') s=s.replace(/\./g,'').replace(',','.');
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return NaN;
    return Number(s);
  }
  const iso = d=>new Date(d).toISOString().slice(0,10);
  function clean(rows,map,opts={}) {
    const orderMode=opts.valueMode==='order';
    for(const f of (orderMode?['invoice','date','quantity','amount']:['invoice','date','quantity','price']))if(!map[f])throw Error('Pemetaan kolom wajib belum lengkap: '+f);
    if(!orderMode&&!map.product&&!map.description)throw Error('Pilih kolom ID produk atau nama produk.');
    const counts={raw:rows.length,duplicates:0,cancelled:0,pending:0,invalid:0,valid:0,missingCustomer:0,missingDescription:0};
    const seen=new Set(),orderIds=new Set(),out=[];
    for(const src of rows) {
      // Full source row equality: preserves distinct line IDs and other source fields.
      const key=JSON.stringify(Object.keys(src).sort().map(k=>[k,src[k]]));
      if(opts.dedupe!==false&&seen.has(key)){counts.duplicates++;continue;}seen.add(key);
      const invoice=str(src[map.invoice]),status=norm(src[map.status]);
      const q=map.quantity?numeric(src[map.quantity],opts.numberFormat):(orderMode?1:NaN),p=orderMode?null:numeric(src[map.price],opts.numberFormat),total=orderMode?numeric(src[map.amount],opts.numberFormat):q*p,date=dateValue(src[map.date],opts.dateOrder);
      if((opts.invoiceCancellation && /^c/i.test(invoice)) || /^(cancelled|canceled|dibatalkan|batal|returned|retur|refunded|refund|dikembalikan)$/.test(status) || q<0){counts.cancelled++;continue;}
      if(status && !/^(completed|complete|selesai|delivered|success|successful|paid|terkirim|diterima|lunas)$/.test(status)){counts.pending++;continue;}
      const product=orderMode?'':(str(src[map.product])||str(src[map.description]));
      if(!invoice||(!orderMode&&!product)||!Number.isFinite(date)||!Number.isFinite(q)||q<=0||(!orderMode&&(!Number.isFinite(p)||p<=0))||!Number.isFinite(total)||total<=0){counts.invalid++;continue;}
      if(orderMode&&orderIds.has(invoice))throw Error('Mode total per pesanan membutuhkan satu baris per ID pesanan. ID berulang: '+invoice+'. Gabungkan atau periksa sumber agar total tidak dihitung dua kali.');
      orderIds.add(invoice);
      let customerRaw=str(src[map.customer]); let customer=/^(nan|null|none|undefined)$/i.test(customerRaw)?'':customerRaw;
      if(!customer&&opts.proxyCustomer){const loc=norm(src[map.city]||src[map.region]||'ID');const bucket=Math.abs((loc.split('').reduce((acc,c)=>acc*31+c.charCodeAt(0),0)^(out.length%283))%350)+1;customer='PLG-SIM-'+String(bucket).padStart(4,'0');}
      if(!customer)counts.missingCustomer++;
      let description=str(src[map.description]);if(!description&&!orderMode){description=product;counts.missingDescription++;}
      const rawDateStr=str(src[map.date]);const tm=rawDateStr.match(/[T\s](\d{1,2}):/);const hour=tm?Number(tm[1]):null;
      const category=str(src[map.category])||'';const payment=str(src[map.payment])||'';const shipping=str(src[map.shipping])||'';
      out.push({invoice,date,hour,customer,product,description,category,payment,shipping,quantity:q,price:p,total,valueMode:orderMode?'order':'item',region:str(src[map.region])||'Tidak diketahui',city:str(src[map.city])||'Tidak diketahui'});
    }
    counts.valid=out.length;return {rows:out,counts};
  }
  const distance=(a,b)=>a.reduce((s,v,j)=>s+(v-b[j])**2,0);
  function rng(seed=42){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function standardize(values) {
    const means=[0,1,2].map(j=>values.reduce((s,r)=>s+r[j],0)/values.length);
    const scales=means.map((m,j)=>Math.sqrt(values.reduce((s,r)=>s+(r[j]-m)**2,0)/values.length)||1);
    return {values:values.map(r=>r.map((v,j)=>(v-means[j])/scales[j])),means,scales};
  }
  function kmeans(values,k,seed=42) {
    let best=null;
    for(let run=0;run<5;run++) {
      const random=rng(seed+run), centers=[values[Math.floor(random()*values.length)].slice()];
      while(centers.length<k) {
        const weights=values.map(v=>Math.min(...centers.map(c=>distance(v,c)))),sum=weights.reduce((a,b)=>a+b,0);
        let target=random()*sum,index=weights.length-1;for(let i=0;i<weights.length;i++){target-=weights[i];if(target<=0){index=i;break;}}
        centers.push(values[index].slice());
      }
      let labels=new Array(values.length).fill(-1),iterations=0;
      for(;iterations<100;iterations++) {
        let changed=false;const sums=Array.from({length:k},()=>[0,0,0]),counts=new Array(k).fill(0);
        values.forEach((v,i)=>{let group=0,min=Infinity;centers.forEach((c,j)=>{const d=distance(v,c);if(d<min){min=d;group=j;}});if(labels[i]!==group)changed=true;labels[i]=group;counts[group]++;v.forEach((x,j)=>sums[group][j]+=x);});
        centers.forEach((_,j)=>{if(counts[j])centers[j]=sums[j].map(x=>x/counts[j]);else centers[j]=values[Math.floor(random()*values.length)].slice();});
        if(!changed)break;
      }
      const inertia=values.reduce((s,v,i)=>s+distance(v,centers[labels[i]]),0);
      if(!best||inertia<best.inertia)best={labels,centers,inertia,iterations:Math.min(iterations+1,100),k};
    }
    return best;
  }
  function silhouette(values,labels,limit=500) {
    // Deterministic uniform sample; exact pairwise silhouette within this sample.
    const n=Math.min(values.length,limit), ids=Array.from({length:n},(_,i)=>Math.floor(i*values.length/n));
    const groups=new Set(ids.map(i=>labels[i]));if(groups.size<2||groups.size>=n)return null;
    let score=0;
    for(const i of ids){const sums=new Map(),counts=new Map();for(const j of ids){if(i===j)continue;const g=labels[j];sums.set(g,(sums.get(g)||0)+Math.sqrt(distance(values[i],values[j])));counts.set(g,(counts.get(g)||0)+1);}
      if(!counts.get(labels[i]))continue;const a=sums.get(labels[i])/counts.get(labels[i]);let b=Infinity;for(const g of groups)if(g!==labels[i]&&counts.get(g))b=Math.min(b,sums.get(g)/counts.get(g));
      score+=(b-a)/Math.max(a,b)||0;
    }return score/n;
  }
  function aggregate(rows,filters={}) {
    const start=filters.start?dateValue(filters.start): -Infinity,end=filters.end?dateValue(filters.end):Infinity;
    if(start>end)throw Error('Tanggal mulai harus sebelum tanggal akhir.');
    const selected=rows.filter(r=>r.date>=start&&r.date<=end&&(!filters.region||r.region===filters.region)&&(!filters.city||r.city===filters.city));
    const monthly=new Map(),products=new Map(),categories=new Map(),payments=new Map(),shippings=new Map(),cities=new Map(),regions=new Map(),customers=new Map(),invoices=new Set();
    const hours=Array.from({length:24},(_,h)=>({hour:h,label:String(h).padStart(2,'0')+':00',orders:0,revenue:0}));
    const dayNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const days=dayNames.map((name,i)=>({day:i,name,orders:new Set(),revenue:0,units:0}));
    let revenue=0,units=0,min=Infinity,max=-Infinity;
    for(const r of selected){min=Math.min(min,r.date);max=Math.max(max,r.date);revenue+=r.total;units+=r.quantity;invoices.add(r.invoice);
      const month=iso(r.date).slice(0,7);if(!monthly.has(month))monthly.set(month,{month,revenue:0,orders:new Set(),units:0});let a=monthly.get(month);a.revenue+=r.total;a.orders.add(r.invoice);a.units+=r.quantity;
      if(r.product){if(!products.has(r.product))products.set(r.product,{id:r.product,name:r.description,quantity:0,revenue:0});a=products.get(r.product);a.quantity+=r.quantity;a.revenue+=r.total;}
      if(!regions.has(r.region))regions.set(r.region,{name:r.region,revenue:0,orders:new Set()});a=regions.get(r.region);a.revenue+=r.total;a.orders.add(r.invoice);
      if(r.category){const cats=r.category.split(',').map(s=>s.trim()).filter(Boolean);for(const cat of cats){if(!categories.has(cat))categories.set(cat,{name:cat,orders:new Set(),quantity:0,revenue:0});const c=categories.get(cat);c.orders.add(r.invoice);c.quantity+=r.quantity;c.revenue+=r.total;}}
      if(r.payment){if(!payments.has(r.payment))payments.set(r.payment,{name:r.payment,orders:new Set(),revenue:0});const p=payments.get(r.payment);p.orders.add(r.invoice);p.revenue+=r.total;}
      if(r.shipping){if(!shippings.has(r.shipping))shippings.set(r.shipping,{name:r.shipping,orders:new Set(),revenue:0});const sh=shippings.get(r.shipping);sh.orders.add(r.invoice);sh.revenue+=r.total;}
      if(r.city&&r.city!=='Tidak diketahui'){if(!cities.has(r.city))cities.set(r.city,{name:r.city,province:r.region,orders:new Set(),revenue:0});const ct=cities.get(r.city);ct.orders.add(r.invoice);ct.revenue+=r.total;}
      if(r.hour!==null&&r.hour>=0&&r.hour<24){hours[r.hour].orders++;hours[r.hour].revenue+=r.total;}
      const dow=new Date(r.date).getUTCDay();days[dow].orders.add(r.invoice);days[dow].revenue+=r.total;days[dow].units+=r.quantity;
      if(r.customer){if(!customers.has(r.customer))customers.set(r.customer,{id:r.customer,last:r.date,invoices:new Set(),monetary:0});a=customers.get(r.customer);a.last=Math.max(a.last,r.date);a.invoices.add(r.invoice);a.monetary+=r.total;}
    }
    const orderBaskets=new Map(),customerBaskets=new Map();
    for(const r of selected){
      const items=[];
      if(r.category)r.category.split(/[,\/;|]+/).map(s=>s.trim()).filter(Boolean).forEach(c=>items.push(c));
      else if(r.product||r.description)items.push(r.description||r.product);
      if(items.length){
        if(!orderBaskets.has(r.invoice))orderBaskets.set(r.invoice,new Set());
        items.forEach(it=>orderBaskets.get(r.invoice).add(it));
        if(r.customer){
          if(!customerBaskets.has(r.customer))customerBaskets.set(r.customer,new Set());
          items.forEach(it=>customerBaskets.get(r.customer).add(it));
        }
      }
    }
    let basketType='order',multiBaskets=[...orderBaskets.values()].filter(s=>s.size>=2),totalBaskets=orderBaskets.size;
    if(multiBaskets.length<5&&customerBaskets.size>0){
      basketType='customer';
      multiBaskets=[...customerBaskets.values()].filter(s=>s.size>=2);
      totalBaskets=customerBaskets.size;
    }
    const itemFreq=new Map(),pairFreq=new Map();
    const allBasketsSource=basketType==='order'?orderBaskets.values():customerBaskets.values();
    for(const b of allBasketsSource)for(const item of b)itemFreq.set(item,(itemFreq.get(item)||0)+1);
    for(const b of multiBaskets){
      const arr=[...b].sort();
      for(let i=0;i<arr.length;i++){
        for(let j=i+1;j<arr.length;j++){
          const k=arr[i]+' <-> '+arr[j];
          pairFreq.set(k,(pairFreq.get(k)||0)+1);
        }
      }
    }
    const N_baskets=Math.max(1,totalBaskets),rules=[];
    for(const [k,count] of pairFreq.entries()){
      const [itemA,itemB]=k.split(' <-> ');
      const freqA=itemFreq.get(itemA)||count,freqB=itemFreq.get(itemB)||count;
      const confAtoB=count/freqA,confBtoA=count/freqB;
      const expected=(freqA*freqB)/N_baskets;
      const lift=expected>0?count/expected:1;
      const [ante,cons,conf]=confAtoB>=confBtoA?[itemA,itemB,confAtoB]:[itemB,itemA,confBtoA];
      let strat='Tawarkan paket hemat diskon untuk kedua kategori ini.';
      if(lift>1.5)strat=`Tampilkan pop-up 'Beli Bersama' untuk ${cons} saat pembeli memilih ${ante} (Lift ${lift.toFixed(1)}×).`;
      else if(conf>0.4)strat=`Rekomendasikan ${cons} di halaman checkout bagi pembeli ${ante} (${Math.round(conf*100)}% kepastian beli).`;
      rules.push({pair:k,antecedent:ante,consequent:cons,count,support:count/N_baskets,confidence:conf,lift,strategy:strat});
    }
    rules.sort((a,b)=>b.lift-a.lift||b.confidence-a.confidence);
    const basketAnalysis={rules:rules.slice(0,8),type:basketType,multiBaskets:multiBaskets.length,totalBaskets};
    const reference=selected.length?max+DAY:null;
    const rfm=[...customers.values()].map(c=>({id:c.id,recency:Math.round((reference-c.last)/DAY),frequency:c.invoices.size,monetary:c.monetary})).sort((a,b)=>a.id.localeCompare(b.id));
    const months=[];if(selected.length){let cur=new Date(min);cur=new Date(Date.UTC(cur.getUTCFullYear(),cur.getUTCMonth(),1));while(cur.getTime()<=max){const month=iso(cur.getTime()).slice(0,7),a=monthly.get(month);months.push({month,revenue:a?.revenue||0,orders:a?.orders.size||0,units:a?.units||0});cur.setUTCMonth(cur.getUTCMonth()+1);}}
    const orderedDays=[1,2,3,4,5,6,0].map(i=>({day:days[i].day,name:days[i].name,orders:days[i].orders.size,revenue:days[i].revenue,units:days[i].units}));
    const repeatCusts=rfm.filter(c=>c.frequency>1),repeatCustomers=repeatCusts.length,oneTimeCustomers=Math.max(0,rfm.length-repeatCustomers),repeatRevenue=repeatCusts.reduce((s,c)=>s+c.monetary,0),repeatRatePct=rfm.length?(repeatCustomers/rfm.length)*100:0,repeatRevenueSharePct=revenue?(repeatRevenue/revenue)*100:0;
    const sortedCustByRev=[...rfm].sort((a,b)=>b.monetary-a.monetary),top20CustCount=rfm.length?Math.max(1,Math.ceil(rfm.length*0.2)):0,top20CustRev=sortedCustByRev.slice(0,top20CustCount).reduce((s,c)=>s+c.monetary,0),top20CustomerSharePct=revenue?(top20CustRev/revenue)*100:0;
    const allProds=[...products.values()],sortedProdByRev=[...allProds].sort((a,b)=>b.revenue-a.revenue),top20ProdCount=allProds.length?Math.max(1,Math.ceil(allProds.length*0.2)):0,top20ProdRev=sortedProdByRev.slice(0,top20ProdCount).reduce((s,p)=>s+p.revenue,0),top20ProductSharePct=revenue?(top20ProdRev/revenue)*100:0;
    const pareto={repeatCustomers,oneTimeCustomers,repeatRatePct,repeatRevenueSharePct,top20CustomerCount:top20CustCount,top20CustomerSharePct,top20ProductCount:top20ProdCount,top20ProductSharePct};
    return {summary:{rows:selected.length,revenue,units,orders:invoices.size,customers:rfm.length,aov:invoices.size?revenue/invoices.size:0,start:selected.length?iso(min):null,end:selected.length?iso(max):null,reference:reference?iso(reference):null},pareto,monthly:months,products:allProds.sort((a,b)=>b.quantity-a.quantity),categories:[...categories.values()].map(c=>({...c,orders:c.orders.size})).sort((a,b)=>b.orders-a.orders),payments:[...payments.values()].map(p=>({...p,orders:p.orders.size})).sort((a,b)=>b.orders-a.orders),shipping:[...shippings.values()].map(s=>({...s,orders:s.orders.size})).sort((a,b)=>b.orders-a.orders),cities:[...cities.values()].map(c=>({...c,orders:c.orders.size})).sort((a,b)=>b.orders-a.orders),hourly:hours,dayOfWeek:orderedDays,regions:[...regions.values()].map(a=>({...a,orders:a.orders.size})).sort((a,b)=>b.orders-a.orders),basketAnalysis,rfm,preview:selected.slice(0,15)};
  }
  function segment(rfm,requested='auto') {
    if(rfm.length<3)return {customers:rfm,clusters:[],evaluation:[],k:0,message:'Ilmu segmentasi memerlukan setidaknya 3 pelanggan dengan ID valid.'};
    const transformed=standardize(rfm.map(c=>[c.recency,c.frequency,c.monetary].map(Math.log1p)));
    const values=transformed.values,unique=new Set(values.map(v=>v.join(','))).size;
    const maxK=Math.min(8,rfm.length-1,unique);
    if(maxK<2)return {customers:rfm,clusters:[],evaluation:[],k:0,message:'Profil RFM identik; tidak ada pemisahan cluster yang bermakna.'};
    const evaluation=[],models=new Map();for(let k=2;k<=maxK;k++){const model=kmeans(values,k);if(new Set(model.labels).size!==k)continue;const score=silhouette(values,model.labels);evaluation.push({k,inertia:model.inertia,silhouette:score});models.set(k,model);}
    const ranked=evaluation.filter(e=>e.silhouette!==null).sort((a,b)=>b.silhouette-a.silhouette);
    const recommended=ranked[0]?.k||evaluation[0]?.k;
    if(!recommended)return {customers:rfm,clusters:[],evaluation,k:0,message:'K-Means belum menghasilkan kelompok yang terpisah.'};
    if(requested!=='auto'&&!models.has(Number(requested)))throw Error('Jumlah cluster terlalu besar untuk variasi pelanggan dalam filter ini. Pilih Otomatis.');
    const model=models.get(requested==='auto'?recommended:Number(requested));
    let clusters=Array.from({length:model.k},(_,id)=>({id,count:0,recency:0,frequency:0,monetary:0,revenue:0}));
    rfm.forEach((c,i)=>{const a=clusters[model.labels[i]];a.count++;a.recency+=c.recency;a.frequency+=c.frequency;a.monetary+=c.monetary;a.revenue+=c.monetary;});
    clusters=clusters.map(a=>({...a,recency:a.recency/a.count,frequency:a.frequency/a.count,monetary:a.monetary/a.count})).sort((a,b)=>b.monetary-a.monetary);
    const avgR=rfm.reduce((s,c)=>s+c.recency,0)/rfm.length;const avgF=rfm.reduce((s,c)=>s+c.frequency,0)/rfm.length;const avgM=rfm.reduce((s,c)=>s+c.monetary,0)/rfm.length;
    const labels=new Map(clusters.map((c,i)=>[c.id,i]));
    const maxR=Math.max(...rfm.map(c=>c.recency))||1;
    const maxF=Math.max(...rfm.map(c=>c.frequency))||1;
    const enhancedCustomers=rfm.map((c,i)=>{
      const clusterIdx=labels.get(model.labels[i]);
      const rRisk=Math.min(1,c.recency/Math.max(14,maxR));
      const fLoyalty=Math.min(1,(c.frequency-1)/Math.max(1,maxF-1));
      const churnProb=Math.min(98,Math.max(5,Math.round((rRisk*0.7+(1-fLoyalty)*0.3)*100)));
      const churnRisk=churnProb>=70?'Tinggi':churnProb>=40?'Sedang':'Rendah';
      const aov=c.monetary/Math.max(1,c.frequency);
      const activeSpan=Math.max(14,maxR-c.recency+14);
      const annualFreq=Math.max(1,Math.min(24,(c.frequency/activeSpan)*365));
      const lifespanYears=Math.max(0.2,(1-churnProb/100)*2+0.3);
      const clv=Math.round(aov*annualFreq*lifespanYears*0.2);
      return {...c,cluster:clusterIdx,churnProb,churnRisk,clv};
    });
    clusters=clusters.map((c,i)=>{
      let persona='Pelanggan Reguler', strategy='Pertahankan kepuasan dan tingkatkan frekuensi belanja.';
      if(c.monetary>=avgM&&c.frequency>=avgF&&c.recency<=avgR){persona='Champions (Loyal)';strategy='Berikan apresiasi eksklusif, program VIP, dan akses lebih awal produk baru.';}
      else if(c.monetary>=avgM&&c.recency>avgR){persona='At-Risk (Bernilai Tinggi)';strategy='Kirim penawaran re-aktivasi personal dan voucher bernilai tinggi.';}
      else if(c.frequency>=avgF&&c.recency<=avgR){persona='Potensial Aktif';strategy='Tawarkan bundling produk (cross-selling) untuk menaikkan nilai pesanan.';}
      else if(c.recency<=avgR){persona='Pelanggan Baru';strategy='Kirim voucher pesanan kedua dan rekomendasi katalog produk unggulan.';}
      else{persona='Dormant / Hibernasi';strategy='Jalankan promosi musiman berkala atau promo bebas ongkir untuk menarik minat kembali.';}
      const members=enhancedCustomers.filter(cust=>cust.cluster===i);
      members.forEach(m=>{m.persona=persona;});
      const avgChurn=members.length?Math.round(members.reduce((s,x)=>s+x.churnProb,0)/members.length):0;
      const totalCLV=members.reduce((s,x)=>s+x.clv,0);
      const avgCLV=members.length?Math.round(totalCLV/members.length):0;
      const highChurnCount=members.filter(x=>x.churnProb>=70).length;
      return {...c,id:i,name:'Cluster '+(i+1),persona,strategy,avgChurn,avgCLV,totalCLV,highChurnPct:members.length?Math.round(highChurnCount/members.length*100):0};
    });
    const totalPortfolioCLV=enhancedCustomers.reduce((s,c)=>s+c.clv,0);const avgPortfolioChurn=Math.round(enhancedCustomers.reduce((s,c)=>s+c.churnProb,0)/enhancedCustomers.length);
    return {customers:enhancedCustomers,clusters,evaluation,k:model.k,recommended,silhouette:evaluation.find(e=>e.k===model.k).silhouette,inertia:model.inertia,iterations:model.iterations,sampleSize:Math.min(500,rfm.length),scaler:{means:transformed.means,scales:transformed.scales},seed:42,totalCLV:totalPortfolioCLV,avgChurn:avgPortfolioChurn};
  }
  function demo() {
    const random=rng(2026),rows=[];
    const places=[['DKI Jakarta','Jakarta Selatan'],['Jawa Barat','Bandung'],['Jawa Timur','Surabaya'],['Jawa Tengah','Semarang'],['DI Yogyakarta','Yogyakarta'],['Banten','Tangerang'],['Sumatera Utara','Medan'],['Bali','Denpasar']];
    const products=[['P001','Kopi Arabika 250 g',85000],['P002','Tote Bag Kanvas',45000],['P003','Kaos Katun Basic',99000],['P004','Tumbler Stainless',129000],['P005','Serum Wajah 30 ml',115000],['P006','Kemeja Linen',189000],['P007','Camilan Keripik 200 g',25000],['P008','Buku Catatan A5',35000],['P009','Sambal Kemasan',32000],['P010','Pouch Organizer',59000],['P011','Teh Melati 100 g',28000],['P012','Sabun Natural',39000]];
    let order=0;
    for(let id=1;id<=640;id++){const group=id%4,visits=group===0?15+Math.floor(random()*14):group===1?5+Math.floor(random()*7):1+Math.floor(random()*4),place=places[Math.floor(random()**1.6*places.length)];
      for(let v=0;v<visits;v++){order++;const day=group===2?Math.floor(random()*160):group===3?230+Math.floor(random()*100):Math.floor(random()*334);const date=iso(Date.UTC(2025,0,1)+day*DAY),lines=1+Math.floor(random()*3);
        for(let l=0;l<lines;l++){const p=products[Math.floor(random()*products.length)],quantity=group===0?3+Math.floor(random()*7):1+Math.floor(random()*3);rows.push({order_id:'ORD-'+String(order).padStart(6,'0'),order_date:date,customer_id:'PLG-'+String(id).padStart(4,'0'),product_id:p[0],product_name:p[1],quantity,unit_price:p[2],province:place[0],city:place[1],order_status:random()<.025?'cancelled':'completed'});}
      }
    }
    // Deliberately dirty fixtures make the cleaning workflow visible.
    const original=rows.length;for(let i=0;i<65;i++)rows.push({...rows[i]});
    for(let i=100;i<original;i+=89)rows[i].customer_id='';
    for(let i=250;i<original;i+=331)rows[i].unit_price=0;
    for(let i=400;i<original;i+=777)rows[i].order_date='2025-02-31';
    return {headers:Object.keys(rows[0]),rows};
  }
  const api={parseCSV,dateValue,numeric,detect,clean,aggregate,segment,kmeans,silhouette,standardize,demo,iso};
  if(typeof module!=='undefined')module.exports=api;root.RetailEngine=api;
})(typeof self!=='undefined'?self:globalThis);
