import type express from 'express';
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { authenticatedUser } from './server-auth';
import { adminDb } from './server-firebase-admin';
import { useEncryptedAuthState } from './message-auth-store';
import { authorizeDispatchUnit, safeInterruptionReason } from './message-dispatch-policy';
import type { VerifiedFirebaseUser } from './server-auth';

type DispatchLog = { id:string; time:string; text:string; type:'info'|'success'|'warning' };
type DispatchError = { contact:string; error:string };
type DispatchState = {
  enabled:boolean; connectionStatus:'disconnected'|'connecting'|'qr'|'connected'; currentQr:string; isSending:boolean;
  progress:number; total:number; currentAction:string; logs:DispatchLog[]; campaignStatus:'idle'|'running'|'completed'|'stopped';
  successCount:number; errorCount:number; errorDetails:DispatchError[]; runId:string; activeUnitId:string;
};

const AUTH_VAULT=process.env.WHATSAPP_AUTH_VAULT||'data/whatsapp/session.enc';
const MAX_CONTACTS=200;
const state:DispatchState={enabled:true,connectionStatus:'disconnected',currentQr:'',isSending:false,progress:0,total:0,currentAction:'Aguardando conexão.',logs:[],campaignStatus:'idle',successCount:0,errorCount:0,errorDetails:[],runId:'',activeUnitId:''};
let socket:ReturnType<typeof makeWASocket>|null=null;
let connecting=false;
let connectionActor:VerifiedFirebaseUser|undefined;
let connectionUnitId='ALL';

const addLog=(text:string,type:DispatchLog['type']='info')=>{
  state.logs.unshift({id:crypto.randomUUID(),time:new Date().toLocaleTimeString('pt-BR'),text,type});
  state.logs=state.logs.slice(0,80);
};
const pause=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const publicState=()=>({...state,currentQr:state.currentQr,errorDetails:state.errorDetails.slice(0,100)});

async function connect(actor?:VerifiedFirebaseUser,unitId='ALL'){
  if(connecting||state.connectionStatus==='connected')return;
  connectionActor=actor;connectionUnitId=unitId;
  connecting=true;
  state.connectionStatus='connecting';
  state.currentAction='Inicializando conexão com o WhatsApp...';
  try{
    const {state:authState,saveCreds}=await useEncryptedAuthState(AUTH_VAULT);
    socket=makeWASocket({auth:authState,printQRInTerminal:false,logger:pino({level:'silent'}),browser:['Van’s Management','Chrome','1.0.0']});
    socket.ev.on('creds.update',saveCreds);
    socket.ev.on('connection.update',async update=>{
      const {connection,lastDisconnect,qr}=update;
      if(qr){state.connectionStatus='qr';state.currentQr=await QRCode.toDataURL(qr);state.currentAction='Escaneie o QR Code para conectar.';}
      if(connection==='open'){connecting=false;state.connectionStatus='connected';state.currentQr='';state.currentAction='WhatsApp conectado e pronto.';addLog('WhatsApp conectado com sucesso.','success');void auditLog('CONNECTION_OPENED',connectionActor,connectionUnitId);}
      if(connection==='close'){
        connecting=false;state.connectionStatus='disconnected';state.currentQr='';state.currentAction='WhatsApp desconectado.';
        const code=(lastDisconnect?.error as {output?:{statusCode?:number}}|undefined)?.output?.statusCode;
        void auditLog('CONNECTION_CLOSED',connectionActor,connectionUnitId,{reasonCode:code||null,willReconnect:code!==DisconnectReason.loggedOut});
        if(code!==DisconnectReason.loggedOut)setTimeout(()=>void connect(connectionActor,connectionUnitId),3000);
      }
    });
  }catch(error){const reason=error instanceof Error?error.message:'Falha de conexão.';connecting=false;state.connectionStatus='disconnected';state.currentAction='Falha ao iniciar a conexão.';addLog(reason,'warning');void auditLog('CONNECTION_FAILED',connectionActor,connectionUnitId,{reason});}
}

