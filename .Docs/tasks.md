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

- [x] Criar regras explícitas para todas as coleções utilizadas pela aplicação, eliminando permissões genéricas e lacunas.

**Critérios de aprovação**

- Configurações de comissão, importações, conciliações, relatórios, marketing, mensagens, auditoria e links inteligentes possuem regras explícitas.
- Não existe regra global permitindo leitura ou escrita irrestrita.
- Operações não previstas são negadas por padrão.
- Testes do Emulator cobrem ao menos um acesso permitido e um negado por coleção sensível.

### Tarefa 10 — Aplicar autorização por função nas APIs

- [x] Criar middlewares de autorização e aplicá-los às APIs de IA, mensagens, links e demais operações administrativas.

**Critérios de aprovação**

- Token válido sem função autorizada recebe HTTP 403.
- Token ausente ou inválido recebe HTTP 401.
- Perfil autorizado conclui a operação.
- A função é obtida de fonte confiável e não de valores enviados no corpo da requisição.

### Tarefa 11 — Enviar Firebase ID Token pelo frontend

- [x] Centralizar as chamadas autenticadas em um cliente HTTP que envie `Authorization: Bearer <ID token>`.

**Critérios de aprovação**

- Marketing, geração de conteúdo, disparo de mensagens e simulação de links usam o cliente autenticado.
- A antiga chave operacional no navegador deixa de ser necessária.
- Token expirado é renovado ou provoca retorno controlado ao login.
- As chamadas protegidas funcionam no ambiente local e retornam erros em português quando negadas.

### Tarefa 12 — Migrar o servidor para Firebase Admin SDK

- [x] Substituir o SDK cliente e a verificação manual de token no servidor pelo Firebase Admin SDK.

**Critérios de aprovação**

- O servidor valida tokens pelo Admin SDK.
- Gravações administrativas e de auditoria não dependem de sessão do navegador.
- Credenciais são fornecidas apenas por variáveis seguras do ambiente.
- O bundle do frontend não contém credenciais administrativas.

### Tarefa 13 — Completar o isolamento por unidade nas consultas

- [x] Aplicar filtros de unidade e usuário a todas as consultas privadas, conforme a matriz de permissões.

**Critérios de aprovação**

- Recepção e barbeiro não recebem no navegador documentos de outras unidades ou usuários.
- Administradores com múltiplas unidades conseguem selecionar o escopo permitido.
- Consultas são compatíveis com as regras e índices do Firestore.
- Teste de integração comprova que dados da Unidade A não são acessíveis pela Unidade B.

### Tarefa 14 — Migrar documentos legados para `unitId`

- [x] Criar migração idempotente para preencher `unitId` nos documentos privados antigos que ainda não possuem essa informação.

**Critérios de aprovação**

- A migração possui simulação, aplicação e relatório de documentos não resolvidos.
- Nenhum documento é associado a uma unidade por suposição silenciosa.
- Após a migração, as consultas filtradas continuam exibindo os dados esperados.
- Repetir a execução não altera documentos já corrigidos.

## Fase 3 — Integridade financeira

### Tarefa 15 — Formalizar e testar as fórmulas financeiras centrais

- [x] Consolidar em serviços puros as fórmulas definidas no PRD, incluindo faturamento total, caixa, comissões, taxas, descontos e repasses.

**Critérios de aprovação**

- Faturamento total é calculado como avulso + assinaturas + produtos.
- Cada conceito financeiro do PRD possui uma função única e testável.
- Casos de valor zero, estorno, substituição de importação e limites de comissão estão cobertos.
- Nenhuma tela mantém fórmula divergente para o mesmo indicador.

### Tarefa 16 — Integrar o motor financeiro em todas as telas

- [x] Substituir cálculos duplicados em visão geral, financeiro, relatórios, análises, conciliação e pagamentos pelo serviço central.

**Critérios de aprovação**

- O mesmo conjunto de dados produz os mesmos totais em todas as telas.
- Alterar uma fórmula central reflete nos consumidores sem duplicação de lógica.
- Os testes de regressão usam um cenário financeiro completo e comparam todos os módulos.
- Typecheck, lint e build permanecem aprovados.

