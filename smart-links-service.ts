import type express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { findSmartLinkByCode, resolveSmartLink, type SmartLink } from './src/smartLinks';
import { adminDb } from './server-firebase-admin';
import { authenticatedUser, type VerifiedFirebaseUser } from './server-auth';
import { assertSafePublicUrl } from './smart-link-security';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
const device=(agent='')=>/ipad|tablet/i.test(agent)?'tablet':/mobile|android|iphone/i.test(agent)?'mobile':'desktop';
async function fetchPublicHtml(raw:string){
  let url=await assertSafePublicUrl(raw);
  for(let redirect=0;redirect<4;redirect++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8_000);
    try{
      const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 TempoLink/1.0','accept':'text/html,application/xhtml+xml'}});
      if(response.status>=300&&response.status<400&&response.headers.get('location')){url=await assertSafePublicUrl(new URL(response.headers.get('location')!,url).toString());continue;}
      if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return null;
      const declared=Number(response.headers.get('content-length')||0);if(declared>2_500_000)return null;
      if(!response.body)return null;const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>2_500_000){await reader.cancel();return null;}chunks.push(value);}}
      const html=new TextDecoder().decode(Buffer.concat(chunks));return {html,url};
    }finally{clearTimeout(timer);}
  }
  return null;
}

