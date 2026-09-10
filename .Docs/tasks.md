# Plano progressivo de implementação

Este backlog decompõe em entregas pequenas os requisitos definidos no [PRD](./prd.md). O PRD é a fonte de verdade para regras de negócio, perfis, fluxos e terminologia; este documento registra apenas a sequência de execução e os critérios objetivos de aprovação.

## Regras de execução

- As tarefas devem ser executadas na ordem apresentada, uma por vez.
- Cada agente deve trabalhar somente no escopo da tarefa selecionada e preservar alterações não relacionadas.
- Uma tarefa só pode ser marcada como concluída depois de atender a todos os seus critérios de aprovação.
- Cada tarefa deve resultar em um commit próprio, com mensagem que identifique o número da tarefa.
- Mudanças de segurança devem ser validadas no Firebase Emulator antes da publicação.
- Nenhuma credencial, senha ou segredo pode ser incluído no Git, no bundle do frontend ou nos relatórios de teste.

## Fase 0 — Baseline e documentação

### Tarefa 1 — Consolidar o PRD normativo

- [x] Criar ou revisar `.docs/prd.md`, consolidando os requisitos funcionais e não funcionais referidos no parecer, sem transformar detalhes de implementação em regra de negócio.

**Critérios de aprovação**

- O link [PRD](./prd.md) abre corretamente no repositório.
- O PRD define perfis, unidades, dados financeiros, autenticação, permissões, importações, conciliações, pagamentos, mensagens e links inteligentes.
- Termos como faturamento, movimentação de caixa, repasse, transferência, desconto, cortesia, venda interna, estorno e período fechado possuem uma definição única.
- Não existem senhas, tokens ou credenciais reais no documento.

### Tarefa 2 — Registrar o baseline técnico

- [x] Documentar versões, scripts de validação, variáveis de ambiente e arquitetura atual em `.docs/ARQUITETURA.md`, referenciando o PRD para as regras de negócio.

**Critérios de aprovação**

- O documento identifica frontend, servidor, Firebase, Vercel e serviço persistente de mensagens.
- Estão documentados os comandos de typecheck, lint, build e testes.
- As variáveis são descritas somente pelo nome e finalidade, sem valores secretos.
- `npm run typecheck`, `npm run lint` e `npm run build` terminam com código zero.

## Fase 1 — Identidade e autenticação

### Tarefa 3 — Remover senhas dos modelos e formulários

- [x] Eliminar o campo `password` dos tipos, dados iniciais, formulários administrativos e gravações no Firestore.

**Critérios de aprovação**

- A busca por `password`, `admin123` e outras senhas legadas não encontra armazenamento ou comparação de senha no código da aplicação.
- Cadastro e edição de usuário não gravam senha em documentos Firestore.
- Autenticação continua funcionando exclusivamente pelo Firebase Authentication.
- Typecheck, lint e build são aprovados.

### Tarefa 4 — Padronizar usuários pelo Firebase UID

- [x] Fazer com que cada perfil seja persistido em `users/{uid}` e preparar uma migração idempotente para os usuários existentes.

**Critérios de aprovação**

- O ID do documento de perfil corresponde ao `uid` do Firebase Authentication.
- A migração possui modo de simulação e modo de aplicação.
- Executar a migração duas vezes não duplica nem corrompe usuários.
- Usuários sem correspondência são relatados sem serem removidos automaticamente.

### Tarefa 5 — Tornar a sessão dependente apenas do Firebase Auth

- [x] Remover a restauração de identidade baseada somente no ID salvo em `localStorage` e derivar a sessão do estado autenticado do Firebase.

**Critérios de aprovação**

- Alterar manualmente valores no `localStorage` não troca o usuário autenticado.
- Recarregar a página mantém uma sessão Firebase válida.
- Logout invalida a sessão visual e o acesso aos dados protegidos.
- Usuário não autenticado é encaminhado ao login e não inicia listeners privados.

### Tarefa 6 — Adicionar testes do fluxo de autenticação

- [x] Cobrir login, sessão, logout, credenciais inválidas e tentativa de falsificação de identidade.

**Critérios de aprovação**

- Os testes verificam sucesso e falha do login.
- Existe teste comprovando que adulterar o armazenamento do navegador não altera o perfil.
- Existe teste de logout seguido de tentativa de acesso protegido.
- A suíte executa por um comando documentado e termina sem falhas.

