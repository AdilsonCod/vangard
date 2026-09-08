# Relatório de testes — Cálculo de Comissão

Data: 07/09/2026

## Resultado automatizado

Comando: `npm run test:commission`

| Cenário | Resultado |
|---|---|
| Limite mínimo da primeira faixa | Aprovado |
| Limite máximo de uma faixa | Aprovado |
| Entrada exata na faixa seguinte | Aprovado |
| Faturamento fora das faixas | Aprovado |
| Sobreposição parcial | Aprovado |
| Limites coincidentes entre faixas | Aprovado |
| Percentual com mais de duas casas | Aprovado |
| Mínimo igual ao máximo | Aprovado |
| Valor negativo | Aprovado |
| Isolamento de unidade para perfil vinculado | Aprovado |
| Acesso gerencial a múltiplas unidades | Aprovado |

Resultado: 4 testes, 4 aprovados, 0 falhas. Os testes agrupam as asserções relacionadas por domínio.

## Verificação de integração

- Persistência: listener em tempo real de `commissionConfigs/{unitId}`, restaurando a configuração após recarga e nova sessão.
- Atomicidade: `writeBatch` único para configuração e pagamentos; uma falha cancela todo o lote.
- Pagamentos: atualização exclusiva de `commissionAvulso`, preservando produtos, assinaturas, descontos e estado.
- Segurança operacional: registros pagos são imutáveis pelo cálculo automático.
- Build de produção: aprovado com TypeScript sem erros.

Testes físicos em navegadores/dispositivos devem ser repetidos no ambiente homologado antes da publicação, pois dependem das credenciais, regras e conectividade do projeto Firebase de destino.
