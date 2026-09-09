# PRD — Van's Management

## 1. Visão do produto

O Van's Management é o sistema integrado de gestão operacional, financeira e comercial da rede. O produto deve consolidar informações de múltiplas unidades, reduzir trabalho manual, permitir conferência rastreável dos resultados e apresentar a cada perfil somente os dados e ações necessários à sua função.

Este documento é a fonte de verdade para regras de negócio e requisitos do produto. Decisões de arquitetura, comandos, migrações e detalhes de código devem permanecer nos documentos técnicos vinculados.

## 2. Objetivos

- Consolidar faturamento, caixa, recebimentos, despesas, pagamentos e conciliações por período e unidade.
- Automatizar importações e cálculos sem perder a possibilidade de conferência humana.
- Oferecer análises consistentes de unidades e profissionais.
- Garantir segregação de acesso entre perfis e unidades.
- Manter histórico mensal e trilha auditável das operações relevantes.
- Apoiar comunicação interna, marketing e distribuição de links.
- Funcionar com boa leitura e usabilidade em desktop, tablet e telefone.

## 3. Princípios do produto

1. A regra de negócio deve produzir o mesmo resultado em todas as telas.
2. Ocultar um botão não substitui autorização no banco ou no servidor.
3. Dados de uma unidade não podem ser entregues a um usuário sem acesso a ela.
4. Operações financeiras relevantes devem ser persistentes e auditáveis.
5. Importações devem ser previsíveis, idempotentes quando aplicável e confirmadas antes de substituir dados.
6. Períodos anteriores permanecem preservados; um novo mês inicia seu próprio conjunto de registros.
7. Erros, bloqueios e estados vazios devem ser explicados em português.

## 4. Perfis e escopo

### 4.1 Administrador

Possui gestão global do sistema, usuários, unidades, configurações, permissões e todos os módulos. Pode atuar em uma unidade específica ou em visão consolidada.

### 4.2 Gerência

Acompanha operação, financeiro, equipe, metas, análises, conciliações, pagamentos, importações e relatórios das unidades autorizadas. Controla a visibilidade do ranking trimestral dos barbeiros.

### 4.3 Financeiro

Acessa os processos financeiros das unidades autorizadas, incluindo caixa, conciliações, recebimentos, despesas, pagamentos, comissões, cortesias, vendas internas e relatórios financeiros.

### 4.4 Marketing

Acessa planejamento, produção, calendário, tráfego, conteúdo, indicadores de marketing e recursos de IA autorizados. O acesso a dados financeiros deve se limitar aos indicadores necessários e autorizados.

### 4.5 Recepção

É cadastrada como usuário vinculado obrigatoriamente a uma unidade. Pode acessar:

- resumo operacional da própria unidade;
- fechamento de caixa da própria unidade;
- lançamentos rápidos autorizados;
- mural de avisos destinado ao seu perfil e unidade;
- disparo de mensagens, quando autorizado;
- links inteligentes;
- controle de cortesias;
- controle de vendas internas.

A recepção não deve receber dados privados de outras unidades.

### 4.6 Barbeiro ou profissional

É vinculado a uma unidade e acessa exclusivamente suas informações pessoais e profissionais permitidas: visão geral, avisos, autogestão, lançamentos e objetivos, pagamentos, relatórios, rankings, anotações e configurações pessoais.

O ranking trimestral só é exibido quando liberado pela gerência.

### 4.7 Acesso a múltiplas unidades

Usuários autorizados podem possuir acesso a mais de uma unidade. A seleção de unidade define o escopo das consultas e operações. A opção “Todas as unidades” somente é permitida a perfis com autorização de visão consolidada.

## 5. Definições financeiras

### 5.1 Faturamento avulso

Valor bruto de serviços avulsos atribuídos à unidade ou ao profissional, excluindo assinaturas e produtos.

### 5.2 Faturamento de assinaturas

Valor de assinaturas atribuído à unidade ou ao profissional conforme o relatório do gateway e a participação registrada. O recebimento financeiro pode ocorrer em D+31 sem alterar o período em que a produção foi atribuída.

### 5.3 Faturamento de produtos

Valor bruto das vendas de produtos atribuído à unidade ou ao profissional.

### 5.4 Faturamento total

O faturamento total é sempre:

```text
faturamento avulso + faturamento de assinaturas + faturamento de produtos
```

Os três componentes devem formar o total independentemente da ordem em que seus arquivos forem importados.

### 5.5 Movimentação de caixa

