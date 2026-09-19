export const MESSAGE_DRAFT_COLLECTION = 'message_drafts';
export const MESSAGE_TEMPLATE_COLLECTION = 'message_templates';

export type MessagePersonalizationData = { name?: string; variables?: Record<string, string> };

const safe = (value: unknown, fallback: string) => String(value ?? '').trim() || fallback;

export function materializeMessage(template: string, data: MessagePersonalizationData) {
  const names = String(data.name || '').trim().split(/\s+/).filter(Boolean);
  const standard: Record<string, string> = { nome: safe(data.name, 'cliente'), primeiro_nome: safe(names[0], 'cliente'), segundo_nome: safe(names[1], '') };
  return template.replace(/{{\s*([\wÀ-ÿ.-]+)\s*}}/g, (_match, rawKey: string) => {
    const key = rawKey.toLocaleLowerCase('pt-BR');
    if (key in standard) return standard[key];
    const variableEntry = Object.entries(data.variables || {}).find(([name]) => name.toLocaleLowerCase('pt-BR') === key);
    return safe(variableEntry?.[1], '');
  });
}

export function buildSavedMessage(options: { id: string; unitId: string; name: string; message: string; actorId: string; kind: 'DRAFT' | 'TEMPLATE'; now?: string }) {
  if (!options.unitId || !options.name.trim() || !options.message.trim()) throw new Error('Informe nome e mensagem para salvar.');
  const now = options.now || new Date().toISOString();
  return { id: options.id, unitId: options.unitId, name: options.name.trim().slice(0, 120), message: options.message.trim().slice(0, 4096), kind: options.kind, createdAt: now, createdBy: options.actorId, updatedAt: now, updatedBy: options.actorId };
}
