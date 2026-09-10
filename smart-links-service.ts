import type express from 'express';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { addDoc, collection, doc, getDocs, increment, updateDoc } from 'firebase/firestore';
import { db } from './src/firebase';
import { findSmartLinkByCode, resolveSmartLink, type SmartLink } from './src/smartLinks';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
const device=(agent='')=>/ipad|tablet/i.test(agent)?'tablet':/mobile|android|iphone/i.test(agent)?'mobile':'desktop';
const privateIpv4=(address:string)=>{const parts=address.split('.').map(Number);return parts[0]===10||parts[0]===127||parts[0]===0||(parts[0]===169&&parts[1]===254)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168);};
const privateIpv6=(address:string)=>address==='::1'||address.startsWith('fc')||address.startsWith('fd')||address.startsWith('fe80:');

async function assertPublicUrl(raw:string){
  const url=new URL(raw);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Protocolo não permitido.');
  if(url.username||url.password)throw new Error('URL com credenciais não permitida.');
  if(['localhost','0.0.0.0'].includes(url.hostname.toLowerCase()))throw new Error('Destino interno não permitido.');
  const addresses=isIP(url.hostname)?[{address:url.hostname}]:await lookup(url.hostname,{all:true});
  if(addresses.some(item=>item.address.includes(':')?privateIpv6(item.address):privateIpv4(item.address)))throw new Error('Destino interno não permitido.');
  return url;
}

async function fetchPublicHtml(raw:string){
  let url=await assertPublicUrl(raw);
  for(let redirect=0;redirect<4;redirect++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8_000);
    try{
      const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 TempoLink/1.0','accept':'text/html,application/xhtml+xml'}});
      if(response.status>=300&&response.status<400&&response.headers.get('location')){url=await assertPublicUrl(new URL(response.headers.get('location')!,url).toString());continue;}
      if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return null;
      const declared=Number(response.headers.get('content-length')||0);if(declared>2_500_000)return null;
      const html=await response.text();return html.length<=2_500_000?{html,url}:null;
    }finally{clearTimeout(timer);}
  }
  return null;
}

function statusPage(title:string,message:string,status:number){return {status,html:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font:15px system-ui;padding:20px;box-sizing:border-box}.c{max-width:480px;padding:34px;border:1px solid #3f3f46;border-radius:22px;background:#18181b;text-align:center}h1{font-size:22px}p{color:#a1a1aa;line-height:1.6}</style></head><body><div class="c"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`};}

async function allLinks(){const snapshot=await getDocs(collection(db,'smart_links'));return snapshot.docs.map(item=>({id:item.id,...item.data()} as SmartLink));}

export function configureSmartLinks(app:express.Express, requireAuth: express.RequestHandler, requireRole: express.RequestHandler){
  app.get('/api/smart-links/:id/simulate', requireAuth, requireRole, async(req,res)=>{
    try{const link=(await allLinks()).find(item=>item.id===req.params.id);if(!link)return res.status(404).json({error:'Link não encontrado.'});const at=req.query.at?new Date(String(req.query.at)):new Date();if(Number.isNaN(at.getTime()))return res.status(400).json({error:'Data inválida.'});res.json(resolveSmartLink(link,at));}catch(error){res.status(500).json({error:error instanceof Error?error.message:'Falha na simulação.'});}
  });
  app.get('/r/:code',smartLinkRedirectHandler);
}

export async function smartLinkRedirectHandler(req:express.Request,res:express.Response){
    try{
      const links=await allLinks();const link=findSmartLinkByCode(links,req.params.code,new Date());
      if(!link){const page=statusPage('Link não encontrado','O código informado não existe ou foi removido.',404);return res.status(page.status).send(page.html);}
      const resolution=resolveSmartLink(link,new Date(),req.params.code);
      if(!resolution.url){const page=statusPage(resolution.label,link.expiredMessage||resolution.reason,resolution.expiredSlug?410:404);return res.status(page.status).send(page.html);}
      await assertPublicUrl(resolution.url);
      await Promise.allSettled([
        updateDoc(doc(db,'smart_links',link.id),{totalClicks:increment(1),lastClickAt:new Date().toISOString()}),
        addDoc(collection(db,'smart_link_clicks'),{linkId:link.id,shortCode:req.params.code,destinationUrl:resolution.url,phase:resolution.phase,cycleNumber:resolution.cycleNumber||null,timestamp:new Date().toISOString(),device:device(req.headers['user-agent']),referrer:req.headers.referer||'',simulated:false}),
      ]);
      if(!link.maskUrl||req.query.direct==='1')return res.redirect(302,resolution.url);
      const result=await fetchPublicHtml(resolution.url);if(!result)return res.redirect(302,resolution.url);
      let html=result.html.replace(/<title[^>]*>[\s\S]*?<\/title>/i,'');
      const title=escapeHtml(link.maskTitle||link.title);const favicon=link.maskFavicon?`<link rel="icon" href="${escapeHtml(link.maskFavicon)}">`:'';
      const injection=`<base href="${escapeHtml(result.url.origin)}/" target="_self"><title>${title}</title>${favicon}`;
      html=/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,match=>`${match}${injection}`):`${injection}${html}`;
      res.removeHeader('X-Frame-Options');res.removeHeader('Content-Security-Policy');res.setHeader('content-type','text/html; charset=utf-8');return res.send(html);
    }catch(error){const page=statusPage('Destino indisponível',error instanceof Error?error.message:'Não foi possível abrir este link.',502);return res.status(page.status).send(page.html);}
}
