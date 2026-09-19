import 'dotenv/config';
import { shutdownMessageDispatchService, startMessageDispatchConnection } from './message-dispatch-service';
import { createMessageServiceApp } from './message-service-app';

const app = createMessageServiceApp();
const port = Number(process.env.PORT || process.env.MESSAGE_SERVICE_PORT || 3101);

const server=app.listen(port, '0.0.0.0', () => {
  console.log(`Serviço persistente de mensagens ativo na porta ${port}.`);
  if (process.env.MESSAGE_AUTO_CONNECT !== 'false') void startMessageDispatchConnection();
});

let shuttingDown=false;
async function gracefulShutdown(signal:string){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log(`${signal} recebido: drenando o serviço de mensagens.`);
  server.close();
  const forceTimer=setTimeout(()=>process.exit(1),30_000);
  forceTimer.unref();
  try{await shutdownMessageDispatchService(25_000);process.exitCode=0;}
  catch(error){console.error('Falha no encerramento seguro:',error);process.exitCode=1;}
  finally{clearTimeout(forceTimer);}
}
process.once('SIGTERM',()=>void gracefulShutdown('SIGTERM'));
process.once('SIGINT',()=>void gracefulShutdown('SIGINT'));
