# 🔧 Troubleshooting - Aplicação Não Funciona

## 🚨 Problemas Comuns e Soluções

### 1. Tela em Branco / Página Vazia

**Sintomas:**
- Navegador abre mas não mostra nada
- Tela totalmente branca
- Loading infinito

**Soluções:**

#### A. Verificar Console do Navegador
```
1. Pressione F12 (ou Ctrl+Shift+I)
2. Vá na aba "Console"
3. Procure por erros em vermelho
4. Copie a mensagem de erro
```

**Erros Comuns:**

```javascript
// Erro: Firebase not initialized
// Solução: Verificar firebase-applet-config.json

// Erro: Module not found
// Solução: npm install novamente

// Erro: Cannot read property of undefined
// Solução: Limpar cache do navegador
```

#### B. Limpar Cache e Recarregar
```
Windows Chrome/Edge:
Ctrl + Shift + Delete
Ou
Ctrl + F5 (hard refresh)

Firefox:
Ctrl + Shift + R
```

#### C. Verificar se Vite está compilando
```bash
# No terminal onde rodou npm run dev, procure por:
✓ ready in XXXms
```

---

### 2. Erro "Cannot connect to server"

**Sintomas:**
- Mensagem de erro de conexão
- API calls falhando

**Soluções:**

#### A. Verificar se servidor está rodando
```powershell
# Teste 1: Health check
Invoke-WebRequest -Uri "http://localhost:3000/api/health"
# Esperado: {"status":"ok"}

# Teste 2: Verificar porta 3000
netstat -ano | findstr :3000
# Se não aparecer nada, servidor não está rodando
```

#### B. Reiniciar o servidor
```powershell
# Parar: Ctrl + C no terminal
# Iniciar novamente:
npm run dev
```

---

### 3. Tela de Login não aparece / Erro de autenticação

**Sintomas:**
- Login não funciona
- Erro ao tentar fazer login
- Usuário não encontrado

**Solução:**

#### A. Verificar Firestore
```
1. Abrir Firebase Console: https://console.firebase.google.com
2. Ir no projeto: gen-lang-client-0595576094
3. Verificar Firestore Database
4. Verificar se existe coleção "users"
```

#### B. Seed do banco (se estiver vazio)
```bash
# No .env, temporariamente ativar:
VITE_ENABLE_DATABASE_SEED=true

# Reiniciar servidor
# Desativar novamente após criar dados iniciais
VITE_ENABLE_DATABASE_SEED=false
```

#### C. Criar usuário admin manualmente
```javascript
// No Firebase Console > Firestore
// Criar documento em "users":

{
  id: "admin_1",
  email: "admin@example.com",
  password: "admin123",
  name: "Administrador",
  role: "ADMIN",
  isActive: true,
  unitId: "ALL"
}
```

---

### 4. Erro "Module not found" ou "Cannot find module"

**Sintomas:**
- Erro no terminal ou navegador
- Imports não encontrados

**Solução:**

```bash
# 1. Limpar node_modules
Remove-Item -Recurse -Force node_modules

# 2. Limpar cache do npm
npm cache clean --force

# 3. Reinstalar dependências
npm install

# 4. Reiniciar servidor
npm run dev
```

---

### 5. Erro no Firebase / Firestore

**Sintomas:**
- "Firebase: Error (auth/...)"
- "Firestore: Permission denied"

**Solução:**

#### A. Verificar regras do Firestore
```javascript
// firestore.rules deve ter:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Durante desenvolvimento
    }
  }
}
```

#### B. Redeployar regras
```bash
# Se tiver Firebase CLI instalado
firebase deploy --only firestore:rules

# Ou fazer manualmente no console
# Firebase Console > Firestore > Rules > Publicar
```

---

### 6. Vite / Build errors

**Sintomas:**
- Erro ao compilar
- "Failed to resolve import"

**Solução:**

```bash
# 1. Verificar versão do Node
node --version
# Precisa ser >= 18.x

# 2. Limpar cache do Vite
Remove-Item -Recurse -Force node_modules/.vite

# 3. Reinstalar
npm install

# 4. Build limpo
npm run build
```

---

### 7. TypeScript errors

**Sintomas:**
- Erros de tipo no terminal
- "Type 'X' is not assignable to type 'Y'"

**Solução:**

```bash
# 1. Verificar tipos
npm run typecheck

# 2. Se muitos erros, pode ignorar temporariamente
# Comentar linha no package.json:
# "build": "vite build" (sem typecheck)

# 3. Reiniciar TypeScript server (se no VSCode)
# Ctrl+Shift+P > TypeScript: Restart TS Server
```

---

### 8. Porta 3000 já em uso

**Sintomas:**
- "Error: listen EADDRINUSE: address already in use :::3000"

**Solução:**

```powershell
# 1. Encontrar processo na porta 3000
netstat -ano | findstr :3000
# Pegar o PID (último número)

# 2. Matar processo
taskkill /PID [número] /F

# 3. Ou usar outra porta
# Editar server.ts: const PORT = 3001;
```

---

## 🔍 Diagnóstico Completo

Execute este script para diagnóstico completo:

