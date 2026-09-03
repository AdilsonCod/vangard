export const PERIODS = [
  { id: "P1", label: "Dia 1 ao 7", minDay: 7 },
  { id: "P2", label: "Dia 8 ao 14", minDay: 14 },
  { id: "P3", label: "Dia 15 ao 21", minDay: 21 },
  { id: "P4", label: "Dia 22 ao Fim do Mês", minDay: "LAST_DAY" },
];

export function getAvailablePeriods(year: number, month: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (year > currentYear || (year === currentYear && month > currentMonth))
    return [];

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return PERIODS;
  }

  // Current month
  return PERIODS.filter((p) => {
    if (p.minDay === "LAST_DAY") {
      const lastDay = new Date(year, month, 0).getDate();
      return currentDay >= lastDay;
    }
    return currentDay >= (p.minDay as number);
  });
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatEntryDate(dateStr: string) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(P[1-4])$/);
  if (match) {
    const period = PERIODS.find((p) => p.id === match[3]);
    const monthIndex = parseInt(match[2], 10) - 1;
    return `${period?.label} de ${MONTH_NAMES[monthIndex]} de ${match[1]}`;
  }
  return dateStr;
}

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function getDaysForPeriod(
  year: number,
  month: number,
  periodId: string,
) {
  const days: { date: number; weekday: string }[] = [];

  let startDay = 1;
  let endDay = 7;

  if (periodId === "P1") {
    startDay = 1;
    endDay = 7;
  } else if (periodId === "P2") {
    startDay = 8;
    endDay = 14;
  } else if (periodId === "P3") {
    startDay = 15;
    endDay = 21;
  } else if (periodId === "P4") {
    startDay = 22;
    endDay = new Date(year, month, 0).getDate();
  } else {
    return [];
  }

  for (let d = startDay; d <= endDay; d++) {
    const dateObj = new Date(year, month - 1, d);
    days.push({
      date: d,
      weekday: WEEKDAY_NAMES[dateObj.getDay()],
    });
  }

  return days;
}

export function getPeriodDaysInfo(
  dateStr: string,
  isDayOff: boolean,
  workedDays?: number[],
) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(P[1-4])$/);
  if (!match)
    return { workedCount: isDayOff ? 0 : 1, offCount: isDayOff ? 1 : 0 };
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const periodId = match[3];
  const totalDays = getDaysForPeriod(year, month, periodId).length;
  if (isDayOff) {
    return { workedCount: 0, offCount: totalDays };
  } else {
    const workedCount = workedDays ? workedDays.length : 0;
    const offCount = Math.max(0, totalDays - workedCount);
    return { workedCount, offCount };
  }
}
