import type express from 'express';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { authenticatedUser } from './server-auth';
import { adminDb } from './server-firebase-admin';

type DispatchLog = { id:string; time:string; text:string; type:'info'|'success'|'warning' };
type DispatchError = { contact:string; error:string };
type DispatchState = {
  enabled:boolean; connectionStatus:'disconnected'|'connecting'|'qr'|'connected'; currentQr:string; isSending:boolean;
  progress:number; total:number; currentAction:string; logs:DispatchLog[]; campaignStatus:'idle'|'running'|'completed'|'stopped';
  successCount:number; errorCount:number; errorDetails:DispatchError[]; runId:string;
};

const AUTH_DIRECTORY=process.env.WHATSAPP_AUTH_DIR||'.whatsapp-session';
const MAX_CONTACTS=200;
const state:DispatchState={enabled:true,connectionStatus:'disconnected',currentQr:'',isSending:false,progress:0,total:0,currentAction:'Aguardando conexão.',logs:[],campaignStatus:'idle',successCount:0,errorCount:0,errorDetails:[],runId:''};
let socket:ReturnType<typeof makeWASocket>|null=null;
let connecting=false;

const addLog=(text:string,type:DispatchLog['type']='info')=>{
  state.logs.unshift({id:crypto.randomUUID(),time:new Date().toLocaleTimeString('pt-BR'),text,type});
  state.logs=state.logs.slice(0,80);
};
const pause=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const publicState=()=>({...state,currentQr:state.currentQr,errorDetails:state.errorDetails.slice(0,100)});

async function connect(){
  if(connecting||state.connectionStatus==='connected')return;
  connecting=true;
  state.connectionStatus='connecting';
  state.currentAction='Inicializando conexão com o WhatsApp...';
  try{
    const {state:authState,saveCreds}=await useMultiFileAuthState(AUTH_DIRECTORY);
    socket=makeWASocket({auth:authState,printQRInTerminal:false,logger:pino({level:'silent'}),browser:['Van’s Management','Chrome','1.0.0']});
    socket.ev.on('creds.update',saveCreds);
    socket.ev.on('connection.update',async update=>{
      const {connection,lastDisconnect,qr}=update;
      if(qr){state.connectionStatus='qr';state.currentQr=await QRCode.toDataURL(qr);state.currentAction='Escaneie o QR Code para conectar.';}
      if(connection==='open'){connecting=false;state.connectionStatus='connected';state.currentQr='';state.currentAction='WhatsApp conectado e pronto.';addLog('WhatsApp conectado com sucesso.','success');}
      if(connection==='close'){
        connecting=false;state.connectionStatus='disconnected';state.currentQr='';state.currentAction='WhatsApp desconectado.';
        const code=(lastDisconnect?.error as {output?:{statusCode?:number}}|undefined)?.output?.statusCode;
        if(code!==DisconnectReason.loggedOut)setTimeout(()=>void connect(),3000);
      }
    });
  }catch(error){connecting=false;state.connectionStatus='disconnected';state.currentAction='Falha ao iniciar a conexão.';addLog(error instanceof Error?error.message:'Falha de conexão.','warning');}
}

function auditLog(action: string, userEmail: string, details: Record<string, unknown> = {}) {
  adminDb.collection('dispatch_audit').add({
    action,
    userEmail,
    timestamp: new Date().toISOString(),
    ...details,
  }).catch(err => console.error('Falha ao registrar auditoria de disparo:', err));
}

export function configureMessageDispatch(app:express.Express, requireAuth: express.RequestHandler, requireRole: express.RequestHandler){
  app.get('/api/message-dispatch/status', requireAuth, requireRole, (req,res)=>{res.json(publicState());});
  app.post('/api/message-dispatch/connect', requireAuth, requireRole, async(req,res)=>{void connect();res.json({success:true});});
  app.post('/api/message-dispatch/stop', requireAuth, requireRole, (req,res)=>{
    const userEmail = authenticatedUser(req)?.email || 'unknown';
    state.isSending=false;state.campaignStatus='stopped';state.currentAction='Envio interrompido pelo operador.';addLog(`Campanha interrompida por ${userEmail}.`,'warning');
    auditLog('CAMPAIGN_STOPPED', userEmail, { runId: state.runId });
    res.json({success:true});
  });
  app.post('/api/message-dispatch/start', requireAuth, requireRole, async(req,res)=>{
    const userEmail = authenticatedUser(req)?.email || 'unknown';
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
    state.isSending=true;state.campaignStatus='running';state.runId=crypto.randomUUID();state.successCount=0;state.errorCount=0;state.errorDetails=[];state.total=contacts.length;state.progress=0;state.logs=[];
    addLog(`Campanha iniciada por ${userEmail} com ${contacts.length} destinatário(s).`);
    auditLog('CAMPAIGN_STARTED', userEmail, { runId: state.runId, totalContacts: contacts.length });
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
      auditLog('CAMPAIGN_COMPLETED', userEmail, { runId: state.runId, success: state.successCount, errors: state.errorCount });
    }
    state.isSending=false;
  });
}