Entrada ou saída efetiva de dinheiro em uma conta ou caixa. Uma movimentação de caixa não é automaticamente faturamento; sua classificação determina seu efeito nos relatórios.

### 5.6 Receita

Entrada reconhecida como resultado da operação. A conciliação efetivada do PDV com o adquirente deve classificar a receita e utilizar o tipo de pagamento como subclassificação.

### 5.7 Despesa

Saída reconhecida como custo ou gasto da operação. Pagamentos de comissão marcados como pagos devem gerar despesa no caixa com descrição que identifique a comissão, o profissional e a data do pagamento.

### 5.8 Repasse

Valor recebido ou mantido temporariamente para entrega a terceiro, como gorjeta de barbeiro. Não deve ser confundido com receita própria.

### 5.9 Transferência interna

Movimentação entre contas ou caixas da empresa. Deve gerar os dois lados da transferência sem aumentar receita ou despesa consolidada.

### 5.10 Desconto comercial

Redução concedida sobre uma venda. Deve reduzir a receita da operação relacionada, sem ser tratada como saída física de caixa independente.

### 5.11 Cortesia

Serviço concedido sem cobrança, registrado com data, cliente, serviço, valor de referência e profissional responsável. É controle comercial e operacional; não representa recebimento financeiro.

### 5.12 Venda interna

Produto ou serviço fornecido a colaborador, registrado com profissional, item, valor, data e status `PENDENTE` ou `DESCONTADO`. O reconhecimento financeiro segue a efetiva cobrança ou desconto, evitando dupla contabilização.

### 5.13 Estorno

Reversão vinculada a uma operação original. Deve preservar o histórico, registrar motivo e neutralizar os efeitos financeiros da operação estornada.

### 5.14 Período fechado

Período financeiro formalmente encerrado. Não aceita inclusão, edição, exclusão, importação ou efetivação sem reabertura autorizada e auditada.

## 6. Requisitos funcionais

### 6.1 Identidade, sessão e permissões

- Login deve utilizar identidade autenticada e verificável.
- Senhas não podem ser armazenadas em documentos da aplicação.
- A sessão deve depender da autenticação válida, não de um ID manipulável no navegador.
- Permissões devem ser aplicadas na interface, no servidor e no banco.
- Alterar o próprio perfil não pode permitir troca de função, unidade, status ou permissões.
- Logout deve encerrar o acesso aos dados privados.

### 6.2 Visão geral

- Permitir filtro de período e, para perfis autorizados, de unidade.
- Exibir receitas, despesas, saldo, pendências, fluxo de caixa, desempenho, atividade recente e rankings aplicáveis.
- O resumo mensal deve detalhar o resultado no próprio contexto financeiro e não encaminhar indevidamente ao relatório de faturamento.
- Rankings devem respeitar período, unidade e visibilidade configurada.

### 6.3 Caixa e contas

- Registrar receitas, despesas, transferências e demais movimentações classificadas.
- Permitir filtros e limpeza dos filtros sem perder o estado após edição.
- Permitir lançamentos rápidos autorizados: PIX direto, venda em espécie, compra do caixa, gorjeta, repasse de gorjeta, reforço de troco, retirada de troco, vale e cortesia.
- Realizar fechamento de caixa por unidade e período.
- Permitir baixa de despesas agendadas, incluindo boletos, insumos e comissões.

### 6.4 Conciliação

- Organizar as regras de conciliação em uma visão objetiva, mantendo acesso a cada regra.
- Selecionar unidades a partir do cadastro de unidades.
- Conciliar PDV, adquirente, assinaturas, recebimentos D+31 e demais fontes definidas.
- Na conciliação do PDV, desconsiderar linhas de assinatura, vale-presente e cortesia quando essas fontes forem tratadas separadamente.
- Ao efetivar uma conciliação, transações pendentes devem seguir para baixa de recebimentos com previsão de recebimento.
- Permitir agrupamento e baixa em lote por data, com expansão dos detalhes.
- Exibir conciliações de assinaturas na visão consolidada aplicável.
- Preservar listas e conciliações salvas após recarga e nova sessão.

### 6.5 Pagamentos e comissões

- Manter pagamentos por profissional e período.
- Calcular comissão a partir do faturamento total do profissional.
- Permitir faixas de faturamento e percentuais independentes por unidade.
- Impedir faixas sobrepostas e valores inválidos.
- Transferir o cálculo aprovado para `Comissão Avulso` sem alterar produtos, assinaturas, descontos ou pagamentos já pagos.
- Ao marcar pagamento como pago, registrar a despesa correspondente no caixa.