export const startMessageDispatchConnection = () => connect(undefined,'ALL');

async function auditLog(action:string,user:VerifiedFirebaseUser|undefined,unitId:string,details:Record<string,unknown>={}){
  try{await adminDb.collection('dispatch_audit').add({action,unitId,userId:user?.uid||'SYSTEM',profileId:user?.profileId||null,userEmail:user?.email||null,userRole:user?.role||'SYSTEM',timestamp:new Date().toISOString(),...details});}
  catch(err){console.error('Falha ao registrar auditoria de disparo:',err);}
}

const requestedUnit=(req:express.Request)=>req.body?.unitId??req.query?.unitId;
const requireUnit=(req:express.Request,res:express.Response)=>{const decision=authorizeDispatchUnit(authenticatedUser(req),requestedUnit(req));if(!decision.allowed){res.status(decision.status).json({error:decision.error});return null;}return decision.unitId;};

export function configureMessageDispatch(app:express.Express, requireAuth: express.RequestHandler, requireRole: express.RequestHandler){
  app.get('/api/message-dispatch/status', requireAuth, requireRole, (req,res)=>{const unitId=requireUnit(req,res);if(!unitId)return;const view=publicState();if(state.activeUnitId&&unitId!=='ALL'&&state.activeUnitId!==unitId)res.json({...view,isSending:false,progress:0,total:0,campaignStatus:'idle',successCount:0,errorCount:0,errorDetails:[],runId:'',activeUnitId:''});else res.json(view);});
  app.post('/api/message-dispatch/connect', requireAuth, requireRole, async(req,res)=>{const unitId=requireUnit(req,res);if(!unitId)return;const user=authenticatedUser(req);await auditLog('CONNECTION_REQUESTED',user,unitId);void connect(user,unitId);res.json({success:true});});
  app.post('/api/message-dispatch/stop', requireAuth, requireRole, async(req,res)=>{
    const unitId=requireUnit(req,res);if(!unitId)return;if(state.activeUnitId&&unitId!=='ALL'&&state.activeUnitId!==unitId){res.status(403).json({error:'Esta campanha pertence a outra unidade.'});return;}
    const user=authenticatedUser(req);const reason=safeInterruptionReason(req.body?.reason);
    state.isSending=false;state.campaignStatus='stopped';state.currentAction=reason;addLog(`Campanha interrompida por ${user?.email||'operador'}.`,'warning');
    await auditLog('CAMPAIGN_STOPPED',user,state.activeUnitId||unitId,{runId:state.runId,processed:state.progress,success:state.successCount,errors:state.errorCount,reason});
    if(state.runId)await adminDb.collection('message_dispatch_history').doc(state.runId).set({status:'INTERROMPIDO',finishedAt:new Date().toISOString(),processed:state.progress,successCount:state.successCount,errorCount:state.errorCount,interruptionReason:reason},{merge:true});
    res.json({success:true});
  });
  app.post('/api/message-dispatch/start', requireAuth, requireRole, async(req,res)=>{
    const unitId=requireUnit(req,res);if(!unitId)return;const user=authenticatedUser(req);const userEmail=user?.email||'unknown';
    if(state.isSending){res.status(409).json({error:'Já existe uma campanha em andamento.'});return;}
    if(state.connectionStatus!=='connected'||!socket){res.status(409).json({error:'Conecte o WhatsApp antes de iniciar.'});return;}
    const message=typeof req.body?.message==='string'?req.body.message.trim():'';
    const rawContacts=Array.isArray(req.body?.contacts)?req.body.contacts:String(req.body?.contacts||'').split(/\r?\n/);
    const contacts=[...new Set(rawContacts.map((value:unknown)=>String(value).replace(/\D/g,'')).map(value=>(value.length===10||value.length===11)?`55${value}`:value).filter(value=>value.length>=12&&value.length<=13))];
    const minDelay=Math.max(8,Math.min(120,Number(req.body?.minDelay)||15));
    const maxDelay=Math.max(minDelay,Math.min(180,Number(req.body?.maxDelay)||35));
    const simulateTyping=req.body?.simulateTyping!==false;
    if(req.body?.confirmedOptIn!==true){res.status(400).json({error:'Confirme que os destinatários autorizaram o recebimento.'});return;}
    if(!message||message.length>4096){res.status(400).json({error:'A mensagem deve ter entre 1 e 4.096 caracteres.'});return;}
    if(!contacts.length||contacts.length>MAX_CONTACTS){res.status(400).json({error:`Informe entre 1 e ${MAX_CONTACTS} contatos válidos.`});return;}
    res.json({success:true,total:contacts.length});
    state.isSending=true;state.campaignStatus='running';state.runId=crypto.randomUUID();state.activeUnitId=unitId;state.successCount=0;state.errorCount=0;state.errorDetails=[];state.total=contacts.length;state.progress=0;state.logs=[];
    addLog(`Campanha iniciada por ${userEmail} com ${contacts.length} destinatário(s).`);
    const campaignName=typeof req.body?.campaignName==='string'?req.body.campaignName.trim().slice(0,120):'Disparo sem título';
    await auditLog('CAMPAIGN_STARTED',user,unitId,{runId:state.runId,totalContacts:contacts.length,campaignName,minDelay,maxDelay,simulateTyping,confirmedOptIn:true});
    await adminDb.collection('message_dispatch_history').doc(state.runId).set({name:campaignName,createdAt:new Date().toISOString(),unitId,total:contacts.length,processed:0,successCount:0,errorCount:0,status:'EM_ANDAMENTO',createdBy:user?.uid||'',createdByEmail:user?.email||''});
    for(let index=0;index<contacts.length&&state.isSending;index++){
      const contact=contacts[index];
      let jid=`${contact}@s.whatsapp.net`;
      try{
        state.currentAction=`Validando ${contact}...`;
        const availability=await socket.onWhatsApp(contact);
        if(!availability?.[0]?.exists)throw new Error('Número não encontrado no WhatsApp');
        jid=availability[0].jid;
        if(simulateTyping){state.currentAction=`Preparando mensagem ${index+1} de ${contacts.length}...`;await socket.sendPresenceUpdate('composing',jid);await pause(Math.min(6000,Math.max(1200,message.length*45)));await socket.sendPresenceUpdate('paused',jid);}
        if(!state.isSending)break;
        state.currentAction=`Enviando ${index+1} de ${contacts.length}...`;
        await socket.sendMessage(jid,{text:message});state.successCount++;addLog(`Mensagem entregue para ${contact}.`,'success');
      }catch(error){const detail=error instanceof Error?error.message:'Falha no envio';state.errorCount++;state.errorDetails.push({contact,error:detail});addLog(`Falha para ${contact}: ${detail}`,'warning');}
      state.progress=index+1;
      if(index<contacts.length-1&&state.isSending){const seconds=Math.floor(Math.random()*(maxDelay-minDelay+1))+minDelay;state.currentAction=`Intervalo operacional de ${seconds}s...`;for(let elapsed=0;elapsed<seconds&&state.isSending;elapsed++)await pause(1000);}
    }
    if(state.isSending){
      state.campaignStatus='completed';state.currentAction='Campanha concluída.';addLog('Processamento concluído.','success');
      await auditLog('CAMPAIGN_COMPLETED',user,unitId,{runId:state.runId,processed:state.progress,success:state.successCount,errors:state.errorCount,errorReasons:state.errorDetails.map(item=>item.error).slice(0,100)});
      await adminDb.collection('message_dispatch_history').doc(state.runId).set({status:'CONCLUIDO',finishedAt:new Date().toISOString(),processed:state.progress,successCount:state.successCount,errorCount:state.errorCount},{merge:true});
    }
    state.isSending=false;
  });
}
