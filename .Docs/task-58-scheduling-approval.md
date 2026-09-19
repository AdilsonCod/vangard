# Tarefa 58 — Agendamento, recorrência e aprovação

Implementação do fluxo previsto no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Agendamento persistente por data e hora, registrando o fuso IANA utilizado pela unidade.
- Liberação automática da fila no horário programado, inclusive após reinício do serviço.
- Recorrência diária, semanal ou mensal, com data final opcional e criação persistente da próxima ocorrência.
- Cálculo de recorrência por horário civil, preservando a hora local em mudanças de horário de verão.
- Aprovação opcional por outro administrador; o criador é impedido de aprovar a própria campanha no backend.
- Painel de campanhas programadas com ações de aprovar, cancelar e duplicar.
- Cancelamento livre e auditado antes do primeiro envio; depois disso o sistema exige o fluxo de interrupção auditada.
- Duplicação carrega uma nova composição sem copiar ID, estado, agenda, aprovação ou chave de idempotência.

## Validação

- `npm run test:message-campaign-scheduling`
- `npm run test:message-campaign-creation`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
