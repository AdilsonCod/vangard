import assert from "node:assert/strict";
import test from "node:test";
import { calculateCommission, canAccessCommissionUnit, validateCommissionBrackets } from "../src/utils/commissionCalculator";
import type { CommissionBracket } from "../src/types";

const ranges: CommissionBracket[] = [
  { id: "a", unitId: "matriz", minimumRevenue: 0, maximumRevenue: 9999.99, percentage: 30 },
  { id: "b", unitId: "matriz", minimumRevenue: 10000, maximumRevenue: 19999.99, percentage: 35.5 },
  { id: "c", unitId: "matriz", minimumRevenue: 20000, maximumRevenue: 999999, percentage: 40 },
];

test("aplica a porcentagem correta e respeita os limites inclusivos", () => {
  assert.deepEqual(calculateCommission(0, ranges), { bracket: ranges[0], percentage: 30, commission: 0 });
  assert.equal(calculateCommission(9999.99, ranges).commission, 3000);
  assert.equal(calculateCommission(10000, ranges).commission, 3550);
  assert.equal(calculateCommission(20000, ranges).commission, 8000);
});

test("não calcula quando o faturamento fica fora das faixas", () => {
  assert.equal(calculateCommission(1000000, ranges).commission, 0);
});

test("rejeita sobreposição, percentuais inválidos e limites incoerentes", () => {
  assert.equal(validateCommissionBrackets([...ranges, { id: "x", unitId: "matriz", minimumRevenue: 9000, maximumRevenue: 11000, percentage: 10 }]).valid, false);
  assert.equal(validateCommissionBrackets([{ ...ranges[0], maximumRevenue: 10000 }, ranges[1]]).valid, false);
  assert.equal(validateCommissionBrackets([{ ...ranges[0], percentage: 100.001 }]).valid, false);
  assert.equal(validateCommissionBrackets([{ ...ranges[0], minimumRevenue: 100, maximumRevenue: 100 }]).valid, false);
  assert.equal(validateCommissionBrackets([{ ...ranges[0], minimumRevenue: -1 }]).valid, false);
});

test("isola unidades para perfis vinculados e permite visão gerencial", () => {
  assert.equal(canAccessCommissionUnit("BARBER", "matriz", "filial"), false);
  assert.equal(canAccessCommissionUnit("FINANCIAL", "matriz", "filial"), false);
  assert.equal(canAccessCommissionUnit("FINANCIAL", "matriz", "matriz"), true);
  assert.equal(canAccessCommissionUnit("ADMIN", null, "filial"), true);
});
