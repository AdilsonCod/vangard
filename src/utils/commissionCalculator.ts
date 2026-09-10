import type { CommissionBracket } from "../types";
import { calculateCommissionByRevenue } from "../services/financialEngine";

export type CommissionValidationResult = { valid: true } | { valid: false; message: string };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function validateCommissionBrackets(brackets: CommissionBracket[]): CommissionValidationResult {
  if (!brackets.length) return { valid: false, message: "Adicione pelo menos uma faixa de faturamento." };
  const sorted = [...brackets].sort((a, b) => a.minimumRevenue - b.minimumRevenue);
  for (const bracket of sorted) {
    if (!bracket.unitId) return { valid: false, message: "Toda faixa precisa estar vinculada a uma unidade." };
    if (!Number.isFinite(bracket.minimumRevenue) || !Number.isFinite(bracket.maximumRevenue) || bracket.minimumRevenue < 0 || bracket.maximumRevenue < 0) {
      return { valid: false, message: "Os valores das faixas devem ser números monetários não negativos." };
    }
    if (bracket.minimumRevenue >= bracket.maximumRevenue) {
      return { valid: false, message: `O valor inicial (${money(bracket.minimumRevenue)}) deve ser menor que o valor final.` };
    }
    if (!Number.isFinite(bracket.percentage) || bracket.percentage <= 0 || bracket.percentage > 100 || Math.round(bracket.percentage * 100) !== bracket.percentage * 100) {
      return { valid: false, message: "A comissão deve ser maior que 0%, no máximo 100% e ter até duas casas decimais." };
    }
  }
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].minimumRevenue <= sorted[index - 1].maximumRevenue) {
      return { valid: false, message: `As faixas iniciadas em ${money(sorted[index - 1].minimumRevenue)} e ${money(sorted[index].minimumRevenue)} estão sobrepostas.` };
    }
  }
  return { valid: true };
}

export function findCommissionBracket(revenue: number, brackets: CommissionBracket[]) {
  return [...brackets]
    .sort((a, b) => a.minimumRevenue - b.minimumRevenue)
    .find((bracket) => revenue >= bracket.minimumRevenue && revenue <= bracket.maximumRevenue);
}

export function calculateCommission(revenue: number, brackets: CommissionBracket[]) {
  return calculateCommissionByRevenue(revenue, brackets);
}

export function canAccessCommissionUnit(role: string, userUnit: string | null, requestedUnit: string) {
  return role === "ADMIN" || (role === "FINANCIAL" && (!userUnit || userUnit === requestedUnit)) || userUnit === requestedUnit;
}
