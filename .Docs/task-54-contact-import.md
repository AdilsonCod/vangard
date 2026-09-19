# Tarefa 54 — Importação de contatos com mapeamento

Implementação do importador previsto no [PRD de disparo de mensagens](./PRD_DISPARO_MENSAGENS.md).

## Entregue

- Upload de CSV, XLSX, XLS e ODS com limite de 10 MB.
- Validação de extensão, arquivo vazio e assinatura binária de XLSX, XLS e ODS corrompidos.
- Detecção automática e ajuste manual das colunas de nome, telefone, origem, data e evidência do consentimento.
- Seleção de qualquer coluna adicional como variável personalizada.
- Normalização de telefones brasileiros, remoção de duplicatas e identificação das linhas inválidas.
- Prévia com totais e linhas problemáticas antes da confirmação definitiva.
- Confirmação explícita aplica apenas contatos válidos e preserva consentimento e variáveis importadas.

## Validação

- `npm run test:message-contact-import`: 6 cenários aprovados cobrindo os quatro formatos, cabeçalhos, duplicatas, inválidos, vazio, tamanho, corrupção e ausência de mapeamento.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
