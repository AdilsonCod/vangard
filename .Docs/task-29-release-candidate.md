# Tarefa 29 — Release candidata

Este registro acompanha a Tarefa 29 definida em [`tasks.md`](./tasks.md), conforme os critérios do [`prd.md`](./prd.md).

## Estado atual

- Commit candidato: `fb767dc` (`fix: concluir normalizacao de unidades`).
- Ambiente de homologação: `https://vangard-sistema-fn88glpu5-dilsonastro18-gmailcoms-projects.vercel.app` (deployment `dpl_583z82g1F9DuvBmjVUrGwy9rotzf`).
- Build de produção: aprovado.
- TypeScript: aprovado.
- Testes financeiros, responsivos, de autorização, isolamento e segurança: 25 cenários aprovados na validação final, além dos 2 testes específicos de segurança de links inteligentes.
- Smoke HTTP público: página principal carregada com `lang="pt-BR"` e cabeçalhos de segurança presentes.
- Smoke das funções serverless: endpoints base e aninhado de links inteligentes respondem `401` sem token, confirmando roteamento e proteção; redirecionamento inexistente apresenta a tela segura de destino indisponível.
- Logs de build da Vercel: compilação concluída sem erros. Falhas de runtime encontradas durante o smoke foram corrigidas nos commits `cb29ebf`, `0fad934`, `0ee08f9` e `ba1ff4d`.
- Backup disponível: `.Docs/BAKU.MOD.md`, validado novamente em 12/09/2026 com 23 coleções e 304 documentos. A comparação encontrou 21 documentos novos e preservaria 283 existentes.
- Limpeza de autenticação: 13 perfis sem correspondência no Firebase Auth removidos em 12/09/2026 após simulação e backup verificável. Os 4 perfis restantes estão padronizados pelo UID do Firebase Auth.
- Migração de unidades: 95 documentos antigos autorizados foram removidos com backup; 18 históricos tiveram sua unidade recuperada do backup original; 7 vínculos explícitos foram aplicados; a importação global foi classificada como `ALL`. Auditoria final: 118 válidos, 0 resolvíveis e 0 não resolvidos.
- Smoke de perfis: matriz automatizada aprovada para Administrador, Gerência, Financeiro, Marketing, Recepção e Barbeiro; autorização das APIs validada com cenários `401`, `403` e acessos permitidos.
- Produção: não alterada.

## Resultado

A release candidata foi aprovada para publicação. Os backups permanecem em `C:\Users\Lewis\Documents\Firebase Backups`. Nenhum deploy de produção foi realizado nesta tarefa.
