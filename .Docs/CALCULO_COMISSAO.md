# Cálculo de Comissão

## Fluxo de dados

Cada unidade possui um documento próprio em `commissionConfigs/{unitId}`. O documento contém `unitId`, versão do esquema, auditoria e as faixas. Cada faixa também repete `unitId`, funcionando como chave estrangeira para `systemUnits/{unitId}`.

O faturamento-base é `monthlyBarberStats.faturamentoTotal`, incluindo todo o faturamento atribuído ao profissional. A faixa é localizada por limites inclusivos e a comissão é calculada por `faturamento total × percentual / 100`.

O botão **Salvar faixas** persiste a configuração da unidade. O botão **Transferir cálculo para Pagamentos** grava, em um único lote atômico, `payments/{id}.commissionAvulso` para todos os barbeiros calculados da unidade e do período selecionado. Produtos, assinaturas, descontos e status existentes são preservados. Pagamentos já marcados como pagos não são alterados.

## Validações

- unidade obrigatória e controle de acesso por perfil/unidade;
- mínimo e máximo monetários não negativos;
- mínimo estritamente menor que o máximo;
- percentual maior que zero e até 100, com no máximo duas casas decimais;
- ausência de sobreposição entre faixas da mesma unidade;
- mensagens específicas para conexão, permissão e inconsistência.

## Persistência e migração

Migração `001_commission_configs`: coleção `commissionConfigs`, documento identificado pelo `unitId`, `schemaVersion: 1`. O Firestore é schemaless, portanto não há alteração destrutiva em coleções existentes. A primeira gravação de cada unidade cria seu documento.

## Testes

Execute `npm run test:commission`. A suíte cobre limites inclusivos, aplicação de percentuais, valores fora das faixas, sobreposição, valores inválidos e isolamento entre unidades. Execute também `npm run build` antes da publicação.