### Tarefa 17 — Implementar bloqueio e reabertura de períodos

- [x] Impedir alterações financeiras em períodos fechados e criar reabertura formal apenas para perfis autorizados.

**Critérios de aprovação**

- Inclusão, edição, exclusão, importação e efetivação são bloqueadas em período fechado.
- Reabertura exige usuário autorizado e justificativa.
- Fechamento e reabertura geram registros de auditoria.
- Os relatórios fechados permanecem reproduzíveis após logout e novo login.

### Tarefa 18 — Criar trilha de auditoria financeira

- [x] Registrar operações críticas de caixa, pagamentos, conciliações, importações e comissões.

**Critérios de aprovação**

- Cada evento contém autor, data, unidade, ação, entidade e valores anteriores/novos aplicáveis.
- O histórico é imutável para usuários comuns.
- Excluir ou alterar um lançamento não elimina seu histórico.
- Administrador consegue consultar a auditoria por período, unidade e usuário.

## Fase 4 — Mensagens e links inteligentes

### Tarefa 19 — Preparar serviço persistente para Baileys

- [x] Separar o serviço de mensagens da execução efêmera da Vercel e documentar sua hospedagem persistente.

**Critérios de aprovação**

- Reiniciar o frontend ou uma função web não encerra a sessão do WhatsApp.
- Credenciais de sessão são persistidas de forma criptografada fora do navegador.
- O frontend se comunica com o serviço por API autenticada e autorizada.
- Falha ou indisponibilidade é apresentada sem bloquear os demais módulos.

### Tarefa 20 — Completar auditoria e proteção do disparo

- [x] Vincular cada conexão, início, interrupção e resultado de campanha ao usuário autenticado e à unidade.

**Critérios de aprovação**

- Usuários sem permissão não controlam a conexão nem iniciam campanhas.
- Auditoria registra processados, entregues, falhas e motivo de interrupção.
- Limite de contatos, consentimento e intervalos continuam obrigatórios.
- Nenhum segredo operacional é solicitado na interface.

### Tarefa 21 — Endurecer o módulo de links inteligentes

- [x] Aplicar autorização do servidor às operações de gestão e reforçar as proteções de redirecionamento e cloaking.

**Critérios de aprovação**

- Criar, editar, excluir e simular link exige perfil autorizado.
- A rota pública de redirecionamento expõe somente o comportamento necessário ao visitante.
- URLs internas, protocolos inseguros e redirecionamentos para redes privadas são bloqueados.
- Falhas de cloaking geram tratamento seguro e não expõem cabeçalhos ou dados internos.

## Fase 5 — Manutenção e desempenho

### Tarefa 22 — Remover `dist` do controle de versão

- [x] Concluir a remoção dos artefatos compilados do Git e deixar a Vercel gerar o build a partir do código-fonte.

**Critérios de aprovação**

- `git ls-files dist` não retorna arquivos.
- `dist/` está ignorado pelo Git.
- Build local recria os artefatos sem adicioná-los ao status do Git.
- Um deploy de teste na Vercel é concluído a partir do commit fonte.

### Tarefa 23 — Dividir os componentes de conciliação e financeiro

- [x] Extrair regras, tabelas, filtros, modais e formulários dos componentes financeiros maiores, sem alterar comportamento.

**Critérios de aprovação**

- Componentes extraídos possuem responsabilidade única e nomes claros.
- Regras de negócio não permanecem acopladas à renderização quando puderem ser serviços puros.
- Testes e build são aprovados antes e depois da divisão.
- Teste manual confirma conciliação, efetivação, caixa e baixas sem regressão.

### Tarefa 24 — Dividir importador e painel administrativo

- [x] Separar parsers, validações, persistência, pré-visualização e formulários administrativos em módulos menores.

**Critérios de aprovação**

- Cada formato de importação possui parser/validador testável isoladamente.
- Substituição de dados existentes continua exigindo confirmação.
- Reimportação não duplica registros protegidos por fingerprint.
- Painel administrativo mantém os fluxos e permissões definidos no PRD.

