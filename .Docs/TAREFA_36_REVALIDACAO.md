# Tarefa 36 — Revalidação do isolamento de demonstrações

Data: 12/09/2026. Escopo: tarefa 36 do [backlog](./tasks.md), com referência às seções 8.1, 8.2 e 9 do [PRD](./prd.md).

## Correções

- Análises de profissionais passam a usar a mesma restrição por ambiente/perfil das unidades.
- As duas análises mantêm exemplos e suas edições apenas no estado local da tela. Não usam gravação ou exclusão das coleções reais para gerar/limpar exemplos. Um aviso identifica a demonstração e permite voltar aos dados persistidos.
- Conciliações bancária e financeira exigem sair/limpar a demonstração antes de importar arquivos, inclusive inválidos. A importação deixa de desativar o bloqueio enquanto dados fictícios continuam carregados.
- Efetivação por lote, seleção e dia, processamento compartilhado e sincronização de pendências recusam sessões demonstrativas, assim como salvar e efetivar tudo.
- Marketing restringe o preenchimento de exemplos e identifica o diagnóstico fictício, com limpeza dos campos e resultado.
- Analytics dos links exclui cliques marcados como simulados. Os registros continuam armazenados para rastreabilidade.

## Validação

- `npm run build`: typecheck e build completos; permanece o aviso de chunks maiores que 500 kB.
- `npm run lint`: aprovado.
- `npm run test:demo-controls`: 9 testes aprovados, incluindo políticas de desenvolvimento/produção e regressões das rotas de demonstração. Parte dessa suíte verifica o código-fonte; não equivale a um teste de interface em produção.
- `npm run test:financial-workflows`: 9 testes aprovados.
- `npm run test:firestore:rules`: 2 testes de cobertura, 4 de perfil e 13 de coleções aprovados, com execução no Firebase Emulator.
- `npx playwright test e2e/demo-isolation.spec.ts`: 3 testes aprovados em Chromium, nas larguras 390, 768 e 1440 px. Verificam geração identificada, limpeza, ausência de requisições de escrita no Firestore e descarte após recarga, com sessão E2E isolada.

## Limites

Não houve publicação nem alteração de regras do Firestore. Registros demonstrativos legados já persistidos não foram apagados ou reclassificados: dados sem identificação confiável exigem revisão própria. O teste de navegador cobre a análise de unidades; os demais caminhos são cobertos pela inspeção e pelos testes de regressão de código. A modificação preexistente em `scripts/dev-all.ts` fica fora deste commit.
