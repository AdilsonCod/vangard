import path from 'node:path';
import { expect, test } from '@playwright/test';

test('personaliza os logos claro e escuro e preserva a escolha após recarga', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('vans_e2e_role', 'ADMIN'));
  await page.goto('/');

  const sidebar = page.locator('aside.app-sidebar');
  await sidebar.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();

  await page.getByLabel('Logo — Fundo (Modo Claro)').setInputFiles(path.resolve('public/logo-clara.png'));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('barber_logo_light'))).toMatch(/^data:image\/webp;base64,/);
  const savedLightLogo = await page.evaluate(() => localStorage.getItem('barber_logo_light'));

  await page.reload();
  await expect(page.locator('aside.app-sidebar img.block.dark\\:hidden').first()).toHaveAttribute('src', savedLightLogo!);

  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await sidebar.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Logo — Fundo (Modo Escuro)').setInputFiles(path.resolve('public/logo-escura.png'));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('barber_logo_dark'))).toMatch(/^data:image\/webp;base64,/);

  await page.getByRole('button', { name: 'Restaurar padrão' }).first().click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('barber_logo_light'))).toBe('/logo-escura.png');
});
