# Auditoria e proteção dos disparos

Implementação da Tarefa 20 de [`tasks.md`](./tasks.md), conforme os requisitos do [`prd.md`](./prd.md).

## Autorização

Todas as rotas de status, conexão, início e interrupção exigem Firebase ID Token e um dos perfis `ADMIN`, `MARKETING` ou `RECEPTION`.

- Marketing e Recepção operam somente a unidade vinculada ao perfil autenticado.
- A gerência declara explicitamente a unidade ou o escopo `ALL`.
- O servidor rejeita tentativas de operar ou interromper campanhas de outra unidade.
- Função ou unidade enviadas pelo navegador nunca substituem os dados confiáveis do perfil Firebase.

## Eventos registrados

A coleção append-only `dispatch_audit` recebe eventos gerados pelo servidor:

- `CONNECTION_REQUESTED`, `CONNECTION_OPENED`, `CONNECTION_CLOSED` e `CONNECTION_FAILED`;
- `CAMPAIGN_STARTED`, `CAMPAIGN_STOPPED` e `CAMPAIGN_COMPLETED`.

Os eventos incluem UID, perfil, e-mail, unidade, horário e contexto. Início e conclusão registram totais; falhas registram seus motivos; interrupções exigem uma justificativa auditável.

O resumo operacional é persistido pelo servidor em `message_dispatch_history`. Escritas do navegador foram bloqueadas para essa coleção e para `dispatch_audit`; usuários autorizados mantêm apenas leitura dentro do próprio escopo.

## Controles preservados

- Máximo de 200 destinatários por execução.
- Confirmação explícita de consentimento.
- Intervalos mínimos e máximos validados no servidor.
- Mensagens limitadas a 4.096 caracteres.
- Nenhum segredo ou chave operacional é solicitado na interface.

## Testes

- `npm run test:message-dispatch-policy`: isolamento entre unidades, escopo administrativo e justificativa de interrupção.
- `npm run test:api-authorization`: autenticação e matriz de perfis das APIs.
- `npm run test:firestore:collections`: confirma que histórico e auditoria são server-only e imutáveis; requer Java para o emulador.

