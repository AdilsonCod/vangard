import type { MonthlyBarberStats, User } from '../types';

export function calculateQuarterlyRanking(stats: MonthlyBarberStats[], users: User[], year: number, month: number, unit = 'ALL') {
  const quarter = Math.ceil(month / 3);
  const start = (quarter - 1) * 3 + 1;
  const months = Array.from({ length: 3 }, (_, index) => `${year}-${String(start + index).padStart(2, '0')}`);
  const totals = new Map<string, { revenue: number; products: number; clients: number }>();
  stats.forEach(stat => {
    const user = users.find(item => item.id === stat.barberId);
    if (user?.role !== 'BARBER' || !months.includes(stat.month)) return;
    if (unit !== 'ALL' && stat.unitId !== unit && user.unit !== unit) return;
    const total = totals.get(stat.barberId) || { revenue: 0, products: 0, clients: 0 };
    total.revenue += stat.faturamentoTotal || 0;
    total.products += stat.vendaProdutosValor || 0;
    total.clients += stat.clientesAtendidos || 0;
    totals.set(stat.barberId, total);
  });
  const rows = [...totals].map(([id, total]) => ({ id, name: users.find(user => user.id === id)!.name, ...total, ticket: total.clients > 0 ? total.revenue / total.clients : 0 }));
  const maxRevenue = Math.max(1, ...rows.map(row => row.revenue));
  const maxProducts = Math.max(1, ...rows.map(row => row.products));
  const maxTicket = Math.max(1, ...rows.map(row => row.ticket));
  const ranking = rows.map(row => ({ ...row, score: row.revenue / maxRevenue * 100 + row.products / maxProducts * 100 + row.ticket / maxTicket * 100 }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
    .slice(0, 5);
  return { quarter, months, ranking };
}
