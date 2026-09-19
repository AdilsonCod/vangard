# Tarefa 56 — Rascunhos, modelos e personalização

Implementação do fluxo previsto no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Rascunhos e modelos persistentes, vinculados à unidade e disponíveis após recarregar ou iniciar nova sessão.
- Biblioteca para carregar, editar e reutilizar mensagens salvas.
- Tags `{{nome}}`, `{{primeiro_nome}}`, `{{segundo_nome}}` e variáveis personalizadas, com fallback seguro.
- Pré-visualização da mensagem usando um contato real selecionado na campanha.
- Materialização individual da mensagem antes da criação da fila, registrada em cada destinatário para auditoria e retomada.
- Proteção de isolamento que impede leitura ou alteração de conteúdo pertencente a outra unidade.

## Validação

- `npm run test:message-personalization`
- `npm run test:message-campaign-creation`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
