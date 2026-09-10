# Matriz de permissões

Este documento transforma os perfis e limites definidos no [PRD](./prd.md) em uma matriz operacional. O PRD continua sendo a fonte de verdade para as regras de negócio; esta matriz define quem pode executar cada ação e qual deve ser o escopo aplicado na interface, nas APIs e no Firestore.

## 1. Convenções

| Código | Ação |
|---|---|
| `R` | Ler ou listar |
| `C` | Criar |
| `U` | Editar |
| `D` | Excluir ou inativar |
| `E` | Efetivar, aprovar, fechar, reabrir, pagar ou disparar |
| `A` | Administrar configuração, permissão ou visibilidade |
| `—` | Acesso negado |

Escopos usados nas tabelas:

- `GLOBAL`: todas as unidades e configurações globais;
- `AUTORIZADAS`: somente as unidades explicitamente associadas ao usuário;
- `PRÓPRIA UNIDADE`: somente a unidade obrigatória do cadastro;
- `PRÓPRIO`: somente registros pessoais do profissional autenticado;
- `DESTINADO`: conteúdo cujo perfil e unidade incluem o usuário autenticado.

Uma capacidade sem o escopo correspondente deve ser negada. “Todas as unidades” é uma consulta consolidada e não autoriza gravar registros sem `unitId`.

## 2. Perfis canônicos

| Perfil de produto | Responsabilidade | Escopo máximo |
|---|---|---|
| Administrador | Identidade, unidades, permissões, configurações, auditoria e operação integral | `GLOBAL` |
| Gerência | Gestão operacional e financeira das unidades delegadas | `AUTORIZADAS` |
| Financeiro | Execução dos processos financeiros delegados | `AUTORIZADAS` |
| Marketing | Planejamento, produção, tráfego, conteúdo e ferramentas de campanha | `AUTORIZADAS` |
| Recepção | Rotina operacional permitida da unidade de cadastro | `PRÓPRIA UNIDADE` |
| Barbeiro/profissional | Produção, metas e informações pessoais | `PRÓPRIO` e `DESTINADO` |

O código atual usa `ADMIN` também com o rótulo “Gerente”. Isso não representa a separação normativa acima: a implementação de autorização deve distinguir Administrador de Gerência antes de conceder poderes globais. `BARBER` e `MANICURE` seguem o mesmo conjunto-base de profissional, salvo regra funcional expressa.

## 3. Administração, cadastros e configurações