## Fase 2 — Autorização e isolamento

### Tarefa 7 — Definir a matriz de permissões

- [x] Registrar em `.docs/PERMISSOES.md` as permissões de administrador, gerência, financeiro, marketing, recepção e barbeiro, vinculadas aos requisitos do PRD.

**Critérios de aprovação**

- Cada módulo e ação de leitura, criação, edição, exclusão e efetivação possui perfis autorizados.
- A recepção fica limitada à própria unidade nos módulos definidos pelo PRD.
- A matriz diferencia ocultar uma opção da interface de impedir uma operação no backend/banco.
- Casos de acesso a múltiplas unidades estão explicitamente cobertos.

### Tarefa 8 — Restringir o documento do próprio usuário

- [x] Alterar as regras do Firestore para impedir que um usuário modifique função, unidade, status ou permissões do próprio perfil.

**Critérios de aprovação**

- Usuário comum pode editar somente os campos pessoais permitidos na matriz.
- Tentativas de alterar `role`, `unitId`, permissões ou status são negadas.
- Administrador autorizado consegue administrar esses campos.
- Testes no Emulator comprovam os três cenários.

### Tarefa 9 — Cobrir todas as coleções nas regras do Firestore

- [ ] Criar regras explícitas para todas as coleções utilizadas pela aplicação, eliminando permissões genéricas e lacunas.

**Critérios de aprovação**

- Configurações de comissão, importações, conciliações, relatórios, marketing, mensagens, auditoria e links inteligentes possuem regras explícitas.
- Não existe regra global permitindo leitura ou escrita irrestrita.
- Operações não previstas são negadas por padrão.
- Testes do Emulator cobrem ao menos um acesso permitido e um negado por coleção sensível.

### Tarefa 10 — Aplicar autorização por função nas APIs

- [ ] Criar middlewares de autorização e aplicá-los às APIs de IA, mensagens, links e demais operações administrativas.

**Critérios de aprovação**

- Token válido sem função autorizada recebe HTTP 403.
- Token ausente ou inválido recebe HTTP 401.
- Perfil autorizado conclui a operação.
- A função é obtida de fonte confiável e não de valores enviados no corpo da requisição.

### Tarefa 11 — Enviar Firebase ID Token pelo frontend

- [ ] Centralizar as chamadas autenticadas em um cliente HTTP que envie `Authorization: Bearer <ID token>`.

**Critérios de aprovação**

- Marketing, geração de conteúdo, disparo de mensagens e simulação de links usam o cliente autenticado.
- A antiga chave operacional no navegador deixa de ser necessária.
- Token expirado é renovado ou provoca retorno controlado ao login.
- As chamadas protegidas funcionam no ambiente local e retornam erros em português quando negadas.

### Tarefa 12 — Migrar o servidor para Firebase Admin SDK

- [ ] Substituir o SDK cliente e a verificação manual de token no servidor pelo Firebase Admin SDK.

**Critérios de aprovação**

- O servidor valida tokens pelo Admin SDK.
- Gravações administrativas e de auditoria não dependem de sessão do navegador.
- Credenciais são fornecidas apenas por variáveis seguras do ambiente.
- O bundle do frontend não contém credenciais administrativas.

### Tarefa 13 — Completar o isolamento por unidade nas consultas

- [ ] Aplicar filtros de unidade e usuário a todas as consultas privadas, conforme a matriz de permissões.

**Critérios de aprovação**

- Recepção e barbeiro não recebem no navegador documentos de outras unidades ou usuários.
- Administradores com múltiplas unidades conseguem selecionar o escopo permitido.
- Consultas são compatíveis com as regras e índices do Firestore.
- Teste de integração comprova que dados da Unidade A não são acessíveis pela Unidade B.

### Tarefa 14 — Migrar documentos legados para `unitId`

- [ ] Criar migração idempotente para preencher `unitId` nos documentos privados antigos que ainda não possuem essa informação.

**Critérios de aprovação**

- A migração possui simulação, aplicação e relatório de documentos não resolvidos.
- Nenhum documento é associado a uma unidade por suposição silenciosa.
- Após a migração, as consultas filtradas continuam exibindo os dados esperados.
- Repetir a execução não altera documentos já corrigidos.

