# Tarefa 29 — Release candidata

Este registro acompanha a Tarefa 29 definida em [`tasks.md`](./tasks.md), conforme os critérios do [`prd.md`](./prd.md).

## Estado atual

- Commit candidato: `ba1ff4d` (`fix: rotear endpoints aninhados de links inteligentes`).
- Ambiente de homologação: `https://vangard-sistema-5cjpef5zf-dilsonastro18-gmailcoms-projects.vercel.app` (deployment `dpl_EJoyMCdHKRYfjx7emfjTKtkwz76c`).
- Build de produção: aprovado.
- TypeScript: aprovado.
- Testes financeiros, responsivos, de autorização, isolamento e segurança: 25 cenários aprovados na validação final, além dos 2 testes específicos de segurança de links inteligentes.
- Smoke HTTP público: página principal carregada com `lang="pt-BR"` e cabeçalhos de segurança presentes.
- Smoke das funções serverless: endpoints base e aninhado de links inteligentes respondem `401` sem token, confirmando roteamento e proteção; redirecionamento inexistente apresenta a tela segura de destino indisponível.
- Logs de build da Vercel: compilação concluída sem erros. Falhas de runtime encontradas durante o smoke foram corrigidas nos commits `cb29ebf`, `0fad934`, `0ee08f9` e `ba1ff4d`.
- Backup disponível: `.Docs/BAKU.MOD.md`, validado novamente em 12/09/2026 com 23 coleções e 304 documentos. A comparação encontrou 21 documentos novos e preservaria 283 existentes.
- Limpeza de autenticação: 13 perfis sem correspondência no Firebase Auth removidos em 12/09/2026 após simulação e backup verificável. Restaram 4 perfis: 2 canônicos e 2 prontos para padronização por UID.
- Limpeza de unidades: os 95 documentos originalmente não resolvidos foram removidos em 12/09/2026 após simulação, backup externo e verificação. Uma nova auditoria encontrou 118 documentos: 92 válidos, 7 resolvíveis e 19 não resolvidos adicionais, preservados para análise por conterem principalmente histórico de pagamentos.
- Produção: não alterada.

## Pendências para aprovação

1. Aplicar a padronização por UID dos 2 perfis autenticados ainda migráveis.
2. Tratar os 19 documentos adicionais sem unidade revelados após a remoção dos perfis órfãos (17 pagamentos, 1 meta e 1 trabalho de importação).
3. Executar smoke tests autenticados com contas reais dos perfis disponíveis.

A tarefa permanece aberta até que essas evidências sejam obtidas. Nenhuma migração foi aplicada e nenhum deploy de produção foi realizado.
