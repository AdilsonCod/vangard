import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LOGO_FILE_BYTES, validateLogoFile } from '../src/services/logoCustomization';

test('aceita os formatos de imagem permitidos dentro do limite', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(validateLogoFile({ type, size: MAX_LOGO_FILE_BYTES }), null);
  }
});

test('recusa formatos não suportados e imagens acima de 3 MB', () => {
  assert.match(validateLogoFile({ type: 'image/svg+xml', size: 100 }) || '', /PNG, JPG ou WebP/);
  assert.match(validateLogoFile({ type: 'image/png', size: MAX_LOGO_FILE_BYTES + 1 }) || '', /máximo 3 MB/);
});
