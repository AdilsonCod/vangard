export type SmartLinkMode = 'rotating_shortlink' | 'infinite_loop' | 'dual_switch' | 'timeline';
export type SmartSlugType = 'hash_token' | 'sequential_number' | 'custom_list';
export type SmartDestination = { id: string; name: string; url: string; durationMinutes: number };
export type SmartTimelineStep = { id: string; name: string; url: string; startDate: string; endDate?: string; maxClicks?: number; clickCount?: number };
export type SmartLink = {
  id: string; title: string; shortCode: string; baseSlug: string; mode: SmartLinkMode; slugType: SmartSlugType;
  customSlugs: string[]; expireOldLinks: boolean; destinationUrl: string; destinations: SmartDestination[];
  rotationIntervalMinutes: number; rotationStartedAt: string; phaseOneUrl: string; phaseTwoUrl: string; switchDate: string;
  timelineSteps: SmartTimelineStep[]; fallbackUrl: string; expiredMessage: string; maskUrl: boolean; maskTitle: string;
  maskFavicon: string; maxClicks?: number|null; totalClicks: number; isActive: boolean; createdAt: string; updatedAt: string;
  ownerId: string; tags: string[]; lastClickAt?: string;
};

export type SmartResolution = {
  url: string; phase: string; label: string; cycleNumber?: number; activeShortCode: string; nextShortCode?: string;
  nextSwitchAt?: string; progressPercent: number; reason: string; expiredSlug?: boolean;
};

export function generateCycleSlug(baseSlug: string, slugType: SmartSlugType, cycleNumber: number, customSlugs: string[] = []) {
  const base = baseSlug.toLowerCase().replace(/[^a-z0-9-]/g,'') || 'link';
  if (slugType === 'custom_list' && customSlugs.length) return customSlugs[(cycleNumber - 1) % customSlugs.length].trim().toLowerCase();
  if (slugType === 'sequential_number') return `${base}-${String(cycleNumber).padStart(2,'0')}`;
  let hash = 0;
  for (const character of `${base}:vans:${cycleNumber}`) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let token = '', value = Math.abs(hash);
  for (let index=0;index<4;index++){token+=alphabet[value%alphabet.length];value=Math.floor(value/alphabet.length)+cycleNumber*11+index;}
  return `${base}-${token}`;
}

export function rotatingStatus(link: SmartLink, at = new Date()) {
  const intervalMs = Math.max(1,link.rotationIntervalMinutes||60)*60_000;
  const started = new Date(link.rotationStartedAt||link.createdAt).getTime();
  const elapsed = Math.max(0,at.getTime()-started);
  const cycleNumber = Math.floor(elapsed/intervalMs)+1;
  const offset = elapsed%intervalMs;
  return { cycleNumber, current:generateCycleSlug(link.baseSlug||link.shortCode,link.slugType||'hash_token',cycleNumber,link.customSlugs), next:generateCycleSlug(link.baseSlug||link.shortCode,link.slugType||'hash_token',cycleNumber+1,link.customSlugs), nextSwitchAt:new Date(at.getTime()+intervalMs-offset).toISOString(), progressPercent:Math.round(offset/intervalMs*100) };
}