## Fase 3 — Integridade financeira

### Tarefa 15 — Formalizar e testar as fórmulas financeiras centrais

- [ ] Consolidar em serviços puros as fórmulas definidas no PRD, incluindo faturamento total, caixa, comissões, taxas, descontos e repasses.

**Critérios de aprovação**

- Faturamento total é calculado como avulso + assinaturas + produtos.
- Cada conceito financeiro do PRD possui uma função única e testável.
- Casos de valor zero, estorno, substituição de importação e limites de comissão estão cobertos.
- Nenhuma tela mantém fórmula divergente para o mesmo indicador.

### Tarefa 16 — Integrar o motor financeiro em todas as telas

- [ ] Substituir cálculos duplicados em visão geral, financeiro, relatórios, análises, conciliação e pagamentos pelo serviço central.

**Critérios de aprovação**

- O mesmo conjunto de dados produz os mesmos totais em todas as telas.
- Alterar uma fórmula central reflete nos consumidores sem duplicação de lógica.
- Os testes de regressão usam um cenário financeiro completo e comparam todos os módulos.
- Typecheck, lint e build permanecem aprovados.

### Tarefa 17 — Implementar bloqueio e reabertura de períodos

- [ ] Impedir alterações financeiras em períodos fechados e criar reabertura formal apenas para perfis autorizados.

**Critérios de aprovação**

- Inclusão, edição, exclusão, importação e efetivação são bloqueadas em período fechado.
- Reabertura exige usuário autorizado e justificativa.
- Fechamento e reabertura geram registros de auditoria.
- Os relatórios fechados permanecem reproduzíveis após logout e novo login.

### Tarefa 18 — Criar trilha de auditoria financeira

- [ ] Registrar operações críticas de caixa, pagamentos, conciliações, importações e comissões.

**Critérios de aprovação**

- Cada evento contém autor, data, unidade, ação, entidade e valores anteriores/novos aplicáveis.
- O histórico é imutável para usuários comuns.
- Excluir ou alterar um lançamento não elimina seu histórico.
- Administrador consegue consultar a auditoria por período, unidade e usuário.

## Fase 4 — Mensagens e links inteligentes

### Tarefa 19 — Preparar serviço persistente para Baileys

- [ ] Separar o serviço de mensagens da execução efêmera da Vercel e documentar sua hospedagem persistente.

**Critérios de aprovação**

- Reiniciar o frontend ou uma função web não encerra a sessão do WhatsApp.
- Credenciais de sessão são persistidas de forma criptografada fora do navegador.
- O frontend se comunica com o serviço por API autenticada e autorizada.
- Falha ou indisponibilidade é apresentada sem bloquear os demais módulos.

### Tarefa 20 — Completar auditoria e proteção do disparo

- [ ] Vincular cada conexão, início, interrupção e resultado de campanha ao usuário autenticado e à unidade.

**Critérios de aprovação**

- Usuários sem permissão não controlam a conexão nem iniciam campanhas.
- Auditoria registra processados, entregues, falhas e motivo de interrupção.
- Limite de contatos, consentimento e intervalos continuam obrigatórios.
- Nenhum segredo operacional é solicitado na interface.

### Tarefa 21 — Endurecer o módulo de links inteligentes

- [ ] Aplicar autorização do servidor às operações de gestão e reforçar as proteções de redirecionamento e cloaking.

**Critérios de aprovação**

- Criar, editar, excluir e simular link exige perfil autorizado.
- A rota pública de redirecionamento expõe somente o comportamento necessário ao visitante.
- URLs internas, protocolos inseguros e redirecionamentos para redes privadas são bloqueados.
- Falhas de cloaking geram tratamento seguro e não expõem cabeçalhos ou dados internos.

## Fase 5 — Manutenção e desempenho

### Tarefa 22 — Remover `dist` do controle de versão

- [ ] Concluir a remoção dos artefatos compilados do Git e deixar a Vercel gerar o build a partir do código-fonte.

**Critérios de aprovação**

- `git ls-files dist` não retorna arquivos.
- `dist/` está ignorado pelo Git.
- Build local recria os artefatos sem adicioná-los ao status do Git.
- Um deploy de teste na Vercel é concluído a partir do commit fonte.

### Tarefa 23 — Dividir os componentes de conciliação e financeiro

