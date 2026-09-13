import { expect, test } from '@playwright/test';

test('ícones do aplicativo acompanham o tema do aparelho', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const manifest = page.locator('#app-manifest');
  const touchIcon = page.locator('link[rel="apple-touch-icon"]:not([media])');
  await expect(manifest).toHaveAttribute('href', '/manifest-dark.json');
  await expect(touchIcon).toHaveAttribute('href', '/icon-clara-180.png');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(manifest).toHaveAttribute('href', '/manifest-light.json');
  await expect(touchIcon).toHaveAttribute('href', '/icon-escura-180.png');

  const lightManifest = await (await page.request.get('/manifest-light.json')).json();
  const darkManifest = await (await page.request.get('/manifest-dark.json')).json();
  expect(lightManifest.icons.every((icon: { src: string }) => icon.src.includes('escura'))).toBe(true);
  expect(darkManifest.icons.every((icon: { src: string }) => icon.src.includes('clara'))).toBe(true);
});
