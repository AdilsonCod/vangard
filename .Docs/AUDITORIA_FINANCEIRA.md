# Trilha de auditoria financeira

Implementação correspondente à Tarefa 18 de [`tasks.md`](./tasks.md) e aos requisitos de rastreabilidade do [`prd.md`](./prd.md).

## Fluxo

Operações de lançamentos, pagamentos, fechamento/reabertura de caixa e importação de indicadores gravam o documento principal e um evento em `financialAuditEvents`. Nas operações centrais do `store`, as duas escritas usam o mesmo `writeBatch`, evitando alteração financeira sem o respectivo histórico.

Conciliações e configurações/transferências de comissão também geram eventos próprios. Cada evento contém autor autenticado, nome e perfil, data, unidade, ação, entidade, identificador e snapshots anterior/novo quando aplicáveis.

## Segurança

- Eventos são append-only: `update` e `delete` são negados pelas regras inclusive para administradores.
- A criação exige que `actorAuthUid` e `actorId` correspondam ao UID autenticado.
- Perfis não administrativos não podem consultar a coleção.
- A tela **Auditoria Financeira** é exibida somente no menu da gerência e permite filtrar por período, unidade e usuário.

## Verificação

- `npm run test:financial-audit`: valida autoria, escopo e cópia independente dos snapshots.
- `npm run test:firestore:collections`: contém cenários de inclusão legítima, falsificação de autoria, isolamento por unidade, leitura administrativa e imutabilidade. Requer Java para iniciar o emulador do Firestore.
- `npm run typecheck`, `npm run lint` e `npm run build`: validam a integração com a aplicação.

