# Migração de documentos legados para `unitId`

Este procedimento atende à normalização de escopo definida no [PRD](./prd.md) e à Tarefa 14 do [plano progressivo](./tasks.md). Ele não altera documentos sem evidência explícita da unidade.

## Evidências aceitas

- `unitId` já existente: documento preservado;
- campos legados `unit`, `unidade`, `targetUnitId` ou `selectedUnitId`;
- vínculo exato de `userId`, `barberId`, `ownerId` ou `createdById` com um perfil em `users`;
- ID de `targets` vinculado exatamente ao usuário;
- ID de `commissionConfigs` igual a uma unidade cadastrada;
- vínculo exato de clique com `smart_links`, tráfego com campanha e métrica orgânica com conteúdo;
- objeto `units` contendo exatamente uma unidade.

Conflitos, ausência de evidência e documentos que agregam várias unidades são mantidos sem alteração e aparecem em `unresolved` no relatório.

## Pré-requisitos

- backup verificado do Firestore;
- `FIREBASE_SERVICE_ACCOUNT_JSON` ou `GOOGLE_APPLICATION_CREDENTIALS` disponível somente no ambiente seguro;
- execução inicial obrigatória em simulação;
- revisão humana dos casos não resolvidos antes da aplicação.

## Execução

```powershell
npm run unit-ids:migrate:dry -- --report=unit-id-migration-report-dry.json
npm run unit-ids:migrate:apply -- --report=unit-id-migration-report-apply.json
npm run unit-ids:migrate:dry -- --report=unit-id-migration-report-validation.json
```

Após a aplicação, a última simulação deve indicar `resolved: 0`. Documentos em `unresolved` permanecem intactos para tratamento manual. Repetir a aplicação não altera registros que já possuam `unitId`.

Cada alteração grava também `unitIdMigrationSource` e `unitIdMigratedAt`, mantendo a origem da decisão auditável. Os relatórios são ignorados pelo Git e não devem conter credenciais.
