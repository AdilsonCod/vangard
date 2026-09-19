# Tarefa 55 — Base de clientes e segmentos reutilizáveis

Implementação do fluxo previsto no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Contatos confirmados na importação passam a compor uma base persistente vinculada à unidade.
- Busca paginada por nome, sempre limitada à unidade autorizada.
- Telefone mascarado nos resultados; o número completo somente é resolvido no backend após seleção autorizada.
- Inclusão de clientes na campanha com deduplicação em relação aos contatos já presentes.
- Segmentos reutilizáveis com política explícita `SNAPSHOT`: mudanças futuras na base não alteram sua composição.
- Validação no backend impede salvar ou resolver contatos e segmentos pertencentes a outra unidade.
- Eventos de auditoria para importação da base e criação de segmentos.

## Validação

- `npm run test:message-contact-directory`: isolamento entre unidades, mascaramento, paginação e deduplicação de snapshot aprovados.
- `npm run test:message-contact-import`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
