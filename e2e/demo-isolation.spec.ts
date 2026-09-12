import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
test(`simulação de unidades é local e descartada ao recarregar (${viewport.width}px)`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => localStorage.setItem('vans_e2e_role', 'ADMIN'));
  const writes: string[] = [];
  await page.route('**/firestore.googleapis.com/**', route => {
    if (/Write|commit/i.test(route.request().url())) writes.push(route.request().url());
    return route.abort();
  });
  const openUnits = async () => {
    if (viewport.width < 1280) await page.getByRole('button', { name: 'Abrir menu' }).click();
    const sidebar = page;
    await sidebar.getByRole('button', { name: 'Análises', exact: true }).click();
    await sidebar.getByRole('button', { name: 'Análise de Unidades', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Desempenho das unidades' })).toBeVisible();
  };
  await page.goto('/');
  await openUnits();
  await page.getByRole('button', { name: 'Demonstração', exact: true }).click();
  await page.getByRole('button', { name: /Simular Ano Completo/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'valores de exemplo' })).toBeVisible();
  await expect(page.getByText('Simulado', { exact: true })).toHaveCount(12);
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Demonstração', exact: true }).click();
  await page.getByRole('button', { name: /Limpar exemplos do ano/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Limpar demonstração', exact: true }).click();
  await expect(page.getByText('Simulado', { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Demonstração', exact: true }).click();
  await page.getByRole('button', { name: /Simular Ano Completo/ }).click();
  await expect(page.getByText('Simulado', { exact: true })).toHaveCount(12);
  await page.reload();
  await openUnits();
  await expect(page.getByText('Simulado', { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});

}
