import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export function whatsappSessionScope(unitId: string, userId: string) {
  const unit = unitId.trim();
  const user = userId.trim();
  if (!unit || unit === "ALL") throw new Error("Selecione uma unidade específica para conectar o WhatsApp.");
  if (!user) throw new Error("Usuário autenticado é obrigatório para conectar o WhatsApp.");
  return `${unit}:${user}`;
}

export function whatsappSessionDocumentId(unitId: string, userId: string) {
  return createHash("sha256").update(whatsappSessionScope(unitId, userId)).digest("hex").slice(0, 40);
}

export function whatsappSessionVaultPath(baseVault: string, unitId: string, userId = "legacy-unit-session") {
  const scope = createHash("sha256").update(whatsappSessionScope(unitId, userId)).digest("hex").slice(0, 32);
  return join(dirname(baseVault), "sessions", `${scope}.enc`);
}

export class UnitSessionRegistry<T> {
  private readonly sessions = new Map<string, T>();
  constructor(private readonly factory: (unitId: string) => T) {}
  get(unitId: string) {
    const normalized = unitId.trim();
    if (!normalized || normalized === "ALL") throw new Error("Selecione uma unidade específica para conectar o WhatsApp.");
    const existing = this.sessions.get(normalized);
    if (existing) return existing;
    const created = this.factory(normalized);
    this.sessions.set(normalized, created);
    return created;
  }
  existing(unitId: string) {
    return this.sessions.get(unitId.trim());
  }
  values() {
    return [...this.sessions.values()];
  }
  delete(unitId: string) {
    return this.sessions.delete(unitId.trim());
  }
}
