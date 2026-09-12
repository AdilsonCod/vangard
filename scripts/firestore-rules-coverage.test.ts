import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const ruleCollections = new Set([...rules.matchAll(/match \/([A-Za-z][A-Za-z0-9_]*)\//g)].map(match => match[1]));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function referencedCollections(): Set<string> {
  const found = new Set<string>();
  for (const path of [...sourceFiles(join(root, 'src')), ...sourceFiles(join(root, 'api')), join(root, 'server.ts'), join(root, 'message-dispatch-service.ts')]) {
    const source = readFileSync(path, 'utf8');
    for (const pattern of [
      /(?:collection|doc)\(\s*db\s*,\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g,
      /scopedCollectionQuery\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g,
      /\.collection\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]\s*\)/g,
      /getUnit(?:Scoped|OrGlobal)Query\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]\s*\)/g,
    ]) for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return found;
}

test('toda coleção usada pela aplicação possui regra explícita', () => {
  const used = referencedCollections();
  const missing = [...used].filter(name => !ruleCollections.has(name)).sort();
  assert.deepEqual(missing, [], `Coleções sem regra explícita: ${missing.join(', ')}`);
  assert.ok(used.size >= 30, `Inventário inesperadamente pequeno: ${used.size} coleções`);
});

test('fallback nega coleções não inventariadas', () => {
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
});
