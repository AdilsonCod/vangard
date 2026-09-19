# Tarefa 53 — Confirmação de alto volume e envio de teste

Implementação complementar ao fluxo definido no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Desafio de confirmação emitido pelo backend para campanhas com 50 ou mais destinatários, configurável por `MESSAGE_HIGH_VOLUME_THRESHOLD`.
- Texto exato, validade de 10 minutos, vínculo com usuário, unidade, campanha e quantidade de destinatários, além de consumo atômico e uso único.
- Invalidação do desafio na interface sempre que conteúdo, destinatários, unidade ou parâmetros da campanha forem alterados.
- Envio de teste para um único número usando a mensagem final, sem criar destinatários nem liberar a fila principal.
- Registro persistente do teste em `message_campaign_test_sends`, com `campaignId`, status, telefone mascarado, responsável, horários e erro quando houver.
- Eventos de auditoria para emissão do desafio, sucesso e falha do envio de teste.

## Validação

- `npm run test:message-campaign-confirmation`: 4 cenários aprovados (texto incorreto, desafio expirado, confirmação correta/vinculada e falha do teste vinculada à campanha).
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
