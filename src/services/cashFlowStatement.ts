import type { FinancialTransaction } from '../types';
import { resolveMovementNature } from './financialEngine';

export type DfcGroup = 'OPERATING' | 'INVESTING' | 'FINANCING';
export type DfcLine = { key: string; category: string; subcategory: string; inflow: number; outflow: number; balance: number; transactions: FinancialTransaction[] };
export type DfcSection = { group: DfcGroup; label: string; inflow: number; outflow: number; balance: number; lines: DfcLine[] };
export type CashFlowStatement = { openingBalance: number; periodInflow: number; periodOutflow: number; operatingCash: number; investingCash: number; financingCash: number; netChange: number; closingBalance: number; sections: DfcSection[]; ignoredCount: number; transactionCount: number };

const GROUP_LABELS: Record<DfcGroup, string> = { OPERATING: 'Atividades operacionais', INVESTING: 'Atividades de investimento', FINANCING: 'Atividades de financiamento' };
const investmentPattern = /equipamento|imobilizado|m[oó]vel|reforma|benfeitoria|obra|m[aá]quina|ve[ií]culo|investimento|ativo fixo/i;
const financingPattern = /empr[eé]stimo|financiamento|aporte|capital social|s[oó]cio|distribui[cç][aã]o|dividendo|retirada de lucro|amortiza[cç][aã]o/i;

export function isRealizedCashTransaction(transaction: FinancialTransaction) {
  return transaction.type === 'INCOME' ? transaction.status === 'RECEBIDO' : transaction.status === 'PAGO';
}

export function dfcGroupFor(transaction: FinancialTransaction): DfcGroup | null {
  const nature = resolveMovementNature(transaction);
  if (nature === 'INTERNAL_TRANSFER' || nature === 'COMMERCIAL_DISCOUNT' || nature === 'NON_FINANCIAL') return null;
  const searchable = `${transaction.category} ${transaction.classification || ''} ${transaction.subclassification || ''} ${transaction.description || ''}`;
  if (investmentPattern.test(searchable)) return 'INVESTING';
  if (financingPattern.test(searchable)) return 'FINANCING';
  return 'OPERATING';
}

function appliesToUnit(transaction: FinancialTransaction, unitId: string) {
  return unitId === 'ALL' ? true : transaction.unitId === unitId;
}

export function buildCashFlowStatement(transactions: FinancialTransaction[], options: { period: string; unitId: string; classificationNames?: Record<string, string>; subclassificationNames?: Record<string, string> }): CashFlowStatement {
  const classificationNames = options.classificationNames || {}, subclassificationNames = options.subclassificationNames || {};
  const scoped = transactions.filter(transaction => appliesToUnit(transaction, options.unitId));
  const cashTransactions = scoped.filter(isRealizedCashTransaction).map(transaction => ({ transaction, group: dfcGroupFor(transaction) }));
  const openingTransactions = cashTransactions.filter(item => item.group && item.transaction.date.slice(0, 7) < options.period);
  const periodTransactions = cashTransactions.filter(item => item.transaction.date.startsWith(options.period));
  const effect = (transaction: FinancialTransaction) => transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
  const openingBalance = openingTransactions.reduce((sum, item) => sum + effect(item.transaction), 0);
  const groups: DfcGroup[] = ['OPERATING', 'INVESTING', 'FINANCING'];
  const sections = groups.map(group => {
    const items = periodTransactions.filter(item => item.group === group).map(item => item.transaction);
    const lineMap = new Map<string, DfcLine>();
    items.forEach(transaction => {
      const category = classificationNames[transaction.classification || ''] || transaction.classification || transaction.category || 'Sem categoria';
      const subcategory = subclassificationNames[transaction.subclassification || ''] || transaction.subclassification || 'Sem subcategoria';
      const key = `${category}::${subcategory}`;
      const line = lineMap.get(key) || { key, category, subcategory, inflow: 0, outflow: 0, balance: 0, transactions: [] };
      if (transaction.type === 'INCOME') line.inflow += transaction.amount; else line.outflow += transaction.amount;
      line.balance = line.inflow - line.outflow;line.transactions.push(transaction);lineMap.set(key, line);
    });
    const lines = [...lineMap.values()].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    const inflow = lines.reduce((sum, line) => sum + line.inflow, 0), outflow = lines.reduce((sum, line) => sum + line.outflow, 0);
    return { group, label: GROUP_LABELS[group], inflow, outflow, balance: inflow - outflow, lines };
  });
  const periodInflow = sections.reduce((sum, section) => sum + section.inflow, 0), periodOutflow = sections.reduce((sum, section) => sum + section.outflow, 0), netChange = periodInflow - periodOutflow;
  return { openingBalance, periodInflow, periodOutflow, operatingCash: sections[0].balance, investingCash: sections[1].balance, financingCash: sections[2].balance, netChange, closingBalance: openingBalance + netChange, sections, ignoredCount: periodTransactions.filter(item => !item.group).length, transactionCount: periodTransactions.filter(item => item.group).length };
}
