import assert from 'node:assert/strict';
import { calculateQuarterlyRanking } from '../src/utils/quarterlyRanking';
import type { MonthlyBarberStats, User } from '../src/types';

const users = [
  { id: 'a', name: 'Ana', role: 'BARBER', unit: 'A' },
  { id: 'b', name: 'Beto', role: 'BARBER', unit: 'B' },
  { id: 'admin', name: 'Admin', role: 'ADMIN', unit: 'A' },
] as User[];
const row = (barberId: string, month: string, revenue: number, clients = 10) => ({ barberId, month, unitId: users.find(user => user.id === barberId)?.unit, faturamentoTotal: revenue, vendaProdutosValor: revenue / 10, clientesAtendidos: clients }) as MonthlyBarberStats;
const stats = [row('a', '2026-07', 100), row('a', '2026-08', 200), row('a', '2026-09', 300), row('a', '2026-10', 9999), row('a', '2025-07', 9999), row('b', '2026-08', 300), row('admin', '2026-08', 99999)];
const result = calculateQuarterlyRanking(stats, users, 2026, 8);
assert.deepEqual(result.months, ['2026-07', '2026-08', '2026-09']);
assert.equal(result.ranking.length, 2);
assert.equal(result.ranking[0].id, 'a');
assert.equal(result.ranking[0].revenue, 600);
assert.equal(result.ranking[0].ticket, 20);
assert.ok(Math.abs(result.ranking[0].score - (200 + 20 / 30 * 100)) < 0.001);
assert.equal(calculateQuarterlyRanking(stats, users, 2026, 8, 'B').ranking[0].score, 300);
assert.equal(calculateQuarterlyRanking([], users, 2026, 1).ranking.length, 0);
assert.equal(calculateQuarterlyRanking([row('a', '2026-01', 100, 0)], users, 2026, 1).ranking[0].ticket, 0);
assert.deepEqual(calculateQuarterlyRanking([], users, 2026, 12).months, ['2026-10', '2026-11', '2026-12']);
console.log('Ranking trimestral: período, soma, critérios, unidade, papéis e ausência de dados validados.');
