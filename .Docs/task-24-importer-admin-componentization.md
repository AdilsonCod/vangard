# Tarefa 24 — Importador e painel administrativo

Esta implementação atende à Tarefa 24 de [`tasks.md`](./tasks.md) e mantém os fluxos de importação e permissões descritos no PRD.

## Estrutura extraída

- `dataImportParsing`: identifica formatos, normaliza moedas e quantidades, detecta cabeçalhos e gera fingerprints SHA-256.
- `ImportPreviewHeader`: apresenta resumo de linhas, proteção de duplicidade e estado de salvamento sem conhecer a persistência.
- `adminNavigation`: mantém a árvore do menu e a matriz de acesso por perfil fora da renderização do painel.
- Parsers especializados de DPote e Cashbarber permanecem isolados em seus módulos existentes.
- A persistência continua coordenada pelo importador para preservar a confirmação de substituição, bloqueio de pagamentos quitados e gravação do job de importação.

## Garantias preservadas

- Dados existentes ainda exigem confirmação explícita antes da substituição.
- O cancelamento mantém os dados anteriores.
- O fingerprint contextual bloqueia reimportação idêntica quando não existe substituição autorizada.
- Recepção, financeiro e marketing recebem somente as rotas permitidas; administrador conserva acesso integral.

## Validação

- TypeScript e build de produção aprovados.
- 4 testes dos módulos de importação e navegação aprovados.
- 13 testes do motor financeiro, incluindo substituição sem acumulação, aprovados.
- 3 testes da matriz geral de permissões aprovados.
- Tela “Importador de relatórios” e ação “Ler Arquivo” verificadas no navegador após a divisão.