### Tarefa 25 — Paginar e virtualizar listas extensas

- [x] Implementar paginação ou virtualização nos históricos e tabelas com potencial de crescimento contínuo.

**Critérios de aprovação**

- A primeira renderização não baixa todos os registros históricos.
- Filtros e ordenação continuam corretos entre páginas.
- Rolagem em celular permanece fluida com volume de teste representativo.
- Não há perda de seleção ou edição ao carregar a próxima página.

## Fase 6 — Cobertura e liberação

### Tarefa 26 — Testar fluxos financeiros completos

- [x] Criar testes de integração para importação, conciliação, fechamento, baixas, pagamentos, cortesias e vendas internas.

**Critérios de aprovação**

- Cada fluxo possui ao menos um cenário de sucesso, validação e falha de persistência.
- Dados permanecem após recarga, logout/login e nova sessão.
- Substituição de uma importação atualiza os totais sem duplicação.
- Todos os testes executam de forma reproduzível em ambiente isolado.

### Tarefa 27 — Testar perfis e responsividade

- [x] Cobrir os principais fluxos de cada perfil em desktop, tablet e telefone.

**Critérios de aprovação**

- Administrador, gerência, financeiro, marketing, recepção e barbeiro possuem cenários próprios.
- Não existem controles inacessíveis, texto cortado ou rolagem horizontal involuntária nos tamanhos definidos.
- Gráficos e tabelas exibem estado vazio, carregamento, erro e dados reais.
- Capturas ou relatório automatizado documentam os tamanhos validados.

### Tarefa 28 — Executar auditoria final de segurança

- [x] Revisar regras, APIs, dependências, segredos, cabeçalhos e permissões antes do deploy de produção.

**Critérios de aprovação**

- Não há regras abertas nem possibilidade conhecida de elevação de privilégio.
- Nenhum segredo aparece no Git ou nos bundles gerados.
- Auditoria de dependências não contém vulnerabilidade crítica ou alta sem mitigação documentada.
- Tentativas de acesso entre unidades e perfis são negadas pelos testes.

### Tarefa 29 — Publicar release candidata

- [x] Gerar uma release candidata em ambiente de homologação e executar o checklist operacional do PRD.

**Critérios de aprovação**

- Commit, versão e ambiente implantado são identificáveis.
- Migrações são executadas primeiro em modo de simulação e possuem backup verificável.
- Smoke tests de todos os perfis e módulos críticos são aprovados.
- Não existem erros críticos no navegador ou no servidor durante a validação.

### Tarefa 30 — Publicar em produção e validar pós-deploy

- [x] Publicar a versão aprovada e executar validação pós-deploy com plano de reversão disponível.

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

## Fase 7 — Lacunas identificadas na auditoria pós-release

As tarefas abaixo tratam as lacunas encontradas na auditoria técnica posterior às tarefas 1–30. As regras funcionais continuam definidas no [PRD](./prd.md).

### Tarefa 31 — Padronizar confirmações de ações destrutivas

- [x] Substituir confirmações nativas, painéis embutidos e exclusões diretas por um popup global consistente para exclusão, inativação, limpeza, zeramento e substituição de dados.

**Critérios de aprovação**

- Toda ação destrutiva persistente exige confirmação em popup antes de executar.
- O popup informa objeto, impacto e irreversibilidade quando aplicável.
- Cancelar preserva os dados e confirmar executa a ação uma única vez.
- A busca por `window.confirm` ou `confirm(` não encontra confirmações nativas na aplicação.

### Tarefa 32 — Tornar catálogo, categorias e subcategorias atômicos

- [x] Migrar salvamentos, exclusões e desvinculações relacionadas para lotes ou transações atômicas do Firestore.

**Critérios de aprovação**

- Uma falha não deixa categorias, subcategorias ou itens parcialmente atualizados.
- Erros interrompem a operação e são exibidos em português.
- Exclusões preservam a integridade das referências do catálogo.
- Testes cobrem sucesso, falha e rollback lógico.

