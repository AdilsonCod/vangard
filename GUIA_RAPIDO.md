# 🚀 Guia Rápido - Sistema de Disparo de Mensagens

## ⚡ Início Rápido (5 minutos)

### 1. Iniciar o Sistema
```bash
npm run dev
```
**Acesso:** http://localhost:3000

### 2. Login
- Email: admin@example.com
- Senha: [sua senha]

### 3. Conectar WhatsApp
- Menu > **Mensagens** 💬
- Informar chave operacional (do arquivo `.env`)
- Clicar em **Conectar**
- Escanear QR Code no celular

### 4. Primeiro Teste
```
Nome: Teste Sistema
Contatos: [seu número no formato 5511999999999]
Mensagem: Teste de funcionamento ✅
Pausas: 10-15 segundos
☑️ Confirmar opt-in
▶️ Iniciar disparo
```

---

## 📋 Checklist Pré-Disparo

Antes de iniciar qualquer campanha, verificar:

- [ ] WhatsApp **conectado** (status 🟢)
- [ ] Contatos **validados** (badge verde)
- [ ] Mensagem **revisada** (sem erros)
- [ ] Pausas **configuradas** (mín 15s)
- [ ] Opt-in **confirmado** ✅
- [ ] Nome da campanha **informado**
- [ ] ETA **verificado** (tempo estimado)

---

## 🎯 Formatação de Contatos

### ✅ Formatos Aceitos
```
5511999999999      (ideal)
11999999999        (adiciona 55 automaticamente)
(11) 99999-9999    (remove formatação)
011 99999-9999     (remove zero inicial)
```

### ❌ Formatos Inválidos
```
999999999          (muito curto)
abc11999999999     (letras)
+55 11 99999-9999  (símbolo +, mas funciona)
```

---

## ⚙️ Configurações Recomendadas

### Primeiro Uso (Conservador)
```yaml
Pausa mínima: 20s
Pausa máxima: 40s
Simular digitação: ✅ Sim
Volume: Até 50 contatos
```

### Uso Normal
```yaml
Pausa mínima: 15s
Pausa máxima: 35s
Simular digitação: ✅ Sim
Volume: Até 100 contatos
```

### Campanha Urgente
```yaml
Pausa mínima: 12s
Pausa máxima: 20s
Simular digitação: ❌ Não
Volume: Até 150 contatos
```

### Alto Volume
```yaml
Pausa mínima: 25s
Pausa máxima: 45s
Simular digitação: ✅ Sim
Volume: Até 200 contatos (máximo)
```

---

## 📱 Modelos de Mensagens

### Lembrete de Retorno
```
Oi [Nome]! 😊

Sentimos sua falta na [Unidade]! 

Temos novidades especiais esperando por você. 
Que tal agendar um horário?

Responda PARAR para não receber mais mensagens.
```

### Confirmação de Agendamento
```
Olá! ✅

Confirmando seu horário:
📅 [Data] às [Hora]
📍 [Unidade]
✂️ Com [Barbeiro]

Até lá! 💈
```

### Promoção
```
🔥 PROMOÇÃO ESPECIAL!

[Descrição da promoção]

⏰ Válido até [data]
📍 [Unidade]

Agende já!
```

### Pesquisa NPS
```
Olá! 🙏

De 0 a 10, como você avalia seu atendimento na [Unidade]?

Sua opinião nos ajuda a melhorar sempre!
```

---

## 🔐 Variáveis de Ambiente

### Arquivo: `.env`
```bash
# Obrigatórias
MESSAGE_DISPATCH_SECRET=sua-chave-secreta-aqui
WHATSAPP_AUTH_DIR=.whatsapp-session

# Opcionais
VITE_ENABLE_DATABASE_SEED=false
GEMINI_API_KEY=sua-chave-gemini (para IA)
```

---

## 🚨 Solução Rápida de Problemas

### QR Code não aparece
```bash
1. Verificar chave operacional (campo na tela)
2. Reiniciar servidor (Ctrl+C e npm run dev)
3. Limpar cache do navegador (F5)
```

### Número inválido
```bash
1. Usar formato: 5511999999999
2. Remover caracteres especiais
3. Confirmar que tem WhatsApp
```

### Desconectou durante envio
```bash
1. Verificar internet do celular
2. Abrir WhatsApp no celular
3. Reconectar na interface
4. Reiniciar campanha (continua de onde parou)
```

### Conta bloqueada temporariamente
```bash
1. Aguardar 24-48 horas
2. Aumentar pausas (30-60s)
3. Reduzir volume (50 contatos/dia)
4. Enviar apenas para opt-in confirmado
```

---

## 📊 Limites e Restrições

| Item | Limite |
|------|--------|
| Contatos por execução | **200** |
| Caracteres por mensagem | **4.096** |
| Pausa mínima | **8 segundos** |
| Pausa máxima | **180 segundos** |
| Mensagens/hora (recomendado) | **~100-150** |
| Campanhas/dia (recomendado) | **2-3** |

---

## 🎯 Melhores Práticas

