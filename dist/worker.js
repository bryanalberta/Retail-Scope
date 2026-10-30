importScripts('./engine.js');
let dataset=null,cleaned=null;
function openDB(){return new Promise((res,rej)=>{if(typeof indexedDB==='undefined')return res(null);const req=indexedDB.open('retailscope-db',1);req.onupgradeneeded=()=>req.result.createObjectStore('datasets');req.onsuccess=()=>res(req.result);req.onerror=()=>res(null);});}
async function idbSave(val){try{const db=await openDB();if(!db)return;await new Promise((res)=>{const tx=db.transaction('datasets','readwrite');tx.objectStore('datasets').put(val,'active');tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch{}}
async function idbLoad(){try{const db=await openDB();if(!db)return null;return await new Promise((res)=>{const tx=db.transaction('datasets','readonly');const r=tx.objectStore('datasets').get('active');r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);});}catch{return null;}}
async function idbClear(){try{const db=await openDB();if(!db)return;await new Promise((res)=>{const tx=db.transaction('datasets','readwrite');tx.objectStore('datasets').delete('active');tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch{}}
self.onmessage=async ({data})=>{
  const {id,type}=data;
  try {
    const E=self.RetailEngine;
    if(type==='demo'){await idbClear();dataset=E.demo();cleaned=null;postMessage({id,result:{headers:dataset.headers,preview:dataset.rows.slice(0,8),count:dataset.rows.length,mapping:E.detect(dataset.headers)}});}
    else if(type==='restore'){const saved=await idbLoad();if(!saved||!saved.rows?.length)throw Error('Sesi lokal tidak ditemukan.');dataset=saved;cleaned=null;postMessage({id,result:{headers:dataset.headers,preview:dataset.rows.slice(0,8),count:dataset.rows.length,mapping:E.detect(dataset.headers),sheets:dataset.sheets}});}
    else if(type==='import'){
      const file=data.file;
      if(file.size>120*1024*1024)throw Error('Batas MVP adalah 120 MB per file. Gunakan CSV yang diperkecil atau filter data di Python terlebih dulu.');
      if(/\.csv$/i.test(file.name))dataset=E.parseCSV(await file.text());
      else if(/\.xlsx?$/i.test(file.name)){
        importScripts('./vendor/xlsx.full.min.js');
        const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
        const names=book.SheetNames.filter(n=>!book.Workbook?.Sheets?.[book.SheetNames.indexOf(n)]?.Hidden);
        const sheets=names.map(name=>({name,rows:XLSX.utils.sheet_to_json(book.Sheets[name],{defval:''})}));
        const headers=Object.keys(sheets.find(s=>s.rows.length)?.rows[0]||{});
        if(!headers.length)throw Error('Workbook kosong.');
        if(sheets.some(s=>s.rows.length&&Object.keys(s.rows[0]).sort().join('|')!==[...headers].sort().join('|')))throw Error('Sheet memiliki skema berbeda. Gabungkan tabel transaksi dahulu, lalu unggah satu CSV.');
        dataset={headers,rows:sheets.flatMap(s=>s.rows),sheets:names};
      }else throw Error('Pilih file CSV atau Excel (.xlsx/.xls).');
      cleaned=null;await idbSave(dataset);postMessage({id,result:{headers:dataset.headers,preview:dataset.rows.slice(0,8),count:dataset.rows.length,mapping:E.detect(dataset.headers),sheets:dataset.sheets}});
    }
    else if(type==='analyze'){
      if(!dataset)throw Error('Belum ada dataset.');
      postMessage({id,progress:'Membersihkan data dan menghitung RFM…'});
      const candidate=E.clean(dataset.rows,data.mapping,data.options);
      const a=E.aggregate(candidate.rows,data.filters);
      postMessage({id,progress:'Mengevaluasi K-Means dan silhouette…'});
      const segmentation=E.segment(a.rfm,data.k);
      if(!data.mapping.customer&&!data.options?.proxyCustomer)segmentation.message='Segmentasi RFM tidak tersedia: dataset tidak menyediakan ID pelanggan. Aktifkan opsi simulasi ID pelanggan pada pemetaan kolom atau gunakan data demo untuk menguji RFM.';
      cleaned=candidate;postMessage({id,result:{...a,segmentation,cleaning:candidate.counts,availableRegions:[...new Set(candidate.rows.map(r=>r.region))].sort(),availableCities:[...new Set(candidate.rows.map(r=>r.city).filter(c=>c&&c!=='Tidak diketahui'))].sort()}});
    }else if(type==='exportClean'){
      if(!cleaned)throw Error('Jalankan cleaning dahulu.');
      postMessage({id,result:cleaned.rows.map(r=>({...r,date:E.iso(r.date)}))});
    }
  }catch(e){postMessage({id,error:e.message||String(e)});}
};
