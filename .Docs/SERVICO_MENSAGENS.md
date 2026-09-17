# Serviço persistente de mensagens

Implementação da Tarefa 19 de [`tasks.md`](./tasks.md), conforme a arquitetura e os requisitos do [`prd.md`](./prd.md).

## Separação dos processos

- A aplicação web continua sendo publicada na Vercel.
- O Baileys é executado separadamente por `message-service-server.ts` em um host com processo e volume persistentes (VM, Render, Railway, Fly.io ou serviço equivalente).
- O frontend acessa esse serviço pela URL definida em `VITE_MESSAGE_SERVICE_URL` e envia o Firebase ID Token em todas as requisições.
- O serviço valida o token e permite somente `ADMIN`, `MARKETING` e `RECEPTION`.

O serviço não deve ser hospedado em uma função serverless/efêmera. Reinícios e novas publicações do frontend não afetam sua conexão com o WhatsApp.

## Sessão criptografada

As credenciais do Baileys são persistidas em um único cofre AES-256-GCM. Configure:

- `WHATSAPP_AUTH_VAULT=/data/whatsapp/session.enc`
- `MESSAGE_AUTH_ENCRYPTION_KEY=<segredo aleatório com 32 ou mais caracteres>`

Monte `/data` como volume persistente. O segredo deve permanecer no cofre de segredos do provedor, nunca no Git e nunca em variável iniciada por `VITE_`. A sessão antiga de `.whatsapp-session` não é importada automaticamente; após a migração, conecte uma vez pelo QR Code.

## Implantação

1. Construa o arquivo `message-service.Dockerfile`.
2. Publique a porta indicada por `PORT` (em desenvolvimento, o padrão é `3101`).
3. Configure `FIREBASE_PROJECT_ID` e `FIREBASE_SERVICE_ACCOUNT_JSON` no host persistente.
4. Configure `MESSAGE_ALLOWED_ORIGINS` com o domínio exato da aplicação Vercel.
5. Configure no build da Vercel `VITE_MESSAGE_SERVICE_URL=https://mensagens.seu-dominio`.
6. Confirme `GET /health` e então conecte o WhatsApp no painel.

Em desenvolvimento, use `npm run dev:all` para iniciar a aplicação web e o serviço de mensagens juntos. Também é possível executar `npm run dev` e `npm run dev:messages` em terminais separados. O frontend usa `http://127.0.0.1:3101` como padrão local para evitar colisões com outros serviços em `localhost`.

## Falhas

Se o serviço estiver fora do ar, o painel mostra um aviso e desabilita as ações dependentes da conexão. Os demais módulos continuam funcionando normalmente. O polling restaura o estado automaticamente quando o serviço volta.

## Verificação

- `npm run test:message-auth-store` comprova que o arquivo persistido não contém os dados em texto claro e pode ser restaurado.
- `npm run test:message-service-health` inicia a API em uma porta temporária e valida a resposta pública de `/health` sem expor configurações ou segredos.
- `npm run typecheck`, `npm run lint` e `npm run build` verificam os dois processos.

## Campanhas persistentes (schema v1)

O modelo versionado da evolução do disparo usa coleções de nível superior, sempre com `unitId`:

- `message_campaigns`: configuração, agenda, estado e contadores consolidados da campanha;
- `message_campaign_recipients`: um registro por destinatário normalizado, com estado, chave de idempotência, tentativas e lease;
- `message_delivery_attempts`: histórico imutável de cada tentativa de entrega;
- `message_campaign_media`: metadados dos anexos armazenados fora do documento da campanha;
- `message_dead_letters`: falhas definitivas encaminhadas para revisão.

Os estados dos destinatários são `PENDENTE`, `PROCESSANDO`, `ENVIADO`, `ENTREGUE`, `LIDO`, `FALHOU` e `CANCELADO`. O schema compartilhado está em `src/services/messageCampaignSchema.ts`. As gravações dessas coleções são exclusivas do serviço autenticado pelo Admin SDK; clientes autorizados podem apenas ler documentos da própria unidade.

### Migração do histórico legado

Execute primeiro a simulação, que somente gera o relatório local `message-campaign-migration-v1-report.json`:

```bash
npm run messages:migrate:v1:dry
```

Depois de revisar o relatório, aplique a migração com:

```bash
npm run messages:migrate:v1:apply
```

A migração usa IDs e chaves de idempotência determinísticos, ignora campanhas já criadas e preserva `message_dispatch_history`. O worker ainda passa a consumir esse modelo nas tarefas 41 e 42 do plano progressivo.

### Criação atômica e idempotente

O endpoint de início exige uma chave de idempotência, gerada no navegador e mantida durante retentativas da mesma solicitação. O serviço deriva dela um ID determinístico por usuário e unidade. Em uma única transação do Firestore ele:

1. verifica se a solicitação já existe;
2. cria a campanha em `NA_FILA`;
3. cria um destinatário `PENDENTE` para cada telefone válido e deduplicado.

