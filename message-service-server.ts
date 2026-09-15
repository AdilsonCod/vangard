import 'dotenv/config';
import { startMessageDispatchConnection } from './message-dispatch-service';
import { createMessageServiceApp } from './message-service-app';

const app = createMessageServiceApp();
const port = Number(process.env.PORT || process.env.MESSAGE_SERVICE_PORT || 3101);

app.listen(port, '0.0.0.0', () => {
  console.log(`Serviço persistente de mensagens ativo na porta ${port}.`);
  if (process.env.MESSAGE_AUTO_CONNECT !== 'false') void startMessageDispatchConnection();
});