Detalhes funcionais complementares estão em [Cálculo de Comissão](./CALCULO_COMISSAO.md).

### 6.6 Importações

- Aceitar os formatos definidos para cada fonte, com identificação, pré-visualização e validação antes de salvar.
- Evitar duplicação por arquivo ou fingerprint quando aplicável.
- Quando o campo de destino já possuir dados, pedir confirmação antes da substituição.
- Quando a substituição for confirmada, substituir os valores anteriores pelos novos, sem somá-los indevidamente.
- Serviços realizados e produtos devem alimentar as análises de unidade conforme o relatório correspondente.
- Serviços, produtos e assinaturas atribuídos aos profissionais devem alimentar análises e pagamentos aplicáveis.
- Relatório 09 deve preencher clientes atendidos do profissional selecionado e consolidar a unidade.
- Relatório 17 deve preencher clientes novos dos profissionais e consolidar a unidade.
- Relatório 33 deve preencher clientes sem preferência dos profissionais e da unidade.
- Importações de avulso, assinaturas e produtos devem recompor o faturamento total.
- O histórico da importação deve registrar fonte, período, unidade, resultado e responsável.

### 6.7 Análises e SVA

- Análise de unidade deve consolidar faturamento, atendimentos, ticket, demanda, retorno, produtos, assinaturas e demais indicadores definidos.
- Análise de barbeiros deve exibir os componentes e o faturamento total de cada profissional.
- Gráficos devem funcionar em desktop e dispositivos móveis e permitir expansão quando prevista.
- SVA acompanha diariamente serviços, produtos, assinaturas e metas.
- Totais exibidos nas análises devem utilizar as mesmas fórmulas dos importadores e relatórios.

### 6.8 Relatórios

- O relatório de faturamento deve detalhar serviços, produtos e assinaturas por mês ou semana.
- Exportação deve ocupar uma página A4 inteira em orientação paisagem, independentemente de ser iniciada por telefone ou computador.
- Valores consolidados devem respeitar unidade, período e classificações.
- O relatório deve ser reproduzível para períodos fechados.

### 6.9 Cortesias

- Registrar data, cliente, serviço, valor de referência, profissional e unidade.
- Separar automaticamente os registros por mês sem apagar meses anteriores.
- Permitir preenchimento pela recepção da própria unidade e gestão pelos perfis autorizados.
- Integrar o indicador aos relatórios sem gerar entrada de caixa fictícia.

### 6.10 Vendas internas

- Registrar profissional, produto ou serviço, valor, data, unidade e status.
- Permitir alteração de `PENDENTE` para `DESCONTADO` por perfil autorizado.
- Separar automaticamente os registros por mês sem apagar o histórico.
- Permitir preenchimento pela recepção da própria unidade.
- Evitar duplicação entre venda, desconto e movimentação financeira.

### 6.11 Mural de avisos

- Operar como um feed interno com publicações, respostas, comentários e confirmação de leitura.
- Permitir selecionar uma ou mais unidades e perfis destinatários.
- Somente usuários dentro do público selecionado podem receber e visualizar a publicação.
- Registrar autor, data, destinatários e interações.

### 6.12 Disparo de mensagens

- Permitir listas autorizadas, validação de números, remoção de duplicados e intervalos humanizados.
- Exigir confirmação de consentimento e limitar o volume de cada campanha.
- Registrar autor, unidade, início, interrupção, processados, entregues e falhas.
- A conexão do WhatsApp deve operar em serviço persistente apropriado.
- A indisponibilidade do serviço não pode impedir o uso do restante do sistema.
- O uso da biblioteca não oficial deve ser tratado como risco operacional conhecido.

### 6.13 Links inteligentes

- Permitir link curto rotativo, loop de destinos, troca por data e linha do tempo.
- Disponibilizar copiar link, QR Code, analytics, logs e simulação temporal.
- Restringir gestão e simulação a perfis autorizados.
- Manter a rota de redirecionamento necessária ao visitante.
- Bloquear destinos internos, protocolos inseguros e tentativas de acesso à infraestrutura.
- Cloaking deve falhar de forma segura quando o destino for incompatível.

### 6.14 Marketing

- Organizar planejamento, campanhas, produções, calendário, tráfego pago, orgânico, biblioteca e resultados.
- Permitir acompanhamento da equipe interna, responsáveis, prazos, status e metas.
- Recursos de IA devem utilizar API protegida no servidor.
- Resultados devem poder ser filtrados por período, canal, campanha, unidade e responsável quando aplicável.

