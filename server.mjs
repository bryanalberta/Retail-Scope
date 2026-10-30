import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8','.json':'application/json','.py':'text/x-python; charset=utf-8'};
const port=Number(process.env.RETAILSCOPE_PORT||4173);
const server=http.createServer(async(req,res)=>{
 try {
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(target)).isFile())throw Error('Not a file');
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(await readFile(target));
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`RetailScope: http://127.0.0.1:${port}`));
