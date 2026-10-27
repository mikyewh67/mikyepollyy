// Cloudflare Worker — restricted public read-only Gamma proxy.
// Deploy as a Worker, then paste your *.workers.dev URL into Edgeboard Settings.
const ORIGIN='https://gamma-api.polymarket.com';
const PATHS=new Set(['/sports','/events','/markets','/tags']);
const US_PATHS=new Set(['/v1/events']);
const ALLOWED_PARAMS=new Set(['active','closed','limit','offset','order','ascending','tag_id','tag_slug','id','slug','condition_id','series_id','end_date_min','end_date_max','start_date_min','start_date_max']);
export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    if(request.method!=='GET')return reply({error:'GET only'},405);
    const u=new URL(request.url);
    const isUS=u.pathname.startsWith('/us/');const upstreamPath=isUS?u.pathname.slice(3):u.pathname;
    if(isUS?!US_PATHS.has(upstreamPath):!PATHS.has(upstreamPath))return reply({error:'Endpoint not allowed'},404);
    const qs=new URLSearchParams();
    for(const [k,v] of u.searchParams)if(ALLOWED_PARAMS.has(k))qs.append(k,v);
    const limit=Number(qs.get('limit'));
    if(qs.has('limit')&&(!Number.isInteger(limit)||limit<1||limit>500))return reply({error:'Invalid limit'},400);
    const remote=(isUS?'https://gateway.polymarket.us':ORIGIN)+upstreamPath+(qs.size?'?'+qs:'');
    try{
      const response=await fetch(remote,{headers:{'Accept':'application/json'},cf:{cacheEverything:true,cacheTtl:45}});
      if(!response.ok)return reply({error:'Gamma upstream HTTP '+response.status},response.status);
      const contentType=response.headers.get('content-type')||'';
      if(!contentType.toLowerCase().includes('json'))return reply({error:'Unexpected upstream data'},502);
      const headers=new Headers(cors());headers.set('Content-Type','application/json; charset=utf-8');headers.set('Cache-Control','public, max-age=45');
      return new Response(response.body,{status:200,headers});
    }catch(error){return reply({error:'Gamma network request failed'},502);}
  }
};
function cors(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept, Content-Type','Access-Control-Max-Age':'86400','X-Content-Type-Options':'nosniff'};}
function reply(data,status){return new Response(JSON.stringify(data),{status,headers:{...cors(),'Content-Type':'application/json; charset=utf-8'}});}
