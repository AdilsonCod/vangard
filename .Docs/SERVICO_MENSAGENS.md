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

### Atualizações em tempo real

O painel acompanha a sessão pelo endpoint SSE autenticado `GET /api/message-dispatch/events?unitId=<unidade>`. O serviço publica eventos de QR, conexão, progresso e alerta somente aos assinantes autorizados da mesma unidade. O polling periódico de estado foi removido.

Cada evento possui um cursor crescente por unidade. O navegador envia `Last-Event-ID` ao reconectar e recebe imediatamente um snapshot completo do estado atual, evitando lacunas mesmo quando eventos ocorrerem durante a queda. Heartbeats mantêm o canal ativo através de proxies, e a interface tenta reconectar automaticamente após dois segundos.

Use `npm run test:message-realtime` para validar autenticação, isolamento entre unidades, cursor/snapshot e remoção de assinantes desconectados.

### Lista global não enviar e opt-out

A coleção `message_global_blocklist` mantém o bloqueio global por hash determinístico do telefone. Contatos bloqueados são removidos da criação de novas campanhas, cancelados nas filas existentes e verificados novamente imediatamente antes do envio. Dessa forma, o bloqueio vale para todas as unidades e campanhas.

Respostas diretas no WhatsApp contendo somente **SAIR**, **PARAR** ou **CANCELAR** — desconsiderando caixa, acentos, espaços e pontuação — acionam o bloqueio imediato. Cada bloqueio ou desbloqueio gera um registro imutável em `message_consent_events`; os eventos operacionais também são gravados em `dispatch_audit` sem expor o telefone integral.

O backend oferece consulta e inclusão manual na lista. O desbloqueio é restrito ao perfil administrador e exige justificativa com pelo menos dez caracteres. Use `npm run test:message-blocklist` para validar variações das palavras, exclusão na criação, cancelamento imediato, concorrência com o worker e desbloqueio auditável.

### Consentimento e histórico de opt-in

O estado atual do consentimento é persistido em `message_contact_consents`, isolado pela combinação de unidade e telefone normalizado. Cada registro inclui base legal, origem, data, evidência, autor e situação atual. A criação da campanha recusa contatos sem consentimento concedido ou outra base legal válida; a lista global “não enviar” continua tendo precedência sobre qualquer autorização.

Toda mudança produz um evento imutável em `message_consent_events`. O endpoint autenticado `GET /api/message-dispatch/consent-audit` recebe unidade, telefone e uma data opcional e reconstrói a situação vigente naquele instante a partir do histórico, sem depender apenas do estado atual.

Na importação de contatos, o usuário pode mapear as colunas de telefone, origem, data e evidência do opt-in. Contatos que não possuem esses dados na planilha precisam usar a origem, data e evidência informadas no formulário antes que a campanha seja liberada.

A rotina de retenção é executada na inicialização e diariamente. Após o período configurado em `MESSAGE_PHONE_RETENTION_DAYS` (730 dias por padrão), telefones antigos são anonimizados no histórico operacional, preservando estados, contadores e métricas agregadas. Use `npm run test:message-consent` para validar mapeamento, persistência, reconstrução histórica e retenção.

### Limites, frequência e horário silencioso

Antes de reivindicar um destinatário, o worker reserva atomicamente as cotas diária global, da unidade e da conta conectada. Os contadores ficam em `message_dispatch_quota_counters`; a reserva é registrada no próprio destinatário, portanto uma retentativa não consome a cota novamente. Transações concorrentes não conseguem ultrapassar os limites.

`message_contact_frequency` mantém a última reserva e a próxima data permitida por contato e unidade. Uma campanha diferente para o mesmo contato aguarda o término dessa janela, evitando campanhas simultâneas ou repetição recente. O destinatário permanece `PENDENTE`, na posição original da fila.

Por padrão, a política utiliza os limites global de 10.000, por unidade de 2.000 e por conta de 2.000 mensagens ao dia, intervalo de 24 horas por contato e horário silencioso das 22h às 8h no fuso `America/Sao_Paulo`. Administradores podem consultar e atualizar a configuração por unidade em `GET/PUT /api/message-dispatch/policy`.

Quando uma restrição impede o envio, o SSE informa o motivo em português e o horário estimado de liberação. O painel mantém a campanha ativa, mostra o bloqueio e volta a tentar sem retirar ou reordenar destinatários. Use `npm run test:message-dispatch-limits` para validar concorrência, silêncio, frequência e idempotência das reservas.

### Aquecimento e pausa automática de segurança

Contas novas seguem uma curva persistente de aquecimento armazenada em `message_account_safety`. A configuração padrão libera 20, 50, 100, 250 e 500 envios diários, avançando de estágio a cada dois dias. A cota efetiva nunca ultrapassa o limite diário geral da conta. Os campos `warmupEnabled`, `warmupDailyLimits` e `warmupStageDays` podem ser configurados na política da unidade.

Cada entrega definitiva alimenta uma janela móvel de resultados por conta. Por padrão, o sistema avalia os últimos 20 envios após uma amostra mínima de 10 e pausa a campanha quando as falhas alcançam 30%. A causa, tamanho da amostra, taxa, limiar e horário mínimo de retomada são persistidos na campanha e registrados em `dispatch_audit`.

Ao pausar automaticamente, o serviço publica um alerta em tempo real e cria notificações para os administradores ativos. A retomada fica restrita a administradores e somente é aceita depois do cooldown configurado em `autoPauseCooldownMinutes`; responsável e horário ficam registrados de forma auditável. Use `npm run test:message-campaign-safety` para validar curva, janela móvel, pausa e retomada protegida.
