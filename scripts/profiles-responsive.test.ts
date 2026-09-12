import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getAdminNavigation } from '../src/config/adminNavigation';
import { PROFILE_EXPECTATIONS, RESPONSIVE_VIEWPORTS } from '../src/config/responsiveProfiles';
import type { Role } from '../src/types';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = source('src/components/AdminDashboard.tsx');
const professional = source('src/components/BarberDashboard.tsx');
const financial = source('src/components/FinancialDashboard.tsx');
const reports = source('src/components/ReportsTab.tsx');
const units = source('src/components/UnitsAnalysisDashboard.tsx');

test('define os três tamanhos de validação sem lacunas', () => {
  assert.deepEqual(RESPONSIVE_VIEWPORTS.map(viewport => viewport.id), ['phone', 'tablet', 'desktop']);
  assert.ok(RESPONSIVE_VIEWPORTS[0].width < RESPONSIVE_VIEWPORTS[1].width);
  assert.ok(RESPONSIVE_VIEWPORTS[1].width < RESPONSIVE_VIEWPORTS[2].width);
});

test('todos os perfis possuem shell e módulos essenciais definidos', () => {
  const roles: Role[] = ['ADMIN', 'FINANCIAL', 'MARKETING', 'RECEPTION', 'BARBER', 'MANICURE'];
  assert.deepEqual(Object.keys(PROFILE_EXPECTATIONS).sort(), roles.sort());
  roles.forEach(role => assert.ok(PROFILE_EXPECTATIONS[role].requiredModules.length > 0, `${role} sem módulos`));
});

test('perfis gerenciais recebem somente módulos autorizados', () => {
  (['ADMIN', 'FINANCIAL', 'MARKETING', 'RECEPTION'] as Role[]).forEach(role => {
    const available = new Set(getAdminNavigation(role).map(item => item.id));
    PROFILE_EXPECTATIONS[role].requiredModules.forEach(module => assert.ok(available.has(module), `${role} não possui ${module}`));
  });
  assert.equal(getAdminNavigation('RECEPTION').some(item => item.id === 'PAYMENTS'), false);
  assert.equal(getAdminNavigation('MARKETING').some(item => item.id === 'FINANCE'), false);
});

test('shells alternam sidebar desktop e cabeçalho móvel no breakpoint correto', () => {
  [admin, professional].forEach(shell => {
    assert.match(shell, /app-sidebar hidden[\s\S]*xl:flex/);
    assert.match(shell, /app-global-header[\s\S]*xl:hidden/);
    assert.match(shell, /min-w-0/);
    assert.match(shell, /100dvh/);
  });
});

test('tabelas largas ficam contidas e controles se reorganizam no celular', () => {
  assert.match(financial, /overflow-x-auto/);
  assert.match(financial, /grid-cols-1[\s\S]*sm:/);
  assert.match(reports, /grid-cols-1[\s\S]*sm:grid-cols-2/);
  assert.match(professional, /hidden md:block[\s\S]*overflow-x-auto/);
});

test('gráficos possuem contêiner responsivo e altura definida', () => {
  [financial, units].forEach(component => {
    assert.match(component, /ResponsiveContainer/);
    assert.match(component, /(h-\[\d+px\]|height=\"100%\"|height=\{\d+\})/);
  });
});

test('interfaces principais contemplam carregamento, vazio, erro e dados', () => {
  const combined = [admin, professional, financial, reports, units].join('\n');
  assert.match(combined, /AppLoadingState|Carregando/);
  assert.match(combined, /AppEmptyState|Nenhum|Sem dados/);
  assert.match(combined, /error|Erro|Falha/);
  assert.match(combined, /\.map\(/);
});