### Tarefa 33 — Automatizar a execução e saúde do serviço de mensagens

- [x] Documentar e implementar verificação de disponibilidade do serviço Baileys separadamente do frontend.

**Critérios de aprovação**

- A aplicação distingue frontend disponível de serviço de mensagens disponível.
- O ambiente local possui comando documentado para iniciar ambos os serviços.
- A interface mostra estado indisponível e instrução segura sem expor segredos.
- Um teste de saúde valida a API do serviço de mensagens.

### Tarefa 34 — Adicionar testes E2E reais de perfis e responsividade

- [x] Criar testes em navegador para os fluxos críticos nos tamanhos de telefone, tablet e desktop.

**Critérios de aprovação**

- Os testes renderizam as páginas em navegador real, sem apenas inspecionar o código-fonte.
- Login, navegação, modais, gráficos e tabelas são cobertos nos três tamanhos.
- Falham quando existir sobreposição, rolagem horizontal indevida ou controle inacessível.
- Produzem relatório e capturas das falhas.

### Tarefa 35 — Fortalecer testes de regras no Firebase Emulator

- [x] Incluir no pipeline os testes reais das regras para todas as coleções privadas e isoladas por unidade.

**Critérios de aprovação**

- Os testes executam no Emulator com usuários dos seis perfis.
- Leitura e escrita cruzadas entre unidades são negadas.
- Operações financeiras e administrativas autorizadas continuam funcionando.
- O pipeline falha se uma coleção nova não possuir cobertura explícita.

### Tarefa 36 — Isolar dados e controles de demonstração

- [x] Restringir simulações e cargas de exemplo ao ambiente de desenvolvimento ou a uma permissão administrativa explícita.

**Critérios de aprovação**

- Usuários comuns não visualizam nem executam cargas demonstrativas em produção.
- Dados simulados são claramente identificados e não contaminam registros reais.
- O build de produção não oferece ação de simulação sem a permissão definida.
- Teste cobre ambientes de desenvolvimento e produção.

**Revalidação da tarefa 36 — 12/09/2026**

- Corrigidas lacunas em simulações de profissionais/unidades, importação durante demonstração, efetivação parcial da conciliação e exemplos de marketing.
- Simulações de desempenho permanecem em memória; limpar exemplos não exclui registros reais. Cliques simulados não entram nos totais de analytics.
- Evidências e limites: [Revalidação da tarefa 36](./TAREFA_36_REVALIDACAO.md).

### Tarefa 37 — Atualizar dependências moderadamente vulneráveis

- [x] Atualizar a cadeia Firebase Admin/Google Cloud de maneira controlada e validar incompatibilidades.

**Critérios de aprovação**

- `npm audit --omit=dev` não relata vulnerabilidade alta ou crítica e as moderadas remanescentes possuem justificativa.
- Autenticação, Firestore Admin e APIs protegidas passam após a atualização.
- Nenhuma correção usa atualização forçada sem revisão das mudanças incompatíveis.
- Versões e decisão técnica ficam registradas na arquitetura.

**Revalidação em 12/09/2026:** dependências mantidas após análise das duas ocorrências moderadas; sem alta/crítica. Adicionado teste real de compatibilidade do Admin SDK no Emulator. Decisão e validações na seção 7.1 da [arquitetura](./ARQUITETURA.md).

### Tarefa 38 — Reduzir o custo do carregamento inicial

- [x] Carregar PDF, planilhas e exportadores apenas quando os respectivos módulos forem acessados.

**Critérios de aprovação**

- O bundle inicial não inclui bibliotecas pesadas de PDF, XLSX e exportação.
- Importação e exportação continuam funcionando após carregamento sob demanda.
- O build registra redução mensurável do pacote inicial.
- Falha ao carregar um módulo apresenta mensagem recuperável ao usuário.

**Revalidação em 12/09/2026:** seis testes de carregamento aprovados, incluindo falha/nova tentativa real e grafo estático completo. Métricas do build e evidências na seção 7.2 da [arquitetura](./ARQUITETURA.md).

