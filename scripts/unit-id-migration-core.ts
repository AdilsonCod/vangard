export type MigrationDocument = {
  collection: string;
  id: string;
  data: Record<string, unknown>;
};

export type UnitResolution =
  | { status: 'already-valid'; unitId: string; source: 'unitId' }
  | { status: 'resolved'; unitId: string; source: string }
  | { status: 'unresolved'; reason: string; candidates: string[] };

const UNIT_ALIASES = ['unit', 'unidade', 'targetUnitId', 'selectedUnitId'] as const;
const OWNER_FIELDS = ['userId', 'barberId', 'ownerId', 'createdById'] as const;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function buildUnitIndexes(documents: MigrationDocument[]) {
  const units = new Set(
    documents.filter(item => item.collection === 'systemUnits').map(item => item.id),
  );
  const userUnits = new Map<string, string>();
  const documentUnits = new Map<string, string>();

  for (const item of documents.filter(entry => entry.collection === 'users')) {
    const unitId = text(item.data.unitId) || text(item.data.unit);
    if (!unitId || unitId === 'ALL') continue;
    for (const identity of [item.id, text(item.data.id), text(item.data.authUid), text(item.data.legacyId)]) {
      if (identity) userUnits.set(identity, unitId);
    }
  }

  for (const item of documents) {
    const unitId = text(item.data.unitId) || UNIT_ALIASES.map(key => text(item.data[key])).find(Boolean) || '';
    if (unitId) documentUnits.set(`${item.collection}/${item.id}`, unitId);
  }

  return { units, userUnits, documentUnits };
}

export function resolveDocumentUnit(
  document: MigrationDocument,
  indexes: ReturnType<typeof buildUnitIndexes>,
): UnitResolution {
  const current = text(document.data.unitId);
  if (current) return { status: 'already-valid', unitId: current, source: 'unitId' };

  const evidence = new Map<string, Set<string>>();
  const add = (unitId: string, source: string) => {
    if (!unitId) return;
    const sources = evidence.get(unitId) || new Set<string>();
    sources.add(source);
    evidence.set(unitId, sources);
  };

  for (const field of UNIT_ALIASES) add(text(document.data[field]), field);
  for (const field of OWNER_FIELDS) {
    const owner = text(document.data[field]);
    if (owner) add(indexes.userUnits.get(owner) || '', `${field}->users`);
  }

  if (document.collection === 'targets') {
    add(indexes.userUnits.get(document.id) || '', 'documentId->users');
  }
  if (document.collection === 'commissionConfigs' && indexes.units.has(document.id)) {
    add(document.id, 'documentId->systemUnits');
  }
  if (document.collection === 'smart_link_clicks') {
    const linkId = text(document.data.linkId);
    add(indexes.documentUnits.get(`smart_links/${linkId}`) || '', 'linkId->smart_links');
  }
  if (document.collection === 'marketing_traffic') {
    const campaignId = text(document.data.campaignId);
    add(indexes.documentUnits.get(`marketing_campaigns/${campaignId}`) || '', 'campaignId->marketing_campaigns');
  }
  if (document.collection === 'marketing_organic') {
    const contentId = text(document.data.contentId);
    add(indexes.documentUnits.get(`social_posts/${contentId}`) || '', 'contentId->social_posts');
  }
  if (document.collection === 'gdvEntries' || document.collection === 'gdvSettings') {
    const unitsObject = document.data.units;
    if (unitsObject && typeof unitsObject === 'object' && !Array.isArray(unitsObject)) {
      const keys = Object.keys(unitsObject).filter(unitId => unitId !== 'ALL');
      if (keys.length === 1) add(keys[0], 'units[única unidade]');
      if (keys.length > 1) {
        return { status: 'unresolved', reason: 'Documento agrega múltiplas unidades e precisa ser normalizado manualmente.', candidates: keys.sort() };
      }
    }
  }

  const candidates = [...evidence.keys()].filter(unitId => unitId === 'ALL' || indexes.units.has(unitId));
  if (candidates.length === 1) {
    const unitId = candidates[0];
    return { status: 'resolved', unitId, source: [...(evidence.get(unitId) || [])].sort().join(' + ') };
  }
  if (candidates.length > 1) {
    return { status: 'unresolved', reason: 'Foram encontradas evidências conflitantes de unidade.', candidates: candidates.sort() };
  }
  return { status: 'unresolved', reason: 'Nenhuma evidência explícita de unidade foi encontrada.', candidates: [] };
}

export function planUnitIdMigration(documents: MigrationDocument[], privateCollections: Set<string>) {
  const indexes = buildUnitIndexes(documents);
  const plan: Array<{ document: MigrationDocument; resolution: UnitResolution }> = [];
  for (const document of documents.filter(item => privateCollections.has(item.collection))) {
    const resolution = resolveDocumentUnit(document, indexes);
    plan.push({ document, resolution });
    if (resolution.status !== 'unresolved') {
      indexes.documentUnits.set(`${document.collection}/${document.id}`, resolution.unitId);
    }
  }
  return plan;
}
