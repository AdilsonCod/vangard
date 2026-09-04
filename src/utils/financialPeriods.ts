type DatedRecord = {
  date?: string;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function getFinancialPeriod(date?: string): string | null {
  const match = date?.match(ISO_DATE_PATTERN);
  return match ? `${match[1]}-${match[2]}` : null;
}

export function getLatestFinancialPeriod(records: DatedRecord[]): string | null {
  const periods = records
    .map(record => getFinancialPeriod(record.date))
    .filter((period): period is string => period !== null);

  return periods.length > 0 ? periods.sort().at(-1) || null : null;
}

export function formatFinancialPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `${month}/${year}`;
}
