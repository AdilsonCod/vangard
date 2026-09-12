import { expect, test, type Page } from '@playwright/test';
import { PROFILE_EXPECTATIONS, RESPONSIVE_VIEWPORTS } from '../src/config/responsiveProfiles';
import type { Role } from '../src/types';

async function openAs(page: Page, role: Role, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(selectedRole => {
    localStorage.removeItem('vans_e2e_disabled');
    localStorage.setItem('vans_e2e_role', selectedRole);
  }, role);
  await page.goto('/');
  await expect(page.getByTestId(PROFILE_EXPECTATIONS[role].shell === 'management' ? 'management-shell' : 'professional-shell')).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('login permanece utilizável em telefone, tablet e desktop', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vans_e2e_disabled', 'true'));
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: "Van's Management" })).toBeVisible();
    await expect(page.getByPlaceholder(/Digite seu email/)).toBeVisible();
    await expect(page.getByPlaceholder('Sua senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar no Painel' })).toBeVisible();
    await expectNoPageOverflow(page);
  }
});

for (const role of Object.keys(PROFILE_EXPECTATIONS) as Role[]) {
  test(`${role} abre no shell autorizado sem controles fora da tela`, async ({ page }) => {
    await openAs(page, role, RESPONSIVE_VIEWPORTS[2]);
    await expectNoPageOverflow(page);
  });
}

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test(`navegação administrativa funciona em ${viewport.id}`, async ({ page }) => {
    await openAs(page, 'ADMIN', viewport);
    if (viewport.width < 1280) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(page.getByPlaceholder('Buscar páginas...')).toBeVisible();
    } else {
      await expect(page.locator('aside.app-sidebar')).toBeVisible();
    }
    await expectNoPageOverflow(page);
  });

  test(`navegação profissional funciona em ${viewport.id}`, async ({ page }) => {
    await openAs(page, 'BARBER', viewport);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Meu desempenho' })).toBeVisible();
    if (viewport.width < 1280) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(page.getByText('Rankings', { exact: true }).last()).toBeVisible();
    } else {
      await expect(page.locator('aside.app-sidebar')).toBeVisible();
    }
    await expectNoPageOverflow(page);
  });
}

test('gráficos e tabelas mantêm contêineres acessíveis no navegador real', async ({ page }) => {
  await openAs(page, 'ADMIN', RESPONSIVE_VIEWPORTS[2]);
  await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
  await expect(page.getByText('Atividade recente', { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});

test('modal destrutivo abre, pode ser cancelado e preserva a navegação', async ({ page }) => {
  await openAs(page, 'ADMIN', RESPONSIVE_VIEWPORTS[2]);
  const sidebar = page.locator('aside.app-sidebar');
  await sidebar.getByRole('button', { name: 'Catálogo', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Serviços', exact: true }).click();
  await page.getByLabel('Selecionar Corte').check();
  await page.getByRole('button', { name: /Excluir selecionados/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar exclusão' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Selecionar Corte')).toBeChecked();
});

test('tabela financeira permanece contida no viewport desktop', async ({ page }) => {
  await openAs(page, 'ADMIN', RESPONSIVE_VIEWPORTS[2]);
  const sidebar = page.locator('aside.app-sidebar');
  await sidebar.getByRole('button', { name: 'Financeiro', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Conciliação', exact: true }).click();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expectNoPageOverflow(page);
});
