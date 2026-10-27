// Cloudflare Worker — restricted public read-only Gamma proxy.
// Deploy as a Worker, then paste your *.workers.dev URL into Edgeboard Settings.
const ORIGIN='https://gamma-api.polymarket.com';
const PATHS=new Set(['/sports','/events','/markets','/tags']);
const US_PATHS=new Set(['/v1/events']);
const ALLOWED_PARAMS=new Set(['active','closed','limit','offset','order','ascending','tag_id','tag_slug','id','slug','condition_id','series_id','end_date_min','end_date_max','start_date_min','start_date_max','tagSlug','endDateMin']);
export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    if(request.method!=='GET')return reply({error:'GET only'},405);
    const u=new URL(request.url);

    // Read-only ESPN team-history proxy (unofficial public feed; no predictions).
    if(u.pathname.startsWith('/research/espn/')){
      const path=u.pathname.slice('/research/espn'.length);
      const match=path.match(/^\/(basketball|football|baseball|hockey)\/(nba|wnba|mens-college-basketball|nfl|college-football|mlb|nhl)\/teams(?:\/([0-9]+)\/schedule)?$/);
      if(!match)return reply({error:'Unsupported research path'},404);
      const valid={basketball:['nba','wnba','mens-college-basketball'],football:['nfl','college-football'],baseball:['mlb'],hockey:['nhl']};
      if(!valid[match[1]].includes(match[2]))return reply({error:'Invalid sport/league'},404);
      const opts=new URLSearchParams();
      if(u.searchParams.has('season')&&/^20\d{2}$/.test(u.searchParams.get('season')))opts.set('season',u.searchParams.get('season'));
      if(!match[3])opts.set('limit','500');
      const url='https://site.api.espn.com/apis/site/v2/sports'+path+(opts.size?'?'+opts:'');
      try{
        const res=await fetch(url,{headers:{Accept:'application/json'},cf:{cacheEverything:true,cacheTtl:600}});
        if(!res.ok)return reply({error:'Stats upstream HTTP '+res.status},res.status);
        return new Response(res.body,{status:200,headers:{...cors(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'}});
      }catch{return reply({error:'Research data unavailable'},502);}
    }
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
