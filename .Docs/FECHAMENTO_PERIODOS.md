# Fechamento e reabertura de períodos

Este fluxo implementa os requisitos de integridade financeira e auditoria definidos no [PRD](./prd.md), especialmente nas seções 8.5, 9 e 10.

## Comportamento

- Um fechamento `CLOSED` ou `DIVERGENT` bloqueia alterações financeiras da unidade e data correspondentes.
- Como importações e consolidados mensais podem recompor todo o mês, qualquer fechamento diário ativo também bloqueia a gravação dos indicadores daquele mês.
- Inclusão, edição e exclusão de transações, pagamentos, produção diária e estatísticas importadas passam pela verificação central do `store`.
- As regras do Firestore consultam `financialPeriodLocks` para impedir gravações diretas em transações, pagamentos e consolidados protegidos.
- A reabertura é restrita aos perfis `ADMIN` e `FINANCIAL` e exige justificativa com pelo menos dez caracteres.

## Persistência e auditoria

Fechamento e reabertura são gravados por lote atômico em:

- `cashClosings`: estado atual e valores conferidos;
- `financialPeriodLocks`: travas por dia e mês;
- `financialPeriodEvents`: histórico imutável, com autor, função, unidade, data, justificativa e fotografia do fechamento.

O snapshot armazenado no evento preserva a reprodução do fechamento mesmo depois de reabertura, logout ou nova sessão. A interface de gestão financeira apresenta o estado atual e o botão de reabertura somente aos perfis autorizados.