| Módulo/ação | Administrador | Gerência | Financeiro | Marketing | Recepção | Profissional |
|---|---|---|---|---|---|---|
| Perfil pessoal: ler | `R GLOBAL` | `R PRÓPRIO` | `R PRÓPRIO` | `R PRÓPRIO` | `R PRÓPRIO` | `R PRÓPRIO` |
| Perfil pessoal: editar nome/notas/tema | `U PRÓPRIO` | `U PRÓPRIO` | `U PRÓPRIO` | `U PRÓPRIO` | `U PRÓPRIO` | `U PRÓPRIO` |
| Usuários: criar, editar, inativar | `C/U/D GLOBAL` | `C/U/D AUTORIZADAS`, sem perfis privilegiados | — | — | — | — |
| Função, unidade, status e permissões | `A GLOBAL` | — | — | — | — | — |
| Unidades | `C/R/U/D GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | `R AUTORIZADAS` | `R PRÓPRIA UNIDADE` | `R PRÓPRIA UNIDADE` |
| Catálogo e categorias | `C/R/U/D GLOBAL` | `C/R/U AUTORIZADAS` | `R AUTORIZADAS` | `R AUTORIZADAS` | `R PRÓPRIA UNIDADE` | `R PRÓPRIA UNIDADE` |
| Fornecedores e classificações financeiras | `C/R/U/D GLOBAL` | `C/R/U AUTORIZADAS` | `C/R/U AUTORIZADAS` | — | `R PRÓPRIA UNIDADE` quando necessário ao lançamento | — |
| Configuração global do sistema | `R/U/A GLOBAL` | — | — | — | — | — |
| Preferências visuais pessoais | `R/U PRÓPRIO` | `R/U PRÓPRIO` | `R/U PRÓPRIO` | `R/U PRÓPRIO` | `R/U PRÓPRIO` | `R/U PRÓPRIO` |
| Visibilidade do ranking trimestral | `R/U/A GLOBAL` | `R/U/A AUTORIZADAS` | — | — | — | `R DESTINADO` |

Nenhum usuário pode alterar a própria função, unidade, status, UID ou permissões por meio da edição do perfil pessoal.

## 4. Operação financeira

| Módulo/ação | Administrador | Gerência | Financeiro | Marketing | Recepção | Profissional |
|---|---|---|---|---|---|---|
| Visão geral financeira | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | somente indicadores expressamente autorizados | resumo operacional da `PRÓPRIA UNIDADE` | resumo `PRÓPRIO` |
| Caixa e contas: consultar | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | — | fechamento da `PRÓPRIA UNIDADE` | — |
| Caixa: lançamentos comuns | `C/U/D GLOBAL` | `C/U/D AUTORIZADAS` | `C/U/D AUTORIZADAS` | — | — | — |
| Caixa: lançamentos rápidos autorizados | `C GLOBAL` | `C AUTORIZADAS` | `C AUTORIZADAS` | — | `C PRÓPRIA UNIDADE` | — |
| Fechar caixa | `E GLOBAL` | `E AUTORIZADAS` | `E AUTORIZADAS` | — | `E PRÓPRIA UNIDADE` | — |
| Reabrir período ou caixa | `E/A GLOBAL` | `E AUTORIZADAS`, com justificativa | — | — | — | — |
| Conciliação: carregar, executar e salvar | `C/R/U GLOBAL` | `C/R/U AUTORIZADAS` | `C/R/U AUTORIZADAS` | — | — | — |
| Conciliação: efetivar | `E GLOBAL` | `E AUTORIZADAS` | `E AUTORIZADAS` | — | — | — |
| Baixa de recebimentos e despesas | `R/U/E GLOBAL` | `R/U/E AUTORIZADAS` | `R/U/E AUTORIZADAS` | — | — | — |
| Pagamentos: consultar | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | — | — | `R PRÓPRIO` |
| Pagamentos: criar, editar e pagar | `C/U/D/E GLOBAL` | `C/U/E AUTORIZADAS` | `C/U/E AUTORIZADAS` | — | — | — |
| Faixas e cálculo de comissão | `C/R/U/D/E GLOBAL` | `C/R/U/D/E AUTORIZADAS` | `C/R/U/E AUTORIZADAS` | — | — | `R PRÓPRIO` somente resultado |
| Cortesias | `C/R/U/D GLOBAL` | `C/R/U/D AUTORIZADAS` | `C/R/U/D AUTORIZADAS` | — | `C/R/U PRÓPRIA UNIDADE` | `R PRÓPRIO` quando aplicável |
| Vendas internas | `C/R/U/D GLOBAL` | `C/R/U/D AUTORIZADAS` | `C/R/U/E AUTORIZADAS` | — | `C/R/U PRÓPRIA UNIDADE` | `R PRÓPRIO` |
| Auditoria financeira | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | — | — | — |

Excluir nas tabelas acima significa exclusão funcional quando o PRD exige histórico. Fechamento, reabertura, efetivação, baixa, pagamento, transferência de comissão e estorno devem produzir auditoria.

## 5. Importações, análises e relatórios

| Módulo/ação | Administrador | Gerência | Financeiro | Marketing | Recepção | Profissional |
|---|---|---|---|---|---|---|
| Importações: pré-visualizar e validar | `R/C GLOBAL` | `R/C AUTORIZADAS` | `R/C AUTORIZADAS` | — | — | — |
| Importações: salvar ou substituir | `C/U/E GLOBAL` | `C/U/E AUTORIZADAS` | `C/U/E AUTORIZADAS` | — | — | — |
| Histórico de importações | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | — | — | — |
| Análise de unidades e SVA | `R/U GLOBAL` | `R/U AUTORIZADAS` | `R AUTORIZADAS` | indicadores autorizados | — | — |
| Análise de profissionais | `R/U GLOBAL` | `R/U AUTORIZADAS` | `R AUTORIZADAS` | — | — | `R PRÓPRIO` |
| Metas da equipe | `C/R/U/D GLOBAL` | `C/R/U AUTORIZADAS` | `R AUTORIZADAS` | — | — | `R/U PRÓPRIO` nos campos permitidos |
| Relatório de faturamento | `R/E GLOBAL` | `R/E AUTORIZADAS` | `R/E AUTORIZADAS` | — | — | — |
| Relatórios profissionais | `R GLOBAL` | `R AUTORIZADAS` | `R AUTORIZADAS` | — | — | `R/E PRÓPRIO` |
| Rankings | `R GLOBAL` | `R AUTORIZADAS` | — | — | — | `R DESTINADO` |

`E` em relatórios representa exportação. Substituir uma importação exige confirmação explícita, período aberto e registro de auditoria.

## 6. Comunicação e marketing

| Módulo/ação | Administrador | Gerência | Financeiro | Marketing | Recepção | Profissional |
|---|---|---|---|---|---|---|
| Mural: ler, confirmar leitura e comentar | `R/U GLOBAL` | `R/U DESTINADO` | `R/U DESTINADO` | `R/U DESTINADO` | `R/U DESTINADO` | `R/U DESTINADO` |
| Mural: publicar e editar | `C/U/D GLOBAL` | `C/U/D AUTORIZADAS` | — | `C/U AUTORIZADAS` quando autorizado | `C/U PRÓPRIA UNIDADE` quando autorizado | — |
| Disparo: listas e campanhas | `C/R/U/D/E GLOBAL` | `C/R/U/D/E AUTORIZADAS` | — | `C/R/U/D/E AUTORIZADAS` | `C/R/U/E PRÓPRIA UNIDADE` quando autorizado | — |
| Conexão do WhatsApp | `R/U/E GLOBAL` | `R/U/E AUTORIZADAS` | — | `R/U/E AUTORIZADAS` quando autorizado | `R/E PRÓPRIA UNIDADE` quando autorizado | — |
| Links inteligentes: consultar | `R GLOBAL` | `R AUTORIZADAS` | — | `R AUTORIZADAS` | `R PRÓPRIA UNIDADE` | — |
| Links: criar, editar, excluir, simular | `C/U/D/E GLOBAL` | `C/U/D/E AUTORIZADAS` | — | `C/U/D/E AUTORIZADAS` | `C/U/E PRÓPRIA UNIDADE` quando autorizado | — |
| Marketing: planejamento e produção | `C/R/U/D/E GLOBAL` | `R/E AUTORIZADAS` | — | `C/R/U/D/E AUTORIZADAS` | — | — |
| Marketing: tráfego, biblioteca e métricas | `C/R/U/D/E GLOBAL` | `R AUTORIZADAS` | — | `C/R/U/D/E AUTORIZADAS` | — | — |
| Marketing: recursos de IA | `E GLOBAL` | `E AUTORIZADAS` quando autorizado | — | `E AUTORIZADAS` | — | — |

Publicações do mural devem ser filtradas simultaneamente por unidade e perfil destinatário. Comentários, confirmações de leitura, campanhas e gestão de links devem registrar o UID do autor autenticado.

## 7. Aplicação obrigatória das permissões

Cada operação protegida deve passar por três camadas independentes:

1. **Interface:** exibe somente navegação e controles permitidos, melhorando a usabilidade.
2. **Servidor/API:** valida o Firebase ID Token, obtém o perfil de fonte confiável e autoriza função, ação e unidade.
3. **Firestore:** aplica a mesma restrição nos documentos e nega por padrão qualquer operação não declarada.

Ocultar menu, botão, aba, campo ou rota no React **não é autorização**. Uma chamada manual deve continuar recebendo `401` sem autenticação e `403` ou negação das regras quando autenticada sem permissão.

## 8. Regras de múltiplas unidades

- O perfil deve armazenar a lista explícita de unidades autorizadas; a unidade selecionada na tela nunca amplia essa lista.
- Administrador pode usar `GLOBAL` e visão consolidada.
- Gerência, Financeiro e Marketing só usam “Todas as unidades” quando essa opção representar todas as unidades presentes em sua autorização, nunca toda a rede implicitamente.
- Recepção possui exatamente uma unidade operacional e não pode selecionar `ALL`.
- Profissional recebe somente documentos próprios e conteúdos destinados ao seu perfil/unidade.
- Leituras devem ser filtradas na consulta; baixar dados de outras unidades e filtrá-los apenas no navegador é proibido.
- Criações e alterações devem validar o `unitId` do documento novo e, em atualizações, também o `unitId` anterior.
- Registros globais precisam de classificação explícita e não podem ser criados pela simples ausência de `unitId`.

## 9. Lacunas atuais a corrigir nas próximas tarefas

- `ADMIN` ainda representa simultaneamente Administrador e Gerência.
- As regras atuais permitem que um usuário altere campos privilegiados do próprio perfil.
- Existem coleções sem regras explícitas e leituras amplas de coleções inteiras.
- As APIs ainda não aplicam a matriz de função e unidade de forma centralizada.

Essas lacunas não alteram a permissão normativa deste documento; elas indicam implementações que devem ser endurecidas nas tarefas seguintes do [plano progressivo](./tasks.md).
