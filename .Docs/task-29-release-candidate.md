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
- Migração de autenticação em simulação: 17 perfis analisados; 2 canônicos, 2 migráveis e 13 sem usuário correspondente no Firebase Auth.
- Migração de unidades em simulação: 212 documentos analisados; 92 válidos, 25 resolvíveis e 95 não resolvidos.
- Produção: não alterada.

## Pendências para aprovação

1. Corrigir ou decidir o tratamento dos 13 perfis sem conta de autenticação.
2. Resolver os 95 documentos cuja unidade não pôde ser inferida automaticamente.
3. Executar smoke tests autenticados com contas reais de todos os perfis após a regularização das contas ausentes.

A tarefa permanece aberta até que essas evidências sejam obtidas. Nenhuma migração foi aplicada e nenhum deploy de produção foi realizado.