```powershell
# Salvar como: diagnose.ps1

Write-Host "=== DIAGNÓSTICO VANGARD SISTEMA ===" -ForegroundColor Cyan

# 1. Versão do Node
Write-Host "`n[1] Node.js Version:" -ForegroundColor Yellow
node --version

# 2. Versão do npm
Write-Host "`n[2] npm Version:" -ForegroundColor Yellow
npm --version

# 3. Servidor está rodando?
Write-Host "`n[3] Servidor Status:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ Servidor ATIVO - Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Servidor INATIVO ou ERRO" -ForegroundColor Red
}

# 4. Porta 3000
Write-Host "`n[4] Porta 3000:" -ForegroundColor Yellow
$port = netstat -ano | findstr :3000
if ($port) {
    Write-Host "✅ Porta 3000 em uso" -ForegroundColor Green
    Write-Host $port
} else {
    Write-Host "❌ Porta 3000 livre (servidor não está rodando)" -ForegroundColor Red
}

# 5. Arquivo .env
Write-Host "`n[5] Arquivo .env:" -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "✅ .env existe" -ForegroundColor Green
    Write-Host "Conteúdo (sem valores sensíveis):"
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^=]+)=") {
            Write-Host "  $($matches[1])=***"
        }
    }
} else {
    Write-Host "❌ .env NÃO ENCONTRADO!" -ForegroundColor Red
    Write-Host "Copie .env.example para .env"
}

# 6. node_modules
Write-Host "`n[6] node_modules:" -ForegroundColor Yellow
if (Test-Path node_modules) {
    Write-Host "✅ node_modules existe" -ForegroundColor Green
    $packageCount = (Get-ChildItem node_modules -Directory).Count
    Write-Host "  $packageCount pacotes instalados"
} else {
    Write-Host "❌ node_modules NÃO ENCONTRADO!" -ForegroundColor Red
    Write-Host "Execute: npm install"
}

# 7. Firebase config
Write-Host "`n[7] Firebase Config:" -ForegroundColor Yellow
if (Test-Path firebase-applet-config.json) {
    Write-Host "✅ firebase-applet-config.json existe" -ForegroundColor Green
    $config = Get-Content firebase-applet-config.json | ConvertFrom-Json
    Write-Host "  projectId: $($config.projectId)"
} else {
    Write-Host "❌ firebase-applet-config.json NÃO ENCONTRADO!" -ForegroundColor Red
}

# 8. Sessão WhatsApp
Write-Host "`n[8] Sessão WhatsApp:" -ForegroundColor Yellow
if (Test-Path .whatsapp-session) {
    $fileCount = (Get-ChildItem .whatsapp-session -File).Count
    Write-Host "✅ .whatsapp-session existe ($fileCount arquivos)" -ForegroundColor Green
} else {
    Write-Host "⚠️  .whatsapp-session não existe (normal na primeira vez)" -ForegroundColor Yellow
}

Write-Host "`n=== FIM DO DIAGNÓSTICO ===" -ForegroundColor Cyan
```

**Executar:**
```powershell
.\diagnose.ps1
```

---

## 📋 Checklist de Verificação

Marque o que você já verificou:

```
[ ] Node.js >= 18.x instalado
[ ] npm install executado sem erros
[ ] Arquivo .env existe e configurado
[ ] firebase-applet-config.json existe
[ ] Servidor rodando (npm run dev)
[ ] Porta 3000 disponível
[ ] http://localhost:3000 abre no navegador
[ ] Console do navegador (F12) sem erros
[ ] Firestore configurado e acessível
```

---

## 🆘 Ainda não funciona?

### Coleta de Informações

Me envie essas informações para eu ajudar:

1. **Erro específico do navegador (F12 > Console)**
   ```
   [Cole aqui o erro completo]
   ```

2. **Output do terminal (servidor)**
   ```
   [Cole as últimas 20 linhas do npm run dev]
   ```

3. **Resultado do diagnóstico**
   ```powershell
   .\diagnose.ps1
   [Cole o resultado]
   ```

4. **O que você vê no navegador?**
   ```
   [ ] Tela em branco
   [ ] Tela de loading infinito
   [ ] Mensagem de erro específica: _______________
   [ ] Tela de login mas não funciona
   [ ] Outro: _______________
   ```

---

## 🔄 Solução Drástica (Last Resort)

Se nada funcionar, tente a reinstalação completa:

```powershell
# 1. Parar servidor (Ctrl+C)

# 2. Limpar tudo
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force .vite
Remove-Item package-lock.json

# 3. Reinstalar
npm install

# 4. Reiniciar
npm run dev

# 5. Abrir navegador em modo anônimo
# Ctrl+Shift+N (Chrome) ou Ctrl+Shift+P (Firefox)
# Ir para: http://localhost:3000
```

---

## 📞 Comandos Úteis de Diagnóstico

```powershell
# Ver processos Node rodando
Get-Process node

# Ver todas as portas em uso
netstat -ano | findstr LISTENING

# Testar conexão HTTP
Invoke-WebRequest -Uri "http://localhost:3000"

# Ver logs do Firestore (se tiver Firebase CLI)
firebase firestore:indexes

# Verificar variáveis de ambiente
Get-Content .env
```

---

**Criado:** 07/09/2026  
**Última atualização:** 07/09/2026
