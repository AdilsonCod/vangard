# Migração dos perfis para Firebase UID

Este procedimento implementa a padronização de identidade definida no [PRD](./prd.md). Cada perfil passa a residir em `users/{uid}`, usando o mesmo UID da conta no Firebase Authentication.

## Pré-requisitos

- backup verificado da coleção `users`;
- credencial administrativa somente no ambiente local, por `GOOGLE_APPLICATION_CREDENTIALS` ou `FIREBASE_SERVICE_ACCOUNT_JSON`;
- contas correspondentes já existentes no Firebase Authentication;
- execução inicial obrigatória em modo de simulação.

## Execução

```powershell
npm run auth:migrate:dry
npm run auth:migrate:apply
npm run auth:migrate:dry
```

A simulação lista perfis já padronizados, perfis aptos e perfis sem correspondência. A aplicação copia cada perfil para o documento identificado pelo UID e remove o documento legado na mesma transação. O ID anterior permanece no campo `legacyId` para rastreabilidade.

Perfis sem conta correspondente, sem e-mail ou com conflito são relatados e preservados. A segunda simulação deve indicar zero perfis pendentes, exceto os não resolvidos já reportados.

Nenhuma credencial administrativa deve ser incluída no Git, em capturas ou em relatórios de execução.