### 6.15 Configurações e tema

- Tema deve ser aplicado de forma consistente em todos os módulos e perfis.
- Configurações pessoais não podem alterar permissões administrativas.
- Elementos removidos da navegação não devem reaparecer em layouts alternativos ou dispositivos móveis.

## 7. Requisitos de dados e persistência

- Todo registro privado deve possuir proprietário, unidade ou escopo global explicitamente definido.
- Dados financeiros devem conter período, datas relevantes, classificação, origem e responsável quando aplicável.
- Operações críticas devem preservar histórico de criação e alteração.
- Dados do mês anterior permanecem acessíveis quando um novo mês começa.
- Substituições de importação devem ser atômicas ou recuperáveis.
- Exclusão funcional não deve apagar trilhas obrigatórias de auditoria.
- Datas e valores monetários devem utilizar formatos consistentes internamente e apresentação localizada em `pt-BR`.

## 8. Requisitos não funcionais

### 8.1 Segurança

- Negar por padrão acessos não declarados.
- Validar autenticação e autorização no servidor e no Firestore.
- Não expor segredos no frontend, Git, logs ou mensagens de erro.
- Impedir elevação de privilégio e acesso entre unidades.
- Tratar arquivos importados e conteúdo remoto como não confiáveis.

### 8.2 Integridade

- Persistências compostas devem ser atômicas quando uma gravação parcial produzir inconsistência.
- Valores derivados devem ser calculados por funções únicas.
- Reimportação, edição, estorno e exclusão devem atualizar todos os consumidores relevantes.
- Períodos fechados exigem reabertura formal para alterações.

### 8.3 Desempenho

- Módulos pesados devem ser carregados somente quando necessários.
- Listas e históricos extensos devem usar paginação ou virtualização.
- Consultas não devem transferir coleções completas quando o usuário possui escopo restrito.
- A experiência móvel deve permanecer utilizável em conexões lentas.

### 8.4 Responsividade e acessibilidade

- Fluxos críticos devem funcionar em desktop, tablet e telefone.
- Não deve existir rolagem horizontal involuntária nas páginas.
- Textos devem manter contraste legível nos temas claro e escuro.
- Gráficos, tabelas, formulários e diálogos devem possuir alternativas adequadas a telas estreitas.
- Controles devem ser acessíveis por teclado e possuir identificação compreensível.

### 8.5 Confiabilidade e observabilidade

- Erros devem ser registrados sem incluir dados sensíveis.
- Falhas de rede devem apresentar retorno claro e permitir nova tentativa segura.
- Operações demoradas devem mostrar estado de carregamento.
- Serviços externos indisponíveis devem degradar apenas o módulo dependente.

## 9. Auditoria obrigatória

Devem gerar eventos auditáveis:

- criação e alteração de usuários, funções e unidades;
- importação e substituição de dados;
- criação, edição, exclusão e estorno financeiro;
- fechamento e reabertura de período ou caixa;
- salvamento e efetivação de conciliação;
- baixa de recebimentos e despesas;
- cálculo, transferência e pagamento de comissão;
- campanhas de mensagens;
- criação, alteração e exclusão de links inteligentes.

Cada evento deve identificar autor autenticado, data e hora, unidade, ação, entidade afetada e alterações relevantes.

## 10. Critérios gerais de aceite

Uma entrega do produto somente é considerada aprovada quando:

- atende às regras deste PRD;
- impede acessos não autorizados no banco e no servidor, não apenas na interface;
- persiste dados após recarga, logout/login e nova sessão;
- mantém isolamento entre unidades;
- apresenta mensagens em português para erros esperados;
- possui testes proporcionais ao risco da alteração;
- é validada nos tamanhos de tela afetados;
- não inclui credenciais ou artefatos de build indevidos no controle de versão;
- mantém typecheck, lint e build aprovados.

## 11. Fora de escopo sem aprovação adicional

- Substituir sistemas externos de PDV, adquirência, gateway de assinaturas ou bancos.
- Enviar mensagens sem consentimento ou contornar limitações das plataformas.
- Reconhecer automaticamente decisões contábeis ou fiscais não definidas neste PRD.
- Conceder acesso global a um perfil vinculado a uma única unidade.
- Apagar definitivamente histórico financeiro ou de auditoria por ações comuns da interface.

## 12. Documentos relacionados

- [Plano progressivo de implementação](./tasks.md)
- [Cálculo de Comissão](./CALCULO_COMISSAO.md)
- [Relatório de testes de comissão](./RELATORIO_TESTES_COMISSAO.md)