### Tarefa 39 — Consolidar release e eliminar divergência local

- [x] Revisar, testar e versionar as alterações acumuladas antes do próximo deploy.

**Critérios de aprovação**

- O status do Git não contém alterações inesperadas.
- Cada conjunto funcional está identificado no histórico.
- Build e suítes críticas passam no commit candidato.
- A versão local, o commit remoto e o deploy são rastreáveis.

**Consolidação local em 12/09/2026:** revalidações das tarefas 36–38 versionadas, inicialização Windows revisada e suítes críticas aprovadas. A produção e o remoto continuam na versão anterior. Evidências e estado de publicação na [revalidação da tarefa 39](./TAREFA_39_REVALIDACAO.md).

## Fase 8 — Campanhas persistentes e WhatsApp escalável

As tarefas 40–61 implementam o [Anexo do PRD — Plataforma de campanhas e mensagens](./PRD_DISPARO_MENSAGENS.md). A ordem abaixo segue as dependências técnicas e a priorização definida no anexo.

### Tarefa 40 — Versionar o modelo persistente de campanhas

- [x] Definir e migrar os documentos de campanha, destinatário, tentativa, mídia e fila de erros, todos vinculados à unidade e com timestamps de auditoria.

**Critérios de aprovação**

- O schema contempla todos os estados definidos no anexo e possui versão explícita.
- Cada destinatário possui campanha, unidade, contato normalizado, estado e chave de idempotência.
- A migração é repetível, possui simulação e não altera campanhas históricas indevidamente.
- Regras do Firestore e testes do Emulator negam acesso entre unidades.

### Tarefa 41 — Criar campanhas e destinatários de forma atômica

- [x] Substituir a fila em memória pela criação persistente da campanha e dos destinatários deduplicados.

**Critérios de aprovação**

- Falha parcial não deixa campanha liberada com destinatários incompletos.
- Duplicatas dentro da mesma campanha produzem um único destinatário.
- A mesma requisição repetida não cria outra campanha nem outro envio.
- Testes cobrem sucesso, repetição, lote parcialmente inválido e falha de persistência.

### Tarefa 42 — Implementar worker com lease e bloqueio distribuído

- [x] Criar worker assíncrono que reivindica atomicamente o próximo destinatário elegível e renova um lease durante o processamento.

**Critérios de aprovação**

- Duas instâncias concorrentes não processam o mesmo destinatário.
- Lease expirado pode ser recuperado por outra instância.
- Itens enviados, cancelados ou bloqueados nunca voltam à fila.
- Teste concorrente comprova exatamente um processamento por chave de idempotência.

### Tarefa 43 — Retomar campanhas após reinício

- [x] Recuperar itens `PROCESSANDO` com lease vencido e continuar itens `PENDENTE` ao iniciar o serviço.

**Critérios de aprovação**

- Reinício forçado no meio de uma campanha não perde a fila.
- Destinatários já concluídos não são reenviados.
- Progresso e totais são reconstruídos a partir do banco, não da memória.
- Teste de integração encerra e reinicia o worker durante uma campanha e aprova a contagem exata.

### Tarefa 44 — Implementar retentativas e fila de erros

- [x] Classificar falhas transitórias e definitivas, aplicar backoff exponencial e encaminhar falhas esgotadas à fila de erros.

**Critérios de aprovação**

- Falhas transitórias realizam no máximo três tentativas com intervalos progressivos.
- Falhas definitivas não são repetidas sem ação manual.
- A fila de erros registra tentativa, causa, destinatário mascarado e ação de reprocessamento auditada.
- Testes usam relógio controlado e cobrem sucesso após retentativa e esgotamento.

### Tarefa 45 — Separar sessões WhatsApp por unidade

- [x] Substituir o socket global por um gerenciador de sessões independentes por unidade ou número.

**Critérios de aprovação**

- Duas unidades conectam contas distintas sem compartilhar credenciais ou estado.
- Credenciais permanecem criptografadas e separadas por identificador de sessão.
- Uma sessão indisponível não interrompe campanhas de outra unidade.
- Testes simulam duas sessões simultâneas e tentativa de acesso cruzado.

