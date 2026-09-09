import { db } from './firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, DEFAULT_CATALOG, DEFAULT_TARGETS, DEFAULT_UNITS } from './store';

// Check if we are running in a preview/development environment
const isPreviewOrDev = 
  (import.meta as any).env?.DEV || 
  (typeof window !== 'undefined' && 
   (window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1') || 
    window.location.hostname.includes('ais-dev-') || 
    window.location.hostname.includes('ais-pre-')));

export async function seedDatabase() {
  // Query all initial snapshots in parallel to avoid sequential blocking and query throttling
  const [
    usersSnap,
    categoriesSnap,
    subcategoriesSnap,
    systemUnitsSnap,
    catalogSnap
  ] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'subcategories')),
    getDocs(collection(db, 'systemUnits')),
    getDocs(collection(db, 'catalog'))
  ]);

  const promises: Promise<void>[] = [];

  if (isPreviewOrDev) {
    // Dev & Preview Seeding — seed primary admin if no users exist
    if (usersSnap.empty) {
      const primaryAdmin = {
        id: 'prod-admin-1',
        name: 'Administrador VANS',
        email: 'karenfeitosa08@gmail.com',
        role: 'ADMIN',
        unit: null,
        isActive: true
      };
      promises.push(setDoc(doc(db, 'users', primaryAdmin.id), primaryAdmin));
    }
  } else {
    // Production/Published Seeding (NO example/mock accounts)
    if (usersSnap.empty) {
      // If the database is completely empty on initial setup,
      // seed a single primary Admin account based on the user's email
      const primaryAdmin = {
        id: 'prod-admin-1',
        name: 'Administrador VANS',
        email: 'karenfeitosa08@gmail.com',
        role: 'ADMIN',
        unit: null
      };
      promises.push(setDoc(doc(db, 'users', primaryAdmin.id), primaryAdmin));
    }
  }

  // Common setups (Categories, Subcategories, Items Catalog, and Units)
  if (categoriesSnap.empty) {
    for (const cat of DEFAULT_CATEGORIES) {
      promises.push(setDoc(doc(db, 'categories', cat.id), cat));
    }
  }

  if (subcategoriesSnap.empty) {
    for (const sub of DEFAULT_SUBCATEGORIES) {
      promises.push(setDoc(doc(db, 'subcategories', sub.id), sub));
    }
  }

  if (systemUnitsSnap.empty) {
    for (const unit of DEFAULT_UNITS) {
      promises.push(setDoc(doc(db, 'systemUnits', unit.id), unit));
    }
  }

  if (catalogSnap.empty) {
    for (const item of DEFAULT_CATALOG) {
      promises.push(setDoc(doc(db, 'catalog', item.id), item));
    }
  }

  // Seed targets only in preview/development mode
  if (isPreviewOrDev) {
    const targetsSnap = await getDocs(collection(db, 'targets'));
    if (targetsSnap.empty) {
      for (const [userId, target] of Object.entries(DEFAULT_TARGETS)) {
        promises.push(setDoc(doc(db, 'targets', userId), target));
      }
    }
  }

  // Wait for all seeding writes to execute in parallel
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
