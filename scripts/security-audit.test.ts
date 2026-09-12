import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firestore nega coleções desconhecidas e não confia apenas em claims', () => {
  const rules = read('firestore.rules');
  assert.doesNotMatch(rules, /allow\s+(read|write|read,\s*write)\s*:\s*if\s+true/);
  assert.match(rules, /function hasActiveProfile\(\)/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  assert.doesNotMatch(rules, /request\.auth\.token\.role/);
});

test('segredos permanecem fora dos arquivos versionados e do bundle', () => {
  const listed = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  assert.equal(listed.status, 0);
  const files = listed.stdout.split('\0').filter(Boolean);
  assert.equal(files.includes('.env'), false);

  const secretPatterns = [
    /sk-[A-Za-z0-9_-]{24,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /"private_key"\s*:\s*"-----BEGIN/,
    /VITE_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY)\s*=/,
  ];
  const bundleFiles = existsSync('dist')
    ? readdirSync('dist', { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => `${entry.parentPath.replaceAll('\\', '/')}/${entry.name}`)
    : [];
  const inspected = [...files.filter(file => !file.endsWith('package-lock.json')), ...bundleFiles];
  for (const file of inspected) {
    let content = '';
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    for (const pattern of secretPatterns) assert.doesNotMatch(content, pattern, `possível segredo em ${file}`);
  }
});

test('servidores e Vercel aplicam cabeçalhos mínimos de segurança', () => {
  const sources = [read('server.ts'), read('message-service-server.ts'), read('vercel.json')];
  for (const source of sources) {
    for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      assert.match(source, new RegExp(header), `${header} ausente`);
    }
  }
  assert.match(sources[2], /Strict-Transport-Security/);
});

test('dependências de produção não possuem vulnerabilidades altas ou críticas', () => {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm audit --omit=dev --json']
    : ['audit', '--omit=dev', '--json'];
  const audit = spawnSync(command, args, { encoding: 'utf8' });
  const report = JSON.parse(audit.stdout || '{}');
  const vulnerabilities = report.metadata?.vulnerabilities ?? {};
  assert.equal(vulnerabilities.high ?? 0, 0);
  assert.equal(vulnerabilities.critical ?? 0, 0);
});
