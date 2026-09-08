# 001 — commissionConfigs

Migração não destrutiva, aplicada sob demanda pela tela Cálculo de Comissão.

- Coleção: `commissionConfigs`
- Chave do documento: `unitId`
- Versão: `schemaVersion = 1`
- Referência: `unitId -> systemUnits/{unitId}`
- Compatibilidade: não altera dados anteriores; rollback consiste em remover apenas os documentos desta coleção.
