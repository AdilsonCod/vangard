# Tarefa 26 — Testes de integração financeira

Esta suíte valida os fluxos definidos na Tarefa 26 de [`tasks.md`](./tasks.md) e as regras financeiras descritas no PRD.

## Suíte reproduzível

Comando:

```bash
npm run test:financial-workflows
```

O teste usa um repositório isolado em memória com transações por cópia, commit e rollback. Assim, nenhum dado real do Firebase é alterado e falhas de persistência podem ser reproduzidas de forma determinística.

## Cenários aprovados

| Fluxo | Sucesso | Validação | Falha de persistência |
|---|---:|---:|---:|
| Importação e substituição sem duplicação | Sim | Sim | Sim |
| Conciliação e previsão de recebimento | Sim | Sim | Sim |
| Baixa de recebimentos | Sim | Sim | Sim |
| Baixa de despesas | Sim | Sim | Sim |
| Fechamento de caixa | Sim | Sim | Sim |
| Pagamentos e descontos | Sim | Sim | Sim |
| Cortesias | Sim | Sim | Sim |
| Vendas internas | Sim | Sim | Sim |

Também foi validada a reconstrução do estado após recarga, logout/login e uma nova instância de sessão/dispositivo a partir do armazenamento persistido.

## Resultado

- 9 testes de integração aprovados.
- TypeScript aprovado.
- Build completo de produção aprovado.
- Nenhuma gravação externa realizada durante os testes.