### Tarefa 46 — Completar o ciclo de vida das conexões

- [x] Persistir metadados da conta e implementar conectar, reconectar, desconectar e gerar novo QR.

**Critérios de aprovação**

- Painel mostra número, nome, última conexão, expiração do QR e motivo real da desconexão.
- QR possui contagem regressiva e não pode ser usado depois de expirar.
- Ações exigem autorização da unidade e produzem auditoria.
- Desconexão intencional e queda anormal apresentam estados distintos.

### Tarefa 47 — Proteger sessões com lock distribuído

- [x] Impedir que duas instâncias do Railway mantenham a mesma sessão WhatsApp simultaneamente.

**Critérios de aprovação**

- Somente o proprietário do lock abre ou usa o socket.
- Lock possui lease, renovação e recuperação após falha da instância.
- Perda do lock encerra o socket local antes de outro envio.
- Teste com duas instâncias simuladas comprova exclusividade e recuperação.

### Tarefa 48 — Substituir polling por eventos em tempo real

- [x] Publicar QR, conexão, progresso e alertas por SSE ou WebSocket com reconexão autenticada.

**Critérios de aprovação**

- O polling de 1,5 segundo é removido do frontend.
- Eventos são filtrados pela unidade autorizada do assinante.
- Reconexão usa cursor ou snapshot para não perder o estado atual.
- Testes cobrem autenticação, isolamento, queda e reconexão do canal.

### Tarefa 49 — Criar lista global de bloqueio e opt-out

- [x] Implementar lista “não enviar”, palavras de saída e bloqueio imediato em todas as filas.

**Critérios de aprovação**

- Contato bloqueado não entra nem permanece como elegível em campanha alguma.
- SAIR, PARAR e CANCELAR geram bloqueio e evento de consentimento auditável.
- Desbloqueio exige permissão e justificativa.
- Testes cobrem variações de caixa, acentos, espaços e corrida entre bloqueio e worker.

### Tarefa 50 — Aplicar consentimento e histórico de opt-in

- [x] Persistir origem, data, evidência e mudanças de consentimento por contato.

**Critérios de aprovação**

- Campanha não é liberada sem consentimento válido ou base legal configurada.
- Toda alteração gera evento imutável com autor e unidade.
- Importação permite mapear origem e data do opt-in.
- Relatório de auditoria reconstrói a situação do consentimento em qualquer data.

### Tarefa 51 — Implementar limites, silêncio e deduplicação recente

- [x] Aplicar limites diário global, por unidade e conta, frequência por contato, campanhas sobrepostas e horário silencioso.

**Critérios de aprovação**

- Reservas concorrentes não ultrapassam os limites configurados.
- Mesmo contato não participa de campanhas simultâneas ou recentes fora da política.
- Horário silencioso pausa a elegibilidade sem alterar a ordem da fila.
- Painel explica em português cada bloqueio e o horário estimado de liberação.

### Tarefa 52 — Implementar aquecimento e pausa automática

- [x] Controlar taxa progressiva para contas novas e pausar campanhas com taxa elevada de falhas.

**Critérios de aprovação**

- Curva de aquecimento é configurável, persistente e limitada por conta.
- Janela móvel de falhas pausa a campanha ao atingir o limiar.
- Administradores recebem alerta com causa e métricas.
- Retomada exige condição segura e fica registrada na auditoria.

### Tarefa 53 — Adicionar confirmação de alto volume e envio de teste

- [x] Exigir texto de confirmação para alto volume e permitir teste individual antes da liberação.

**Critérios de aprovação**

- A campanha não inicia se o texto não corresponder ao desafio exibido.
- Envio de teste usa conteúdo e mídia finais sem liberar os demais destinatários.
- Resultado do teste fica vinculado à campanha.
- Testes cobrem confirmação incorreta, expirada, correta e teste com falha.

### Tarefa 54 — Importar contatos com mapeamento de colunas