Se a transação falhar, nenhum documento parcial permanece. Repetir a mesma solicitação retorna a campanha original; reutilizar a chave com conteúdo diferente é rejeitado. O teste automatizado é executado com `npm run test:message-campaign-creation`.

### Worker distribuído e lease

Cada instância recebe um `MESSAGE_WORKER_ID` (ou gera um identificador exclusivo ao iniciar). Antes de enviar, o worker reivindica o destinatário numa transação do Firestore e grava `PROCESSANDO`, `leaseOwner` e `leaseExpiresAt`. O lease é renovado durante operações demoradas e somente seu proprietário pode finalizar o registro.

- leases vigentes impedem processamento concorrente;
- leases vencidos tornam o item recuperável por outra instância;
- campanhas pausadas, canceladas ou encerradas não liberam novos destinatários;
- destinatários enviados, entregues, lidos, falhos ou cancelados não retornam à fila.

Use `npm run test:message-campaign-worker` para executar o teste concorrente no Firestore Emulator.

### Retomada após reinício

Quando a conexão do WhatsApp é aberta, o serviço consulta campanhas `NA_FILA` e `EM_PROCESSAMENTO` da unidade conectada. Antes de retomar, ele reconstrói todos os contadores a partir dos documentos de destinatários e devolve à fila somente registros `PROCESSANDO` cujo lease venceu.

As configurações operacionais de pausa, digitação e mensagem ficam no documento persistente da campanha. Assim, um novo processo não depende do estado em memória do processo anterior. Destinatários em estados finais são preservados e não são reenviados. A integração de reinício é validada por `npm run test:message-campaign-recovery`.

### Retentativas e fila de erros

Falhas transitórias retornam o destinatário para `PENDENTE` com backoff exponencial de 30, 60 e encerramento na terceira tentativa. Falhas permanentes, como número inválido ou não registrado no WhatsApp, não são repetidas. Cada falha gera um documento em `message_delivery_attempts`.

Ao esgotar as tentativas, o destinatário passa para `FALHOU` e é registrado em `message_dead_letters` somente com o telefone mascarado. O reprocessamento manual reabre a campanha, registra o responsável e adiciona um evento em `dispatch_audit`. Os cenários usam relógio controlado em `npm run test:message-campaign-retry`.

### Sessões independentes por unidade

Cada unidade possui uma instância isolada contendo socket, QR Code, estado da campanha e worker. Os cofres são derivados de `WHATSAPP_AUTH_VAULT` e gravados em `sessions/<hash-da-unidade>.enc`, sem utilizar o identificador informado como caminho de arquivo.

O painel exige uma unidade específica antes de conectar. Desconectar, redefinir ou expirar a sessão de uma unidade não altera as demais. Para reconectar unidades automaticamente ao iniciar o serviço, configure `MESSAGE_AUTO_CONNECT_UNITS=unit-a,unit-b`; unidades com campanhas interrompidas também são detectadas automaticamente.

Use `npm run test:message-session-scope` para validar o isolamento das instâncias e dos cofres.

### Ciclo de vida da conexão

O serviço persiste em `message_whatsapp_sessions` os metadados operacionais de cada unidade: nome e número da conta conectada, horário da última conexão bem-sucedida, validade do QR Code e o motivo da última desconexão. O painel disponibiliza ações separadas para conectar, reconectar, desconectar e gerar um novo QR, sempre vinculadas à unidade autorizada.

Cada QR expira após 60 segundos. A interface apresenta a contagem regressiva e o serviço invalida o código no servidor ao término desse prazo, impedindo seu reaproveitamento. Desconexões solicitadas pelo usuário são registradas como intencionais; expiração do QR e quedas inesperadas permanecem distinguíveis no estado exibido.

As ações geram eventos em `dispatch_audit` e não expõem gravação direta dos metadados ao navegador. Use `npm run test:message-session-lifecycle` para validar expiração e classificação dos motivos de desconexão.

### Lock distribuído das sessões

Antes de abrir um socket, cada instância precisa adquirir em `message_whatsapp_session_locks` o lock exclusivo da unidade. O lock usa lease de 60 segundos, renovado a cada 20 segundos, e um `fencingToken` crescente impede que uma instância antiga renove ou libere a posse depois de uma recuperação.

O envio também confirma a posse antes de retirar o próximo destinatário da fila. Se a renovação falhar ou o lock for perdido, o serviço encerra o socket local, interrompe o processamento e registra `SESSION_LOCK_LOST` na auditoria. Após falha completa de uma instância, outra pode assumir a unidade quando o lease expirar.

O identificador combina o identificador da réplica com um UUID criado em tempo de execução, evitando que duas réplicas recebam acidentalmente a mesma identidade por configuração. Use `npm run test:message-session-lock` para validar exclusividade concorrente, renovação, fencing e recuperação.
