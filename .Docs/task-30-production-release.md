# Tarefa 30 — Publicação em produção

Este checklist implementa a Tarefa 30 de [`tasks.md`](./tasks.md), conforme os critérios do [`prd.md`](./prd.md).

## Versão aprovada

- Release candidata: commit `fb767dc`.
- Preview aprovado: `dpl_583z82g1F9DuvBmjVUrGwy9rotzf`.
- Backups de migração: `C:\Users\Lewis\Documents\Firebase Backups`.

## Plano de reversão

1. Não executar novas migrações durante o deploy da aplicação.
2. Se o smoke pós-deploy falhar, promover novamente o deployment de produção anterior pelo painel da Vercel ou executar `vercel rollback`.
3. Se uma inconsistência de dados for identificada, interromper gravações relacionadas e restaurar somente as coleções afetadas a partir dos backups, após simulação.
4. Confirmar após a reversão o login, permissões, filtros de unidade e os módulos financeiros.

## Checklist pós-deploy

- [ ] Produção aponta para o commit aprovado.
- [ ] Página principal responde `200` com cabeçalhos de segurança.
- [ ] API protegida responde `401` sem token.
- [ ] Build e logs não apresentam erro crítico.
- [ ] Login, perfis, unidade, financeiro, importações e relatórios estão validados.
