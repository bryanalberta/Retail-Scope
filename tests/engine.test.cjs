const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const base={order_id:'A1',order_date:'2025-01-01',customer_id:'U1',product_id:'P1',product_name:'Kopi',quantity:2,unit_price:100,province:'Jawa Barat',order_status:'completed'};
test('CSV: quoted commas, escaped quotes, multiline, BOM and semicolon',()=>{
 const p=E.parseCSV('\uFEFForder_id;product_name;unit_price\r\nA1;"Kopi; \\"quoted\\"";"12.500,50"'.replace(/\\"/g,'""'));
 assert.equal(p.rows[0].product_name,'Kopi; "quoted"');
 assert.equal(E.parseCSV('a,b\n1,"line1\nline2"').rows[0].b,'line1\nline2');
 assert.throws(()=>E.parseCSV('a,b\n1,2,3'),/konsisten/);
 assert.throws(()=>E.parseCSV('a,b\n1,"bad'),/kutip/);
});
test('date and numeric formats: strict date validation and locale handling',()=>{
 assert.equal(E.iso(E.dateValue('01/02/2025','dmy')),'2025-02-01');
 assert.equal(E.iso(E.dateValue('01/02/2025','mdy')),'2025-01-02');
 assert.equal(E.iso(E.dateValue(45658)),'2025-01-01');
 assert.ok(Number.isNaN(E.dateValue('2025-02-31')));
 assert.ok(Number.isNaN(E.numeric('')));
 assert.equal(E.numeric('Rp 12.500,50','id'),12500.5);
 assert.ok(Number.isNaN(E.numeric('12,500','plain')));
});
test('cleaning stages reconcile; missing IDs stay in sales, never imputed in RFM',()=>{
 const rows=[base,{...base},{...base,order_id:'A2',customer_id:'',quantity:1},{...base,order_id:'A3',order_status:'cancelled'},{...base,order_id:'A4',quantity:-1},{...base,order_id:'A5',order_status:'processing'},{...base,order_id:'A6',unit_price:0},{...base,order_id:'A7',order_date:'2025-02-31'}];
 const c=E.clean(rows,E.detect(Object.keys(base)));assert.deepEqual(c.counts,{raw:8,duplicates:1,cancelled:2,pending:1,invalid:2,valid:2,missingCustomer:1,missingDescription:0});
 const a=E.aggregate(c.rows);assert.equal(a.summary.revenue,300);assert.equal(a.summary.orders,2);assert.equal(a.rfm.length,1);assert.equal(a.rfm[0].monetary,200);
 assert.equal(E.clean(rows,E.detect(Object.keys(base)),{dedupe:false}).counts.duplicates,0);
});
test('Indonesian customer/order identifiers starting with C are not cancellations by default',()=>{
 const rows=[{...base,order_id:'CUST-ORDER-1'}],m=E.detect(Object.keys(base));assert.equal(E.clean(rows,m).rows.length,1);assert.equal(E.clean(rows,m,{invoiceCancellation:true}).rows.length,0);
});
test('RFM uses unique invoices, date maximum + one, and full valid purchases',()=>{
 const rows=[base,{...base,product_id:'P2',quantity:1,unit_price:50},{...base,order_id:'A2',order_date:'2025-01-10',quantity:1},{...base,order_id:'A3',order_date:'2025-01-11',customer_id:'U2',quantity:3}];
 const a=E.aggregate(E.clean(rows,E.detect(Object.keys(base))).rows);
 assert.equal(a.summary.revenue,650);assert.equal(a.summary.orders,3);assert.equal(a.summary.reference,'2025-01-12');
 assert.deepEqual(a.rfm,[{id:'U1',recency:2,frequency:2,monetary:350},{id:'U2',recency:1,frequency:1,monetary:300}]);
 const f=E.aggregate(E.clean(rows,E.detect(Object.keys(base))).rows,{start:'2025-01-10',end:'2025-01-10'});
 assert.equal(f.summary.reference,'2025-01-11');assert.equal(f.rfm[0].recency,1);assert.equal(f.summary.revenue,100);
});
test('filters exclude unrelated data, include zero months, and reject inverted ranges',()=>{
 const rows=E.clean([base,{...base,order_id:'Z',order_date:'2025-03-01',province:'Bali'}],E.detect(Object.keys(base))).rows;
 assert.deepEqual(E.aggregate(rows).monthly.map(m=>m.orders),[1,0,1]);
 assert.equal(E.aggregate(rows,{region:'Bali'}).summary.orders,1);
 assert.equal(E.aggregate(rows,{region:'Missing'}).summary.revenue,0);
 assert.throws(()=>E.aggregate(rows,{start:'2026-01-01',end:'2025-01-01'}),/Tanggal/);
});
test('distinct source line IDs preserve otherwise identical order lines',()=>{
 const rows=[{...base,line_id:'1'},{...base,line_id:'2'}];const clean=E.clean(rows,E.detect(Object.keys(rows[0])));assert.equal(clean.rows.length,2);
});
test('K-Means: deterministic labels, well-separated groups, sensible silhouette',()=>{
 const values=[[0,0,0],[.1,0,0],[0,.1,0],[10,10,10],[10.1,10,10],[10,10.1,10]];
 const k=E.kmeans(values,2);assert.deepEqual(k,E.kmeans(values,2));assert.equal(k.labels[0],k.labels[2]);assert.equal(k.labels[3],k.labels[5]);assert.notEqual(k.labels[0],k.labels[3]);assert.ok(E.silhouette(values,k.labels)>.98);
 // Independent exact silhouette: within-pair distance 1; mean other-pair distances 9.5 and 8.5.
 assert.ok(Math.abs(E.silhouette([[0,0,0],[1,0,0],[9,0,0],[10,0,0]],[0,0,1,1])-((1-1/9.5)+(1-1/8.5))*0.5)<1e-12);
});
test('segment guards: tiny or identical profiles cannot fake clusters',()=>{
 assert.equal(E.segment([{id:'1',recency:1,frequency:1,monetary:10}]).k,0);
 const same=Array.from({length:5},(_,i)=>({id:String(i),recency:1,frequency:1,monetary:10}));assert.equal(E.segment(same).k,0);
 const varied=Array.from({length:12},(_,i)=>({id:String(i),recency:i+1,frequency:i+1,monetary:100*(i+1)}));
 const s=E.segment(varied);assert.equal(s.clusters.reduce((n,c)=>n+c.count,0),12);assert.equal(s.customers.length,12);assert.ok(s.clusters[0].monetary>=s.clusters[1].monetary);assert.throws(()=>E.segment(varied,20),/terlalu besar/);
});
test('both demo generator and downloadable CSV produce identical analytics',()=>{
 const fs=require('node:fs'),d=E.demo(),fromCSV=E.parseCSV(fs.readFileSync(require('node:path').join(__dirname,'../dist/demo.csv'),'utf8'));
 const a=E.aggregate(E.clean(d.rows,E.detect(d.headers)).rows),b=E.aggregate(E.clean(fromCSV.rows,E.detect(fromCSV.headers)).rows);assert.deepEqual(a.summary,b.summary);
});
test('Repeat Buyer source mapping never invents money or invoice identity',()=>{
 const m=E.detect(['No','Trx_Date','Cust_ID','Age','Gender','AREA','Product_ID','Product_Name','Category','Amount']);
 assert.equal(m.customer,'Cust_ID');assert.equal(m.date,'Trx_Date');assert.equal(m.region,'AREA');
 assert.equal(m.invoice,'');assert.equal(m.price,'');assert.equal(m.quantity,'');
});

test('order payments are summed once without fabricating customer, product or unit price',()=>{
 const rows=[{order_id:'1',date:'2025-01-01',total_qty:3,'Total Pembayaran':100,Status:'Selesai'},{order_id:'2',date:'2025-01-02',total_qty:2,'Total Pembayaran':50,Status:'Selesai'},{order_id:'3',date:'2025-01-02',total_qty:1,'Total Pembayaran':999,Status:'Batal'}];
 const map=E.detect(Object.keys(rows[0]));map.date='date';
 const clean=E.clean(rows,map,{valueMode:'order'});const a=E.aggregate(clean.rows);
 assert.equal(a.summary.revenue,150);assert.equal(a.summary.units,5);assert.equal(a.summary.orders,2);assert.equal(a.rfm.length,0);assert.equal(a.products.length,0);assert.equal(clean.rows[0].price,null);assert.equal(clean.counts.cancelled,1);
 assert.throws(()=>E.clean([rows[0],{...rows[0],'Total Pembayaran':200}],map,{valueMode:'order'}),/ID berulang/);
 assert.throws(()=>E.clean(rows,{...map,amount:''},{valueMode:'order'}),/amount/);});
test('category, payment, hourly extraction and cluster business personas work accurately',()=>{
 const rows=[
  {order_id:'ORD-1',date:'2025-01-01 10:30',total_qty:2,'Total Pembayaran':20000,Status:'Selesai',category:'Celengan, Mangkok',payment:'COD',city:'Semarang',province:'Jawa Tengah'},
  {order_id:'ORD-2',date:'2025-01-02 14:15',total_qty:1,'Total Pembayaran':15000,Status:'Selesai',category:'Celengan',payment:'ShopeePay',city:'Semarang',province:'Jawa Tengah'},
  {order_id:'ORD-3',date:'2025-01-03 14:45',total_qty:3,'Total Pembayaran':50000,Status:'Selesai',category:'Nampan',payment:'COD',city:'Bandung',province:'Jawa Barat'}
 ];
 const map=E.detect(Object.keys(rows[0]));map.date='date';
 const clean=E.clean(rows,map,{valueMode:'order',proxyCustomer:true});
 assert.equal(clean.counts.valid,3);
 assert.ok(clean.rows[0].customer.startsWith('PLG-SIM-'));
 const agg=E.aggregate(clean.rows);
 assert.equal(agg.categories[0].name,'Celengan');
 assert.equal(agg.categories[0].orders,2);
 assert.equal(agg.payments[0].name,'COD');
 assert.equal(agg.payments[0].orders,2);
 assert.equal(agg.hourly[10].orders,1);
 assert.equal(agg.hourly[14].orders,2);
});
test('Market Basket Analysis and customer churn/CLV predictions work accurately',()=>{
 const rows=[
  {order_id:'ORD-1',date:'2025-01-01',customer_id:'PLG-1',product_id:'P1',product_name:'Kopi Arabika',quantity:1,unit_price:50000,category:'Kopi',province:'Jawa Barat'},
  {order_id:'ORD-1',date:'2025-01-01',customer_id:'PLG-1',product_id:'P2',product_name:'Tumbler Stainless',quantity:1,unit_price:100000,category:'Aksesoris',province:'Jawa Barat'},
  {order_id:'ORD-2',date:'2025-01-10',customer_id:'PLG-2',product_id:'P1',product_name:'Kopi Arabika',quantity:1,unit_price:50000,category:'Kopi',province:'Jawa Barat'},
  {order_id:'ORD-2',date:'2025-01-10',customer_id:'PLG-2',product_id:'P2',product_name:'Tumbler Stainless',quantity:1,unit_price:100000,category:'Aksesoris',province:'Jawa Barat'},
  {order_id:'ORD-3',date:'2025-02-15',customer_id:'PLG-3',product_id:'P1',product_name:'Kopi Arabika',quantity:1,unit_price:50000,category:'Kopi',province:'DKI Jakarta'},
  {order_id:'ORD-4',date:'2025-03-20',customer_id:'PLG-4',product_id:'P3',product_name:'Camilan Keripik',quantity:2,unit_price:25000,category:'Makanan',province:'Jawa Timur'}
 ];
 const map=E.detect(Object.keys(rows[0]));
 const clean=E.clean(rows,map);
 const agg=E.aggregate(clean.rows);
 assert.ok(agg.basketAnalysis);
 assert.ok(agg.basketAnalysis.rules.length>=1);
 const rule=agg.basketAnalysis.rules[0];
 assert.ok(rule.pair.includes('Aksesoris')&&rule.pair.includes('Kopi'));
 assert.ok(rule.lift>1.0);
 assert.ok(rule.support>0);
 assert.ok(rule.confidence>0);

 const seg=E.segment(agg.rfm,'auto');
 assert.ok(seg.k>=2);
 assert.ok(typeof seg.totalCLV==='number'&&seg.totalCLV>0);
 assert.ok(typeof seg.avgChurn==='number');
 const sample=seg.customers[0];
 assert.ok(['Rendah','Sedang','Tinggi'].includes(sample.churnRisk));
 assert.ok(sample.clv>0);
 assert.ok(sample.churnProb>=0&&sample.churnProb<=100);
 assert.ok(typeof sample.persona==='string'&&sample.persona.length>0);
 assert.ok(agg.pareto&&agg.pareto.oneTimeCustomers===4&&agg.pareto.top20CustomerSharePct>0&&agg.pareto.top20ProductSharePct>0);
 assert.equal(agg.dayOfWeek.length,7);
 assert.equal(agg.dayOfWeek[0].name,'Senin');
 assert.equal(agg.dayOfWeek[6].name,'Minggu');
 assert.ok(agg.dayOfWeek.some(d=>d.orders>0&&d.revenue>0));
});
