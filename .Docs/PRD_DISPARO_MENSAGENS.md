# Anexo do PRD — Plataforma de campanhas e mensagens

Este documento detalha o módulo de disparo previsto na seção 6.12 do [PRD principal](./prd.md). Em caso de conflito, prevalecem as regras de segurança, consentimento, isolamento por unidade e negação por padrão do PRD principal.

## 1. Objetivo

Transformar o disparo de mensagens em uma plataforma persistente de campanhas, capaz de sobreviver a reinícios do serviço no Railway, impedir duplicidades, isolar sessões por unidade e oferecer composição, agendamento, consentimento, monitoramento e auditoria completos.

## 2. Composição e contatos

- A mensagem aceita texto, múltiplas imagens e vídeos, com legenda individual, validação de extensão, MIME e tamanho no frontend e no backend, armazenamento privado e pré-visualização removível.
- A importação aceita CSV, XLSX, XLS e ODS, permite mapear colunas e extrai nome, telefone e variáveis personalizadas.
- Números são normalizados para o padrão internacional, inválidos são explicados e duplicados são consolidados antes da criação da campanha.
- O usuário pode adicionar clientes cadastrados, listas salvas e segmentos reutilizáveis sem planilha.
- Rascunhos e modelos de mensagem são persistentes, editáveis e isolados por unidade.
- Tags incluem primeiro nome, segundo nome e variáveis personalizadas. A mensagem final é materializada individualmente antes do envio.
- A interface apresenta pré-visualização com dados reais de um destinatário selecionado.

## 3. Campanha e fila persistente

- Campanhas e destinatários são documentos persistentes; a fila não pode depender da memória do processo.
- Estados de destinatário: `PENDENTE`, `PROCESSANDO`, `ENVIADO`, `ENTREGUE`, `LIDO`, `FALHOU` e `CANCELADO`.
- Cada destinatário possui chave de idempotência única por campanha, protegida por restrição lógica e gravação atômica.
- O worker reivindica o próximo destinatário elegível por transação ou lease, impedindo processamento simultâneo por duas instâncias.
- Ao iniciar, o worker recupera leases expirados em `PROCESSANDO` e continua itens `PENDENTE` sem reenviar itens concluídos.
- Falhas transitórias usam backoff exponencial e no máximo três tentativas. Falhas definitivas seguem para uma fila de erros consultável.
- Uma campanha pode ser agendada e recorrente. O cancelamento livre termina antes do primeiro envio; depois disso segue a política de interrupção auditada.
- Campanhas podem exigir aprovação de outro administrador antes de entrar na fila.

## 4. Sessões de WhatsApp

- Cada unidade ou número possui sessão independente, credenciais criptografadas e socket próprio.
- A sessão registra número, nome da conta, última conexão bem-sucedida, validade do QR, motivo real da desconexão e versão do serviço.
- O painel oferece conectar, reconectar, desconectar e gerar novo QR.
- Um bloqueio distribuído com lease impede duas instâncias de usarem a mesma sessão.
- QR, conexão e progresso são transmitidos em tempo real por SSE ou WebSocket; polling frequente não é permitido.
- Reinícios programados geram aviso prévio e drenam o worker com segurança.

## 5. Segurança de envio

- Não podem existir campanhas simultâneas para o mesmo número quando seus períodos de processamento se sobrepõem.
- A deduplicação considera campanhas recentes e a frequência máxima configurada por contato.
- Limites diários globais, por unidade e por conta bloqueiam novas reservas quando atingidos.
- Horário silencioso por unidade impede processamento, sem perder a posição da fila.
- Contas novas seguem aquecimento progressivo configurável.
- Taxa anormal de falhas pausa automaticamente a campanha e alerta administradores.
- Campanhas acima do limite de alto volume exigem confirmação digitada e aprovação quando configurada.
- Toda campanha permite envio de teste para um único número antes da liberação.

## 6. Consentimento, bloqueios e privacidade

- Cada contato registra origem, data e evidência do opt-in, além do histórico imutável de mudanças.
- A lista global “não enviar” prevalece sobre campanhas, segmentos, importações e agendamentos.
- Respostas com palavras de saída, incluindo SAIR, PARAR e CANCELAR, bloqueiam imediatamente o contato.
- A política de retenção exclui ou anonimiza telefones após o prazo definido, preservando apenas métricas e auditoria permitidas.
- Logs e telas sem necessidade operacional exibem telefones mascarados.
- Permissões distintas controlam criação, aprovação e execução de campanhas.

## 7. Monitoramento e relatórios

- Métricas por campanha e período incluem pendentes, processadas, enviadas, entregues, lidas, respondidas, falhas e canceladas.
- O painel mostra distribuição de falhas, tempo médio por mensagem, estimativa de término baseada no histórico e comparação entre campanhas.
- Desconexões anormais, bloqueios de conta e interrupções inesperadas geram alertas administrativos.
- Relatórios integrais são exportáveis em XLSX, CSV e PDF, respeitando escopo e mascaramento.
- O health check identifica versão do serviço, hash do commit, dependências essenciais e estado de drenagem, sem expor segredos.

## 8. Compatibilidade com Railway

- O serviço deve operar com mais de uma instância sem duplicar conexões ou envios.
- Nenhum estado indispensável pode residir somente em variáveis globais do processo.
- Reinício forçado durante uma campanha deve permitir retomada exata a partir do banco.
- Migrações são versionadas e reversíveis; mudanças de schema preservam campanhas históricas.

## 9. Qualidade obrigatória

- Cada entrega possui testes unitários e de integração proporcionais ao risco.
- Fila, idempotência, leases e retomada possuem testes concorrentes e de reinício.
- Parser de arquivos cobre formatos, mapeamento, duplicatas, números inválidos e arquivos maliciosos.
- Sessões e dados são testados com duas unidades e duas instâncias simuladas.
- Typecheck, lint, build e suítes afetadas devem passar antes de cada commit.