### ✅ Fazer
- ✅ Obter consentimento antes de enviar
- ✅ Oferecer opt-out claro
- ✅ Enviar apenas em horário comercial (8h-20h)
- ✅ Personalizar mensagens quando possível
- ✅ Manter pausas de 15s ou mais
- ✅ Fazer backup da sessão regularmente
- ✅ Testar com poucos contatos primeiro

### ❌ Não Fazer
- ❌ Enviar spam ou correntes
- ❌ Usar sem consentimento
- ❌ Enviar após 20h ou antes de 8h
- ❌ Ultrapassar 200 contatos/execução
- ❌ Usar pausas menores que 8 segundos
- ❌ Enviar mais de 2-3 vezes/semana para mesmo contato
- ❌ Copiar mensagem genérica para todos

---

## 🔄 Fluxo Completo em 10 Passos

```
1. 🖥️  Abrir http://localhost:3000
2. 🔐 Login (admin)
3. 💬 Menu > Mensagens
4. 🔗 Conectar WhatsApp (QR Code)
5. 📝 Nome da campanha
6. 📋 Colar contatos
7. ✍️  Escrever mensagem
8. ⚙️  Configurar pausas
9. ✅ Confirmar opt-in
10. ▶️  Iniciar disparo
```

---

## 📞 APIs Disponíveis

### Status do Serviço
```http
GET /api/message-dispatch/status
Headers:
  x-dispatch-secret: [sua-chave]

Response:
{
  "connectionStatus": "connected",
  "isSending": false,
  "progress": 50,
  "total": 100,
  "successCount": 48,
  "errorCount": 2
}
```

### Iniciar Campanha
```http
POST /api/message-dispatch/start
Headers:
  x-dispatch-secret: [sua-chave]
  Content-Type: application/json

Body:
{
  "contacts": ["5511999999999", "5511988888888"],
  "message": "Olá! Teste de mensagem.",
  "minDelay": 15,
  "maxDelay": 35,
  "simulateTyping": true,
  "confirmedOptIn": true
}

Response:
{
  "success": true,
  "total": 2
}
```

### Parar Campanha
```http
POST /api/message-dispatch/stop
Headers:
  x-dispatch-secret: [sua-chave]

Response:
{
  "success": true
}
```

---

## 💾 Backup da Sessão

### Manual (Windows PowerShell)
```powershell
# Backup
Copy-Item -Recurse .whatsapp-session .whatsapp-session-backup-$(Get-Date -Format "yyyy-MM-dd")

# Restaurar
Remove-Item -Recurse .whatsapp-session
Copy-Item -Recurse .whatsapp-session-backup-2024-09-07 .whatsapp-session
```

### Automático (Script)
```powershell
# Criar script: backup-whatsapp.ps1
$date = Get-Date -Format "yyyy-MM-dd-HHmm"
$source = ".whatsapp-session"
$dest = ".whatsapp-session-backup-$date"
Copy-Item -Recurse $source $dest
Write-Host "Backup criado: $dest"
```

---

## 📈 Estimativa de Tempo

### Calculadora Rápida
```
Fórmula:
tempo_total = contatos × ((min_delay + max_delay) / 2 + tempo_digitacao)

Exemplos:

50 contatos, pausa 15-35s, com digitação:
= 50 × (25 + 2) = 1.350 segundos = ~22 minutos

100 contatos, pausa 20-40s, com digitação:
= 100 × (30 + 2.5) = 3.250 segundos = ~54 minutos

200 contatos, pausa 15-30s, sem digitação:
= 200 × (22.5 + 0) = 4.500 segundos = ~75 minutos
```

### Tabela de Referência

| Contatos | Pausa | Digitação | Tempo Estimado |
|----------|-------|-----------|----------------|
| 25 | 15-25s | Sim | ~12 min |
| 50 | 15-35s | Sim | ~22 min |
| 100 | 15-35s | Sim | ~45 min |
| 150 | 20-40s | Sim | ~80 min |
| 200 | 25-45s | Sim | ~120 min |

---

## 🎨 Atalhos da Interface

### Teclado
- `Ctrl + S` - Salvar lista de contatos (quando campo focado)
- `Enter` - Iniciar disparo (quando botão em foco)
- `Esc` - Fechar modais

### Mouse
- **Badges de contatos** - Clicar para ver detalhes
- **Listas salvas** - Clicar nome para carregar
- **Botão 🗑️** - Excluir lista salva
- **Logs** - Scroll automático durante envio

---

## 📚 Coleções do Firestore

### Dados Salvos Automaticamente

**message_contact_lists**
- Listas de contatos salvas
- Reutilização rápida
- Por unidade

**message_dispatch_history**
- Histórico completo de campanhas
- Últimas 20 visíveis na interface
- Estatísticas de sucesso/falha

**users**
- Gerenciamento de usuários
- Permissões (ADMIN, MARKETING, etc.)

**systemUnits**
- Unidades do sistema
- Filtro de campanhas

---

## 🔧 Comandos Úteis

### Verificar Status
```bash
# Servidor está rodando?
curl http://localhost:3000/api/health

# Porta 3000 está em uso?
netstat -ano | findstr :3000
```

