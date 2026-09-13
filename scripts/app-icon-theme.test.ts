import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

test('manifesto claro usa exclusivamente os ícones derivados da logo escura', () => {
  const manifest = readJson('public/manifest-light.json');
  assert.deepEqual(manifest.icons.map((icon: { src: string }) => icon.src), [
    '/icon-escura-192.png',
    '/icon-escura-512.png',
  ]);
});

test('manifesto escuro usa exclusivamente os ícones derivados da logo clara', () => {
  const manifest = readJson('public/manifest-dark.json');
  assert.deepEqual(manifest.icons.map((icon: { src: string }) => icon.src), [
    '/icon-clara-192.png',
    '/icon-clara-512.png',
  ]);
});

test('HTML alterna manifesto e ícone Apple pelo tema do aparelho', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(html, /darkScheme\.matches \? 'dark' : 'light'/);
  assert.match(html, /darkScheme\.matches \? '\/icon-clara-180\.png' : '\/icon-escura-180\.png'/);
  assert.match(html, /addEventListener\?\.\('change', syncAppIcons\)/);
});
