# Tarefa 29 — Release candidata

Este registro acompanha a Tarefa 29 definida em [`tasks.md`](./tasks.md), conforme os critérios do [`prd.md`](./prd.md).

## Estado atual

- Commit-base candidato: `0f5f6fd` (`test: validar fluxos responsivos e seguranca`).
- Build de produção: aprovado.
- TypeScript: aprovado.
- Testes financeiros, responsivos, de autorização, isolamento e segurança: aprovados nas Tarefas 26–28.
- Backup disponível: `.Docs/BAKU.MOD.md`, validado estruturalmente com 23 coleções e 304 documentos. A comparação encontrou 21 documentos novos e preservaria 283 existentes.
- Migração de autenticação em simulação: 17 perfis analisados; 2 canônicos, 2 migráveis e 13 sem usuário correspondente no Firebase Auth.
- Migração de unidades em simulação: 212 documentos analisados; 92 válidos, 25 resolvíveis e 95 não resolvidos.
- Produção: não alterada.

## Pendências para aprovação

1. Corrigir ou decidir o tratamento dos 13 perfis sem conta de autenticação.
2. Resolver os 95 documentos cuja unidade não pôde ser inferida automaticamente.
3. Após o preview, executar smoke tests autenticados dos perfis e confirmar ausência de erros críticos no navegador e nas APIs.

A tarefa permanece aberta até que essas evidências sejam obtidas. Nenhuma migração foi aplicada e nenhum deploy de produção foi realizado.