function statusPage(title:string,message:string,status:number){return {status,html:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font:15px system-ui;padding:20px;box-sizing:border-box}.c{max-width:480px;padding:34px;border:1px solid #3f3f46;border-radius:22px;background:#18181b;text-align:center}h1{font-size:22px}p{color:#a1a1aa;line-height:1.6}</style></head><body><div class="c"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`};}

async function allLinks(){const snapshot=await adminDb.collection('smart_links').get();return snapshot.docs.map(item=>({id:item.id,...item.data()} as SmartLink));}

const canAccess=(user:VerifiedFirebaseUser|undefined,link:SmartLink)=>Boolean(user&&(user.role==='ADMIN'||(user.unitId&&user.unitId===link.unitId)));
const requestedUnit=(user:VerifiedFirebaseUser|undefined,value:unknown)=>{const unitId=typeof value==='string'?value.trim():'';if(!user)throw Object.assign(new Error('Usuário não identificado.'),{status:403});if(!unitId)throw Object.assign(new Error('Informe a unidade.'),{status:400});if(user.role!=='ADMIN'&&user.unitId!==unitId)throw Object.assign(new Error('Você não possui permissão para esta unidade.'),{status:403});return unitId;};
const slug=(value:unknown)=>String(value||'').trim().toLowerCase();
const urlFields=(data:any)=>[data.destinationUrl,data.phaseOneUrl,data.phaseTwoUrl,data.fallbackUrl,data.maskFavicon,...(data.destinations||[]).map((item:any)=>item.url),...(data.timelineSteps||[]).map((item:any)=>item.url)].filter(Boolean);
const normalizePayload=(data:any)=>({title:String(data.title||'').trim().slice(0,120),shortCode:slug(data.shortCode),baseSlug:slug(data.baseSlug||data.shortCode),mode:data.mode,slugType:data.slugType,customSlugs:Array.isArray(data.customSlugs)?data.customSlugs.map((item:unknown)=>slug(item)).filter(Boolean).slice(0,200):[],expireOldLinks:data.expireOldLinks!==false,destinationUrl:String(data.destinationUrl||''),destinations:Array.isArray(data.destinations)?data.destinations.slice(0,50):[],rotationIntervalMinutes:Math.max(1,Math.min(525600,Number(data.rotationIntervalMinutes)||60)),rotationStartedAt:String(data.rotationStartedAt||new Date().toISOString()),phaseOneUrl:String(data.phaseOneUrl||''),phaseTwoUrl:String(data.phaseTwoUrl||''),switchDate:String(data.switchDate||''),timelineSteps:Array.isArray(data.timelineSteps)?data.timelineSteps.slice(0,100):[],fallbackUrl:String(data.fallbackUrl||''),expiredMessage:String(data.expiredMessage||'').slice(0,500),maskUrl:Boolean(data.maskUrl),maskTitle:String(data.maskTitle||'').slice(0,120),maskFavicon:String(data.maskFavicon||''),maxClicks:data.maxClicks==null?null:Math.max(1,Number(data.maxClicks)||1),tags:Array.isArray(data.tags)?data.tags.map((item:unknown)=>String(item).trim().slice(0,40)).filter(Boolean).slice(0,30):[]});
const validatePayload=async(data:any)=>{if(!data.title)throw Object.assign(new Error('Informe o título.'),{status:400});if(!/^[a-z0-9-]{1,60}$/.test(data.shortCode)||!/^[a-z0-9-]{1,60}$/.test(data.baseSlug))throw Object.assign(new Error('Código curto inválido.'),{status:400});if(!['rotating_shortlink','infinite_loop','dual_switch','timeline'].includes(data.mode))throw Object.assign(new Error('Modo do link inválido.'),{status:400});if(data.mode==='rotating_shortlink'&&!data.destinationUrl)throw Object.assign(new Error('Informe o destino fixo.'),{status:400});if(data.mode==='infinite_loop'&&data.destinations.filter((item:any)=>item?.url).length<2)throw Object.assign(new Error('Adicione pelo menos dois destinos.'),{status:400});if(data.mode==='dual_switch'&&(!data.phaseOneUrl||!data.phaseTwoUrl||Number.isNaN(new Date(data.switchDate).getTime())))throw Object.assign(new Error('Informe URLs e data válidas para as duas fases.'),{status:400});if(data.mode==='timeline'&&!data.timelineSteps.some((item:any)=>item?.url&&!Number.isNaN(new Date(item.startDate).getTime())))throw Object.assign(new Error('Adicione uma etapa válida.'),{status:400});for(const value of urlFields(data))await assertSafePublicUrl(String(value));};
const sendError=(res:express.Response,error:unknown,fallback:string)=>{const status=Number((error as any)?.status)||400;res.status(status>=400&&status<500?status:500).json({error:error instanceof Error?error.message:fallback});};

export function configureSmartLinks(app:express.Express, requireAuth: express.RequestHandler, requireRole: express.RequestHandler){
  app.post('/api/smart-links',requireAuth,requireRole,async(req,res)=>{try{const user=authenticatedUser(req);const unitId=requestedUnit(user,req.body?.unitId),payload=normalizePayload(req.body);await validatePayload(payload);const links=await allLinks();if(links.some(item=>item.shortCode===payload.shortCode||item.baseSlug===payload.baseSlug))return res.status(409).json({error:'Este código ou prefixo já está em uso.'});const now=new Date().toISOString();const ref=adminDb.collection('smart_links').doc();await ref.set({...payload,unitId,ownerId:user?.uid||'',createdAt:now,updatedAt:now,totalClicks:0,isActive:true});res.status(201).json({id:ref.id});}catch(error){sendError(res,error,'Não foi possível criar o link.');}});
  app.put('/api/smart-links/:id',requireAuth,requireRole,async(req,res)=>{try{const ref=adminDb.collection('smart_links').doc(req.params.id),snapshot=await ref.get();if(!snapshot.exists)return res.status(404).json({error:'Link não encontrado.'});const current={id:snapshot.id,...snapshot.data()} as SmartLink,user=authenticatedUser(req);if(!canAccess(user,current))return res.status(403).json({error:'Você não possui permissão para este link.'});const payload=normalizePayload(req.body);await validatePayload(payload);const links=await allLinks();if(links.some(item=>item.id!==current.id&&(item.shortCode===payload.shortCode||item.baseSlug===payload.baseSlug)))return res.status(409).json({error:'Este código ou prefixo já está em uso.'});await ref.set({...payload,unitId:current.unitId,ownerId:current.ownerId,createdAt:current.createdAt,totalClicks:current.totalClicks,isActive:current.isActive,updatedAt:new Date().toISOString()},{merge:false});res.json({id:ref.id});}catch(error){sendError(res,error,'Não foi possível atualizar o link.');}});
  app.post('/api/smart-links/:id/toggle',requireAuth,requireRole,async(req,res)=>{try{const ref=adminDb.collection('smart_links').doc(req.params.id),snapshot=await ref.get();if(!snapshot.exists)return res.status(404).json({error:'Link não encontrado.'});const link={id:snapshot.id,...snapshot.data()} as SmartLink;if(!canAccess(authenticatedUser(req),link))return res.status(403).json({error:'Você não possui permissão para este link.'});await ref.update({isActive:!link.isActive,updatedAt:new Date().toISOString()});res.json({isActive:!link.isActive});}catch(error){sendError(res,error,'Não foi possível alterar o link.');}});
  app.delete('/api/smart-links/:id',requireAuth,requireRole,async(req,res)=>{try{const ref=adminDb.collection('smart_links').doc(req.params.id),snapshot=await ref.get();if(!snapshot.exists)return res.status(404).json({error:'Link não encontrado.'});const link={id:snapshot.id,...snapshot.data()} as SmartLink;if(!canAccess(authenticatedUser(req),link))return res.status(403).json({error:'Você não possui permissão para este link.'});await ref.delete();res.status(204).send();}catch(error){sendError(res,error,'Não foi possível excluir o link.');}});
  app.post('/api/smart-links/:id/simulated-click',requireAuth,requireRole,async(req,res)=>{try{const snapshot=await adminDb.collection('smart_links').doc(req.params.id).get();if(!snapshot.exists)return res.status(404).json({error:'Link não encontrado.'});const link={id:snapshot.id,...snapshot.data()} as SmartLink;if(!canAccess(authenticatedUser(req),link))return res.status(403).json({error:'Você não possui permissão para este link.'});const at=req.body?.at?new Date(req.body.at):new Date();if(Number.isNaN(at.getTime()))return res.status(400).json({error:'Data inválida.'});const resolution=resolveSmartLink(link,at);await adminDb.collection('smart_link_clicks').add({linkId:link.id,unitId:link.unitId,shortCode:resolution.activeShortCode,destinationUrl:resolution.url,phase:resolution.phase,cycleNumber:resolution.cycleNumber||null,timestamp:at.toISOString(),device:'simulador',referrer:'Máquina do Tempo',simulated:true,createdBy:authenticatedUser(req)?.uid||''});res.status(201).json({success:true});}catch(error){sendError(res,error,'Não foi possível registrar a simulação.');}});
  app.get('/api/smart-links/:id/simulate', requireAuth, requireRole, async(req,res)=>{
    try{const link=(await allLinks()).find(item=>item.id===req.params.id);if(!link)return res.status(404).json({error:'Link não encontrado.'});if(!canAccess(authenticatedUser(req),link))return res.status(403).json({error:'Você não possui permissão para este link.'});const at=req.query.at?new Date(String(req.query.at)):new Date();if(Number.isNaN(at.getTime()))return res.status(400).json({error:'Data inválida.'});res.json(resolveSmartLink(link,at));}catch(error){sendError(res,error,'Falha na simulação.');}
  });
  app.get('/r/:code',smartLinkRedirectHandler);
}

export async function smartLinkRedirectHandler(req:express.Request,res:express.Response){
    try{
      const links=await allLinks();const link=findSmartLinkByCode(links,req.params.code,new Date());
      if(!link){const page=statusPage('Link não encontrado','O código informado não existe ou foi removido.',404);return res.status(page.status).send(page.html);}
      const resolution=resolveSmartLink(link,new Date(),req.params.code);
      if(!resolution.url){const page=statusPage(resolution.label,link.expiredMessage||resolution.reason,resolution.expiredSlug?410:404);return res.status(page.status).send(page.html);}
      await assertSafePublicUrl(resolution.url);
      await Promise.allSettled([
        adminDb.collection('smart_links').doc(link.id).update({totalClicks:FieldValue.increment(1),lastClickAt:new Date().toISOString()}),
        adminDb.collection('smart_link_clicks').add({linkId:link.id,unitId:link.unitId,shortCode:req.params.code,destinationUrl:resolution.url,phase:resolution.phase,cycleNumber:resolution.cycleNumber||null,timestamp:new Date().toISOString(),device:device(req.headers['user-agent']),referrer:req.headers.referer||'',simulated:false}),
      ]);
      if(!link.maskUrl)return res.redirect(302,resolution.url);
      const result=await fetchPublicHtml(resolution.url);if(!result){const page=statusPage('Conteúdo indisponível','Não foi possível exibir este destino com segurança.',502);return res.status(page.status).send(page.html);}
      let html=result.html.replace(/<title[^>]*>[\s\S]*?<\/title>/i,'').replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi,'');
      const title=escapeHtml(link.maskTitle||link.title);const favicon=link.maskFavicon?`<link rel="icon" href="${escapeHtml(link.maskFavicon)}">`:'';
      const injection=`<base href="${escapeHtml(new URL('.',result.url).href)}" target="_self"><title>${title}</title>${favicon}`;
      html=/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,match=>`${match}${injection}`):`${injection}${html}`;
      res.setHeader('Content-Security-Policy',"default-src https: data: blob: 'unsafe-inline' 'unsafe-eval'; object-src 'none'; frame-ancestors 'none'; form-action https:; base-uri https:");res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('content-type','text/html; charset=utf-8');return res.send(html);
    }catch{const page=statusPage('Destino indisponível','Não foi possível abrir este link com segurança.',502);return res.status(page.status).send(page.html);}
}
