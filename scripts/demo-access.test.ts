import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canUseDemoControls } from '../src/services/demoAccess';

test('ambiente de desenvolvimento permite ferramentas controladas de demonstração', () => {
  assert.equal(canUseDemoControls({ isDevelopment: true, explicitAdminPermission: false, role: 'RECEPTION' }), true);
  assert.equal(canUseDemoControls({ isDevelopment: true, explicitAdminPermission: false, role: 'BARBER' }), true);
  assert.equal(canUseDemoControls({ isDevelopment: true, explicitAdminPermission: false, role: 'FINANCIAL' }), true);
});

test('produção oculta demonstração de todos os usuários comuns mesmo com flag administrativa', () => {
  for (const role of ['BARBER', 'MANICURE', 'FINANCIAL', 'MARKETING', 'RECEPTION'] as const) {
    assert.equal(canUseDemoControls({ isDevelopment: false, explicitAdminPermission: true, role }), false);
    assert.equal(canUseDemoControls({ isDevelopment: false, explicitAdminPermission: false, role }), false);
  }
});

test('produção exige simultaneamente perfil administrador e habilitação explícita', () => {
  assert.equal(canUseDemoControls({ isDevelopment: false, explicitAdminPermission: false, role: 'ADMIN' }), false);
  assert.equal(canUseDemoControls({ isDevelopment: false, explicitAdminPermission: true, role: 'ADMIN' }), true);
});

test('componentes críticos protegem visualização e execução de simulações com demoControlsEnabledFor', () => {
  const smartLinksCode = readFileSync(new URL('../src/components/SmartLinksDashboard.tsx', import.meta.url), 'utf8');
  assert.match(smartLinksCode, /demoControlsEnabledFor/);
  assert.match(smartLinksCode, /demoAllowed/);
  assert.match(smartLinksCode, /demoAllowed\s*\?\s*\(\)\s*=>\s*setSimulation/);

  const unitsCode = readFileSync(new URL('../src/components/UnitsAnalysisDashboard.tsx', import.meta.url), 'utf8');
  assert.match(unitsCode, /demoControlsEnabledFor/);
  assert.match(unitsCode, /demoAllowed/);
  assert.match(unitsCode, /if\s*\(\s*!demoAllowed\s*\)\s*return;/);
  assert.match(unitsCode, /simulated:\s*true/);

  const bankRecCode = readFileSync(new URL('../src/components/BankReconciliation.tsx', import.meta.url), 'utf8');
  assert.match(bankRecCode, /demoControlsEnabledFor/);
  assert.match(bankRecCode, /demoAllowed/);
  assert.match(bankRecCode, /isDemoSession/);

  const fintechRecCode = readFileSync(new URL('../src/components/FintechReconciliation.tsx', import.meta.url), 'utf8');
  assert.match(fintechRecCode, /demoControlsEnabledFor/);
  assert.match(fintechRecCode, /demoAllowed/);
  assert.match(fintechRecCode, /isDemoSession/);
});

test('backend do serviço de links inteligentes bloqueia simulações em produção sem permissão', () => {
  const serviceCode = readFileSync(new URL('../smart-links-service.ts', import.meta.url), 'utf8');
  assert.match(serviceCode, /isSimulationAllowed/);
  assert.match(serviceCode, /simulated-click/);
  assert.match(serviceCode, /simulated:\s*true/);
});

test('seed automático do banco é restrito e inativo por padrão em produção', () => {
  const storeCode = readFileSync(new URL('../src/store.tsx', import.meta.url), 'utf8');
  assert.match(storeCode, /SHOULD_SEED_DATABASE\s*=\s*import\.meta\.env\.DEV\s*&&/);
});