- [x] Aceitar CSV, XLSX, XLS e ODS, oferecendo mapeamento de nome, telefone, consentimento e variáveis.

**Critérios de aprovação**

- Formato e tamanho são validados antes do processamento.
- Usuário pode corrigir o mapeamento detectado automaticamente.
- Números inválidos e duplicados são apresentados antes da confirmação.
- Testes cobrem os quatro formatos, cabeçalhos variados, arquivo vazio, malformado e duplicatas.

### Tarefa 55 — Criar busca de clientes e segmentos reutilizáveis

- [x] Permitir adicionar clientes da base e salvar segmentos por filtros autorizados.

**Critérios de aprovação**

- Busca respeita unidade, paginação e mascaramento de telefone.
- Segmento pode ser reutilizado sem duplicar contatos na campanha.
- Mudança na base possui política explícita de segmento dinâmico ou snapshot.
- Usuário de uma unidade não descobre clientes de outra.

### Tarefa 56 — Implementar rascunhos, modelos e personalização

- [x] Persistir mensagens, criar biblioteca de modelos e materializar tags por destinatário.

**Critérios de aprovação**

- Rascunho pode ser salvo, recarregado e editado após nova sessão.
- Tags de primeiro nome, segundo nome e variáveis personalizadas têm fallback seguro.
- Pré-visualização usa um contato real selecionado sem alterar a campanha.
- Mensagem materializada fica registrada por destinatário para auditoria e retomada.

### Tarefa 57 — Adicionar imagens, vídeos e legendas

- [x] Permitir múltiplas mídias privadas com pré-visualização, ordem e legenda individual.

**Critérios de aprovação**

- Frontend e backend validam extensão, MIME, assinatura e limite de tamanho.
- Upload inválido não cria referência órfã; remoção limpa o arquivo conforme a política.
- Worker retoma mídia após reinício sem depender de arquivo local temporário.
- Testes cobrem imagem, vídeo, múltiplos anexos, arquivo disfarçado e excesso de tamanho.

### Tarefa 58 — Implementar agendamento, recorrência e aprovação

- [x] Adicionar início futuro, recorrência, duplicação de campanha e aprovação por outro administrador.

**Critérios de aprovação**

- Datas usam timezone da unidade e mantêm execução correta em mudança de horário.
- Aprovador não pode ser o mesmo criador quando a política exigir dupla aprovação.
- Duplicação não reutiliza IDs, estados ou chaves de idempotência.
- Cancelamento é livre até o primeiro envio e auditado depois do processamento iniciado.

### Tarefa 59 — Aplicar retenção, mascaramento e permissões granulares

- [x] Implementar retenção de telefones e permissões separadas para criar, aprovar e executar.

**Critérios de aprovação**

- Logs comuns nunca exibem telefone completo.
- Job de retenção anonimiza ou exclui dados vencidos sem quebrar métricas agregadas.
- Matriz de permissões é aplicada na interface, API e banco.
- Testes comprovam negação de elevação e acesso cruzado.

### Tarefa 60 — Criar métricas, alertas e relatórios completos

- [ ] Consolidar painel de desempenho, comparação de campanhas, alertas e exportações XLSX, CSV e PDF.

**Critérios de aprovação**

- Métricas incluem enviados, entregues, lidos, respondidos, falhas e tempo médio.
- Distribuição de falhas e estimativa de término usam dados persistidos.
- Alertas cobrem desconexão anormal, bloqueio de conta e campanha interrompida.
- Exportações respeitam filtros, unidade, mascaramento e contêm resumo e destinatários.

### Tarefa 61 — Validar Railway, observabilidade e release

- [ ] Executar testes de reinício, concorrência e carga, publicar a versão e validar observabilidade.

**Critérios de aprovação**

- Health check expõe versão e hash do commit sem segredo.
- Reinício programado avisa usuários, drena o worker e retoma a fila.
- Teste com duas instâncias, reinício forçado e campanha ativa termina sem perda ou duplicidade.
- Typecheck, lint, build, testes unitários, integração e smoke tests de produção são aprovados.
