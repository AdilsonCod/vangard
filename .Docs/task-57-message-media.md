# Tarefa 57 — Imagens, vídeos e legendas

Implementação do fluxo previsto no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Upload privado de até cinco anexos por campanha no Firebase Storage, vinculado à unidade.
- Imagens JPG, PNG e WebP de até 8 MB; vídeos MP4 e WebM de até 25 MB.
- Validação no navegador e no backend de extensão, MIME, assinatura binária e tamanho.
- Pré-visualização removível, ordenação dos anexos e legenda individual com tags de personalização.
- Metadados persistentes no Firestore e associação atômica das mídias à campanha.
- Worker recupera os arquivos do Storage após reinício e os envia na ordem configurada.
- Envio de teste inclui anexos sem liberar a fila principal.
- Exclusão de anexos não utilizados remove tanto o objeto privado quanto seus metadados.

## Validação

- `npm run test:message-campaign-media`
- `npm run test:message-campaign-creation`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