export function resolveSmartLink(link: SmartLink, at = new Date(), usedCode?: string): SmartResolution {
  const fallback = link.fallbackUrl || '';
  if (!link.isActive) return {url:fallback,phase:'paused',label:'Pausado',activeShortCode:link.shortCode,progressPercent:0,reason:'Link pausado manualmente.'};
  if (link.maxClicks && link.totalClicks >= link.maxClicks) return {url:fallback,phase:'limit',label:'Limite atingido',activeShortCode:link.shortCode,progressPercent:100,reason:'O limite total de cliques foi atingido.'};
  if (link.mode === 'rotating_shortlink') {
    const status=rotatingStatus(link,at);
    const base=(link.baseSlug||link.shortCode).toLowerCase();
    const code=(usedCode||status.current).toLowerCase();
    const isBase=code===base;
    const expired=!isBase&&code!==status.current;
    if(expired&&link.expireOldLinks)return {url:fallback,phase:'expired',label:'Código expirado',cycleNumber:status.cycleNumber,activeShortCode:status.current,nextShortCode:status.next,nextSwitchAt:status.nextSwitchAt,progressPercent:status.progressPercent,reason:'Este código pertence a outro ciclo.',expiredSlug:true};
    return {url:link.destinationUrl,phase:'rotating_shortlink',label:`Ciclo ${status.cycleNumber}`,cycleNumber:status.cycleNumber,activeShortCode:status.current,nextShortCode:status.next,nextSwitchAt:status.nextSwitchAt,progressPercent:status.progressPercent,reason:'Destino fixo com código curto rotativo.'};
  }
  if (link.mode === 'infinite_loop') {
    const stages=(link.destinations||[]).filter(item=>item.url&&item.durationMinutes>0);
    if(!stages.length)return {url:link.destinationUrl,phase:'infinite_loop',label:'Destino principal',activeShortCode:link.shortCode,progressPercent:0,reason:'Nenhuma etapa adicional cadastrada.'};
    const cycleMinutes=stages.reduce((sum,item)=>sum+item.durationMinutes,0), cycleMs=cycleMinutes*60_000;
    const started=new Date(link.rotationStartedAt||link.createdAt).getTime(), elapsed=Math.max(0,at.getTime()-started), cycleNumber=Math.floor(elapsed/cycleMs)+1;
    let offset=(elapsed%cycleMs)/60_000, active=stages[0];
    for(const stage of stages){if(offset<stage.durationMinutes){active=stage;break;}offset-=stage.durationMinutes;}
    const remaining=Math.max(0,active.durationMinutes-offset)*60_000;
    return {url:active.url,phase:'infinite_loop',label:active.name,cycleNumber,activeShortCode:link.shortCode,nextSwitchAt:new Date(at.getTime()+remaining).toISOString(),progressPercent:Math.round(offset/active.durationMinutes*100),reason:`Etapa ${active.name} do ciclo contínuo.`};
  }
  if(link.mode==='dual_switch'){
    const switched=at.getTime()>=new Date(link.switchDate).getTime();
    const start=new Date(link.createdAt).getTime(), end=new Date(link.switchDate).getTime();
    return {url:switched?(link.phaseTwoUrl||fallback):link.phaseOneUrl,phase:switched?'phase2':'phase1',label:switched?'Fase 2':'Fase 1',activeShortCode:link.shortCode,nextSwitchAt:switched?undefined:link.switchDate,progressPercent:switched?100:Math.max(0,Math.min(100,Math.round((at.getTime()-start)/(end-start)*100))),reason:switched?'Prazo encerrado; destino final ativo.':'Destino inicial ativo até a data programada.'};
  }
  const steps=(link.timelineSteps||[]).filter(step=>new Date(step.startDate).getTime()<=at.getTime()&&(!step.endDate||at.getTime()<new Date(step.endDate).getTime())&&(!step.maxClicks||(step.clickCount||0)<step.maxClicks)).sort((a,b)=>new Date(b.startDate).getTime()-new Date(a.startDate).getTime());
  const step=steps[0];
  return {url:step?.url||fallback,phase:step?'timeline':'expired',label:step?.name||'Sem etapa ativa',activeShortCode:link.shortCode,nextSwitchAt:step?.endDate,progressPercent:0,reason:step?`Etapa cronológica “${step.name}” ativa.`:'Não há etapa ativa para esta data.'};
}

export function findSmartLinkByCode(links: SmartLink[], code: string, at = new Date()) {
  const clean=code.toLowerCase();
  const direct=links.find(link=>link.shortCode.toLowerCase()===clean||link.baseSlug?.toLowerCase()===clean);
  if(direct)return direct;
  return links.find(link=>{
    if(link.mode!=='rotating_shortlink')return false;
    const current=rotatingStatus(link,at);
    if(current.current===clean)return true;
    if(!link.expireOldLinks){for(let cycle=Math.max(1,current.cycleNumber-200);cycle<current.cycleNumber;cycle++)if(generateCycleSlug(link.baseSlug,link.slugType,cycle,link.customSlugs)===clean)return true;}
    return false;
  });
}
