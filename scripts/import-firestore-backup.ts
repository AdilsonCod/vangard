import fs from 'node:fs';
import path from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

type BackupDocument = Record<string, unknown> & {
  _id?: string;
  id?: string;
};

type FirestoreBackup = {
  metadata?: {
    projectId?: string;
    firestoreDatabaseId?: string;
    totalDocuments?: number;
    stats?: Record<string, number>;
  };
  collections: Record<string, BackupDocument[]>;
};

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const backupArgument = args.find(argument => !argument.startsWith('--'));

if (!backupArgument) {
  throw new Error('Informe o caminho do backup JSON/MD. Exemplo: npm run firestore:import:dry -- .Docs/BAKU.MOD.md');
}

const backupPath = path.resolve(backupArgument);
const rawBackup = fs.readFileSync(backupPath, 'utf8').trim();
const jsonText = rawBackup
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '');
const backup = JSON.parse(jsonText) as FirestoreBackup;

if (!backup.collections || typeof backup.collections !== 'object') {
  throw new Error('Backup inválido: objeto "collections" não encontrado.');
}

const collectionEntries = Object.entries(backup.collections);
let validatedDocuments = 0;

for (const [collectionName, documents] of collectionEntries) {
  if (!Array.isArray(documents)) {
    throw new Error(`Backup inválido: a coleção "${collectionName}" não é uma lista.`);
  }

  const ids = new Set<string>();
  for (const documentData of documents) {
    const documentId = String(documentData._id || documentData.id || '').trim();
    if (!documentId) throw new Error(`Documento sem ID na coleção "${collectionName}".`);
    if (documentId.includes('/')) throw new Error(`ID inválido com barra em "${collectionName}/${documentId}".`);
    if (ids.has(documentId)) throw new Error(`ID duplicado em "${collectionName}/${documentId}".`);
    ids.add(documentId);
    validatedDocuments += 1;
  }
}

if (
  backup.metadata?.totalDocuments !== undefined &&
  backup.metadata.totalDocuments !== validatedDocuments
) {
  throw new Error(
    `Total inconsistente: metadados=${backup.metadata.totalDocuments}, conteúdo=${validatedDocuments}.`
  );
}

const app = initializeApp(firebaseConfig, `backup-import-${Date.now()}`);
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = initializeFirestore(app, {}, databaseId);

console.log(`Origem: ${backup.metadata?.projectId || 'não informada'} / ${backup.metadata?.firestoreDatabaseId || 'não informado'}`);
console.log(`Destino: ${firebaseConfig.projectId} / ${databaseId}`);
console.log(`Backup validado: ${collectionEntries.length} coleções, ${validatedDocuments} documentos.`);

const documentsToCreate: Array<{
  collectionName: string;
  documentId: string;
  data: Record<string, unknown>;
}> = [];
let existingDocuments = 0;

for (const [collectionName, backupDocuments] of collectionEntries) {
  const currentSnapshot = await getDocs(collection(db, collectionName));
  const currentIds = new Set(currentSnapshot.docs.map(currentDocument => currentDocument.id));
  let collectionNew = 0;
  let collectionExisting = 0;

  for (const backupDocument of backupDocuments) {
    const documentId = String(backupDocument._id || backupDocument.id);
    if (currentIds.has(documentId)) {
      collectionExisting += 1;
      existingDocuments += 1;
      continue;
    }

    const { _id: _backupOnlyId, ...data } = backupDocument;
    documentsToCreate.push({ collectionName, documentId, data });
    collectionNew += 1;
  }

  console.log(`${collectionName}: novos=${collectionNew}, existentes=${collectionExisting}`);
}

console.log(`Resumo: novos=${documentsToCreate.length}, existentes preservados=${existingDocuments}.`);

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhuma gravação foi realizada.');
  await deleteApp(app);
  process.exit(0);
}

for (let offset = 0; offset < documentsToCreate.length; offset += 400) {
  const batch = writeBatch(db);
  const chunk = documentsToCreate.slice(offset, offset + 400);

  for (const item of chunk) {
    batch.set(doc(db, item.collectionName, item.documentId), item.data);
  }

  await batch.commit();
  console.log(`Lote gravado: ${offset + 1}-${offset + chunk.length}.`);
}

console.log(`Importação concluída: ${documentsToCreate.length} documentos criados; ${existingDocuments} existentes não foram alterados.`);
await deleteApp(app);
