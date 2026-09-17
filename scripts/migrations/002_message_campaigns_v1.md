# Migração 002 — Campanhas de mensagens v1

Cria o modelo persistente definido no [PRD de campanhas](../../.docs/PRD_DISPARO_MENSAGENS.md) sem remover ou alterar `message_dispatch_history`.

## Simulação

```powershell
npm run messages:migrate:v1:dry
```

## Aplicação

Faça backup, revise `message-campaign-migration-v1-report.json` e execute:

```powershell
npm run messages:migrate:v1:apply
```

A migração usa IDs determinísticos derivados dos documentos históricos. Uma nova simulação após aplicação deve indicar todos os registros como `alreadyMigrated`. Campanhas sem contatos históricos preservam os totais, mas não inventam destinatários.

