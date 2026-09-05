import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

await build({
  entryPoints: ['src/components/QuarterlyRanking.tsx'], bundle: true,
  platform: 'node', format: 'cjs', packages: 'external', outfile: 'tmp/quarterly-ranking-ui.cjs',
  plugins: [{ name: 'isolated-store', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/store$/ }, () => ({ path: 'test-store', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const useStore = () => globalThis.__rankingTestStore;', loader: 'js' }));
  } }],
});
const require = createRequire(import.meta.url);
const { QuarterlyRanking } = require('../tmp/quarterly-ranking-ui.cjs');
const render = (visible, role, management = false) => {
  globalThis.__rankingTestStore = {
    currentUser: { id: 'test', role }, users: [], monthlyBarberStats: [], quarterlyRankingVisible: visible,
    setQuarterlyRankingVisible: () => { throw new Error('Rendering must never write settings'); },
  };
  return renderToStaticMarkup(React.createElement(QuarterlyRanking, { year: 2026, month: 8, management }));
};
assert.equal(render(false, 'BARBER'), '');
assert.equal(render(null, 'BARBER'), '');
assert.match(render(true, 'BARBER'), /3º trimestre de 2026/);
assert.doesNotMatch(render(true, 'BARBER'), /Ocultar para barbeiros/);
assert.match(render(false, 'ADMIN', true), /Mostrar para barbeiros/);
assert.match(render(true, 'ADMIN', true), /Ocultar para barbeiros/);
assert.doesNotMatch(render(true, 'FINANCIAL', true), /Ocultar para barbeiros/);
delete globalThis.__rankingTestStore;
console.log('Visibilidade trimestral: oculto, carregamento, barbeiro, gerência e demais papéis validados sem acesso ao banco.');
