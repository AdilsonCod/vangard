import { FinancialTransaction } from '../types';

export function inferFinancialSourceChannel(transaction: FinancialTransaction): NonNullable<FinancialTransaction['sourceChannel']> {
  if (transaction.sourceChannel) return transaction.sourceChannel;
  const text = `${transaction.category} ${transaction.description} ${transaction.classification || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (text.includes('assinatura') || text.includes('gateway')) return 'SUBSCRIPTION_GATEWAY';
  if (text.includes('gorjeta')) return 'TIP';
  if (text.includes('cortesia') || text.includes('desconto')) return 'COURTESY';
  if (text.includes('vale')) return 'VOUCHER';
  if (text.includes('dinheiro') || text.includes('especie') || text.includes('caixa fisico')) return 'CASH';
  if (text.includes('pix')) return 'DIRECT_PIX';
  if (text.includes('cartao') || text.includes('rede') || text.includes('adquirente')) return 'CARD_MACHINE';
  return 'OTHER';
}

export function formatFinancialTransactionDate(value?: string): string {
  if (!value) return 'Não informado';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}
