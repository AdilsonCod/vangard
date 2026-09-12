# Tarefa 28 — Auditoria final de segurança

Este relatório documenta a auditoria exigida pelo [`prd.md`](./prd.md) e pela Tarefa 28 de [`tasks.md`](./tasks.md).

## Escopo revisado

- regras do Firestore e negação padrão de coleções desconhecidas;
- autenticação e autorização das APIs de IA, mensagens e links inteligentes;
- isolamento entre unidades e perfis;
- arquivos versionados, variáveis locais e bundles de produção;
- cabeçalhos HTTP do servidor principal, serviço persistente e Vercel;
- dependências de produção por meio de `npm audit --omit=dev`.

## Correções aplicadas

1. As regras do Firestore agora derivam a função exclusivamente do perfil ativo armazenado em `users`. Uma claim isolada ou um perfil inativo não concede acesso.
2. A verificação de tokens no backend passa a exigir um perfil existente e ativo e não usa a função presente no token como fallback.
3. O serviço persistente de mensagens recebeu `nosniff`, proteção contra frames, política de referência e restrição de recursos do navegador.
4. A configuração da Vercel recebeu os mesmos cabeçalhos e HSTS para conexões HTTPS.
5. A suíte automatizada passou a procurar credenciais privadas nos arquivos versionados e no bundle compilado.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Auditoria automatizada | 4/4 aprovada |
| Autorização das APIs | 5/5 aprovada |
| Regras de coleções e isolamento | 11/11 aprovada |
| Matriz de permissões | 3/3 aprovada |
| Perfil próprio no Firestore | 4/4 aprovada |
| Segurança de links | 2/2 aprovada |
| Políticas de mensagens | 4/4 aprovada |
| TypeScript | aprovado |
| Build de produção | aprovado |

O `npm audit --omit=dev` encontrou **0 vulnerabilidades altas e 0 críticas**. Permanecem oito ocorrências moderadas transitivas na cadeia do `firebase-admin`; a correção indicada exige atualização principal para a versão 14.4.0 e deve ser validada separadamente para evitar incompatibilidade antes da release.

## Segredos

O arquivo `.env` continua ignorado pelo Git. Nenhuma chave DeepSeek, chave privada de conta de serviço ou variável pública com nome de segredo foi encontrada nos arquivos versionados ou nos artefatos de `dist`. A chave web do Firebase presente na configuração do cliente é um identificador público e sua proteção depende das regras do Firestore, restrições de domínio e quotas do projeto.

## Comandos reproduzíveis

```text
npm run test:security-audit
npm run test:api-authorization
npm run test:firestore:user-profile
npm run test:firestore:collections
npm run test:permissions-matrix
npm run test:smart-link-security
npm run test:message-auth-store
npm run test:message-dispatch-policy
npm run typecheck
npm run build
```
