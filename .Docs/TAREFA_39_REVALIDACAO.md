# Tarefa 39 — Consolidação local após revalidação das tarefas 36–38

Data: 12/09/2026. Referências: [backlog](./tasks.md), [PRD](./prd.md) e [registro histórico de produção](./task-39-production-release.md).

## Rastreabilidade

| Estado | Identificação verificada |
| --- | --- |
| Isolamento de demonstrações | `cd2e66c` — tarefa 36 |
| Compatibilidade e auditoria de dependências | `778e54e` — tarefa 37 |
| Grafo inicial e recuperação de carregamento | `98a4641` — tarefa 38 |
| Consolidação local | Commit com assunto `chore: consolidar validacao e inicializacao local (tarefa 39)` que contém este documento |
| Remoto em 12/09/2026 | `aa7b44616dd7844ff5b48c1ac4fb8a6db81463a7`, consultado com `git ls-remote origin refs/heads/master` |
| Produção observada | `https://vangard-sistema.vercel.app` respondeu HTTP 200 e referenciou `/assets/index-Bf13NZdH.js` |
| Build local candidato | `/assets/index-CoocYOEt.js` |

A produção e o remoto ainda são anteriores às revalidações. Não houve push nem deploy nesta consolidação. O deployment ID do documento histórico não foi novamente consultado na API da Vercel; o HTTP público não comprova o commit implantado. Para obter o hash desta consolidação, use `git log -1 --format=%H --grep="chore: consolidar validacao e inicializacao local (tarefa 39)"`.

## Ajustes da consolidação

- Incorporada a necessidade do ajuste Windows preexistente em `scripts/dev-all.ts`: agora os serviços são filhos diretos do Node, sem depender de `npm.cmd` ou `shell: true`. Falhas de inicialização são reportadas e encerram o outro serviço.
- Atualizado o teste de cabeçalhos para `message-service-app.ts`, arquivo onde o middleware reside após a separação do serviço.
- Teste HTTP verifica os quatro cabeçalhos de segurança do serviço de mensagens.
- Falha de consulta ou ausência de resultado do `npm audit` não é mais interpretada como zero vulnerabilidades.

## Evidências

- Build completo, typecheck e lint aprovados; permanece aviso de chunks grandes.
- 19 testes E2E aprovados, incluindo perfis, navegação, confirmação, gráficos, tabela financeira e demonstrações em três larguras.
- 66 testes críticos aprovados: autenticação, cliente HTTP, autorização, motor financeiro, comissões, fluxos financeiros, catálogo, demonstrações, segurança, links e mensagens.
- 6 testes de carregamento sob demanda aprovados na tarefa 38.
- Admin SDK aprovado no Emulator na tarefa 37; regras validadas no Emulator durante a revalidação da tarefa 36.
- `npm run dev:all` iniciou os dois serviços em portas isoladas 4176/4177. Os dois endpoints de saúde retornaram `ok`; Ctrl+C encerrou ambos e as portas ficaram livres.
- Auditoria de produção: zero alta/crítica, duas moderadas com exposição avaliada na seção 7.1 da arquitetura.
- Artefatos de build, relatórios locais, credenciais e sessões não entram no commit.

## Próxima etapa operacional

O candidato local está preparado. A publicação desta versão e a sincronização do remoto permanecem uma etapa operacional posterior; este registro não substitui os smoke tests autenticados após um novo deploy.
