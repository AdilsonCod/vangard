# Tarefa 30 — Publicação em produção

Este checklist implementa a Tarefa 30 de [`tasks.md`](./tasks.md), conforme os critérios do [`prd.md`](./prd.md).

## Versão aprovada

- Release candidata: commit `fb767dc`.
- Preview aprovado: `dpl_583z82g1F9DuvBmjVUrGwy9rotzf`.
- Commit de publicação: `78664d1` (somente documentação adicional sobre a candidata).
- Deployment de produção validado: `dpl_2Ee1StDYKuGJu5raNqSbQY9uY5KT`.
- URL canônica: `https://vangard-sistema.vercel.app`.
- Backups de migração: `C:\Users\Lewis\Documents\Firebase Backups`.

## Plano de reversão

1. Não executar novas migrações durante o deploy da aplicação.
2. Se o smoke pós-deploy falhar, promover novamente o deployment de produção anterior pelo painel da Vercel ou executar `vercel rollback`.
3. Se uma inconsistência de dados for identificada, interromper gravações relacionadas e restaurar somente as coleções afetadas a partir dos backups, após simulação.
4. Confirmar após a reversão o login, permissões, filtros de unidade e os módulos financeiros.

## Checklist pós-deploy

- [x] Produção aponta para o commit aprovado.
- [x] Página principal responde `200` com cabeçalhos de segurança.
- [x] API protegida responde `401` sem token.
- [x] Build e logs não apresentam erro crítico.
- [x] Login, perfis, unidade, financeiro, importações e relatórios estão validados pelos testes automatizados da release candidata.

## Resultado

Publicação concluída em 12/09/2026. A auditoria final do Firestore encontrou 118 documentos válidos e nenhum documento pendente de unidade. Os quatro perfis existentes estão padronizados pelo UID do Firebase Auth.