- [ ] Extrair regras, tabelas, filtros, modais e formulários dos componentes financeiros maiores, sem alterar comportamento.

**Critérios de aprovação**

- Componentes extraídos possuem responsabilidade única e nomes claros.
- Regras de negócio não permanecem acopladas à renderização quando puderem ser serviços puros.
- Testes e build são aprovados antes e depois da divisão.
- Teste manual confirma conciliação, efetivação, caixa e baixas sem regressão.

### Tarefa 24 — Dividir importador e painel administrativo

- [ ] Separar parsers, validações, persistência, pré-visualização e formulários administrativos em módulos menores.

**Critérios de aprovação**

- Cada formato de importação possui parser/validador testável isoladamente.
- Substituição de dados existentes continua exigindo confirmação.
- Reimportação não duplica registros protegidos por fingerprint.
- Painel administrativo mantém os fluxos e permissões definidos no PRD.

### Tarefa 25 — Paginar e virtualizar listas extensas

- [ ] Implementar paginação ou virtualização nos históricos e tabelas com potencial de crescimento contínuo.

**Critérios de aprovação**

- A primeira renderização não baixa todos os registros históricos.
- Filtros e ordenação continuam corretos entre páginas.
- Rolagem em celular permanece fluida com volume de teste representativo.
- Não há perda de seleção ou edição ao carregar a próxima página.

## Fase 6 — Cobertura e liberação

### Tarefa 26 — Testar fluxos financeiros completos

- [ ] Criar testes de integração para importação, conciliação, fechamento, baixas, pagamentos, cortesias e vendas internas.

**Critérios de aprovação**

- Cada fluxo possui ao menos um cenário de sucesso, validação e falha de persistência.
- Dados permanecem após recarga, logout/login e nova sessão.
- Substituição de uma importação atualiza os totais sem duplicação.
- Todos os testes executam de forma reproduzível em ambiente isolado.

### Tarefa 27 — Testar perfis e responsividade

- [ ] Cobrir os principais fluxos de cada perfil em desktop, tablet e telefone.

**Critérios de aprovação**

- Administrador, gerência, financeiro, marketing, recepção e barbeiro possuem cenários próprios.
- Não existem controles inacessíveis, texto cortado ou rolagem horizontal involuntária nos tamanhos definidos.
- Gráficos e tabelas exibem estado vazio, carregamento, erro e dados reais.
- Capturas ou relatório automatizado documentam os tamanhos validados.

### Tarefa 28 — Executar auditoria final de segurança

- [ ] Revisar regras, APIs, dependências, segredos, cabeçalhos e permissões antes do deploy de produção.

**Critérios de aprovação**

- Não há regras abertas nem possibilidade conhecida de elevação de privilégio.
- Nenhum segredo aparece no Git ou nos bundles gerados.
- Auditoria de dependências não contém vulnerabilidade crítica ou alta sem mitigação documentada.
- Tentativas de acesso entre unidades e perfis são negadas pelos testes.

### Tarefa 29 — Publicar release candidata

- [ ] Gerar uma release candidata em ambiente de homologação e executar o checklist operacional do PRD.

**Critérios de aprovação**

- Commit, versão e ambiente implantado são identificáveis.
- Migrações são executadas primeiro em modo de simulação e possuem backup verificável.
- Smoke tests de todos os perfis e módulos críticos são aprovados.
- Não existem erros críticos no navegador ou no servidor durante a validação.

### Tarefa 30 — Publicar em produção e validar pós-deploy

- [ ] Publicar a versão aprovada e executar validação pós-deploy com plano de reversão disponível.

**Critérios de aprovação**

- A versão em produção corresponde ao commit aprovado.
- Login, permissões, filtros de unidade, financeiro, importações e relatórios passam no smoke test.
- Logs e alertas não apresentam falhas críticas após a publicação.
- O procedimento de reversão foi documentado e pode ser executado sem perda de dados.

## Definição global de concluído

Uma tarefa só pode receber `[x]` quando:

- Todos os critérios específicos estiverem aprovados.
- Typecheck, lint, build e testes relacionados passarem.
- Não houver segredo ou artefato compilado indevido no commit.
- A documentação afetada estiver atualizada por referência ao [PRD](./prd.md).
- O commit da tarefa tiver sido revisado e não incluir mudanças fora do escopo.