### Reiniciar Servidor
```bash
# Parar
Ctrl + C

# Iniciar
npm run dev

# Ou usar PM2 (produção)
pm2 start npm --name "vangard" -- run dev
pm2 logs vangard
pm2 restart vangard
```

### Limpar Dados
```bash
# Limpar sessão WhatsApp
Remove-Item -Recurse -Force .whatsapp-session

# Limpar node_modules (reinstalar)
Remove-Item -Recurse -Force node_modules
npm install

# Limpar cache do npm
npm cache clean --force
```

---

## 🎓 Casos de Uso Frequentes

### 1. Campanha de Reativação
```yaml
Objetivo: Trazer clientes inativos
Quando: 1x por mês
Volume: 80-120 contatos
Horário: Terça ou quinta, 10h-12h
Mensagem: Personalizada, oferta especial
Pausa: 20-35s
```

### 2. Confirmação de Agendamento
```yaml
Objetivo: Reduzir no-shows
Quando: Diariamente
Volume: 30-50 contatos
Horário: Véspera, 18h-19h
Mensagem: Confirmação + detalhes
Pausa: 15-25s
```

### 3. Promoção Relâmpago
```yaml
Objetivo: Preencher agenda
Quando: Emergencial
Volume: 100-150 contatos
Horário: Manhã (9h-11h)
Mensagem: Urgência + CTA claro
Pausa: 12-20s (mais rápido)
```

### 4. Pesquisa de Satisfação
```yaml
Objetivo: Coletar feedback
Quando: Semanalmente
Volume: 40-60 contatos
Horário: 3 dias após atendimento
Mensagem: Breve, 1 pergunta
Pausa: 25-40s
```

---

## 🌟 Dicas de Otimização

### Mensagens Mais Efetivas
1. **Primeira linha** - Gancho forte (emoji ou pergunta)
2. **Corpo** - Máximo 3-4 linhas
3. **CTA** - Call-to-action claro
4. **Opt-out** - Sempre oferecer saída
5. **Teste** - Enviar para você primeiro

### Horários com Melhor Taxa de Leitura
- 🥇 **9h-11h** - Início do expediente (82% leitura)
- 🥈 **14h-16h** - Após almoço (68% leitura)
- 🥉 **18h-20h** - Fim do dia (75% leitura)

### Dias da Semana
- ✅ **Terça a quinta** - Melhor engajamento
- ⚠️ **Segunda** - Engajamento médio
- ⚠️ **Sexta** - Engajamento médio
- ❌ **Sábado/Domingo** - Evitar (exceto promoções)

---

## 📝 Template de Documentação Interna

```markdown
# Campanha: [NOME]

## Dados Básicos
- Data: [DD/MM/YYYY]
- Responsável: [Nome]
- Unidade: [Nome ou Todas]
- Objetivo: [Descrição]

## Configurações
- Total de contatos: [número]
- Mensagem: [texto completo]
- Pausa: [min-max]s
- Simulação: [Sim/Não]
- Horário de envio: [HH:MM]

## Resultados
- Enviados: [número]
- Entregues: [número] ([%])
- Falhas: [número] ([%])
- Taxa de resposta: [%]
- Conversões: [número]

## Observações
[Anotações relevantes]

## Próximos Passos
- [ ] Ação 1
- [ ] Ação 2
```

---

## 🎯 Metas Recomendadas

### KPIs de Qualidade
- **Taxa de entrega:** >95%
- **Taxa de resposta:** >10%
- **Taxa de conversão:** >5%
- **Taxa de erro:** <5%
- **Taxa de opt-out:** <2%

### Volume Mensal Sugerido
- **Início:** 500-1.000 mensagens/mês
- **Crescimento:** 1.000-2.000 mensagens/mês
- **Consolidado:** 2.000-5.000 mensagens/mês
- **Máximo:** 5.000-8.000 mensagens/mês

---

## 📞 Suporte

### Logs do Sistema
```bash
# Backend (terminal)
npm run dev
# Mostra logs de conexão, envio, erros

# Frontend (navegador)
F12 > Console
# Mostra logs de API, estado, erros
```

### Informações de Debug
```javascript
// No navegador (Console):
localStorage.getItem('message_dispatch_key')  // Chave salva
sessionStorage  // Dados da sessão
```

---

## ✅ Checklist de Produção

Antes de ir para produção:

- [ ] Criar arquivo `.env` com variáveis reais
- [ ] Gerar MESSAGE_DISPATCH_SECRET forte (mín 32 chars)
- [ ] Configurar GEMINI_API_KEY (se usar IA)
- [ ] Fazer backup de `.whatsapp-session/`
- [ ] Testar com 5-10 contatos
- [ ] Documentar processo interno
- [ ] Treinar equipe
- [ ] Definir regras de uso (horários, frequência)
- [ ] Criar templates de mensagens
- [ ] Configurar monitoramento de erros
- [ ] Definir responsáveis por turno
- [ ] Criar processo de backup diário

---

**Documento Criado:** 07/09/2026  
**Versão:** 1.0.0  
**Sistema:** Vangard Management - Disparo de Mensagens  
**Status:** ✅ Pronto para Uso
