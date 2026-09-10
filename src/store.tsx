import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  MonthlyUnitStats,
  MonthlyBarberStats,
  SystemUnit,
  User,
  DailyEntry,
  Target,
  CatalogItem,
  Category,
  Subcategory,
  PaymentRecord,
  GDVEntry,
  GDVSettings,
  SystemNotification,
  SystemAnnouncement,
  FinancialTransaction,
  CashClosing,
  FinancialCategory,
  Supplier,
  FinClassification,
  FinSubclassification,
  FinancialPeriodEvent,
} from './types';
import { db, auth } from './firebase';
import { collection, doc, documentId, setDoc, deleteDoc, getDoc, getDocs, limit, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { seedDatabase } from './firebase-sync';
import { authenticatedProfile, endAuthenticatedSession, startAuthenticatedSession } from './services/authSession';
import { assertFinancialPeriodOpen, validateReopening } from './services/financialPeriodLock';

// Mock initial data
export const DEFAULT_UNITS: SystemUnit[] = [
  { id: 'UNIT_1', name: 'Unidade 1' },
  { id: 'UNIT_2', name: 'Unidade 2' }
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'SERVICE', name: 'Barbearia', type: 'SERVICE' },
  { id: 'EXTRA_SERVICE', name: 'Serviço Extra', type: 'SERVICE' },
  { id: 'PRODUCT', name: 'Produtos', type: 'PRODUCT' },
];

export const DEFAULT_SUBCATEGORIES: Subcategory[] = [
  { id: 'sub_cabelo', name: 'Cabelo', categoryId: 'SERVICE' },
  { id: 'sub_rosto', name: 'Rosto', categoryId: 'SERVICE' },
  { id: 'sub_quimica', name: 'Química', categoryId: 'SERVICE' },
  { id: 'sub_geral', name: 'Gerais', categoryId: 'PRODUCT' },
];

export const DEFAULT_CATALOG: CatalogItem[] = [
  { id: 'corte', name: 'Corte', type: 'SERVICE', subcategoryId: 'sub_cabelo' },
  { id: 'barba', name: 'Barba', type: 'SERVICE', subcategoryId: 'sub_rosto' },
  { id: 'sobrancelha', name: 'Sobrancelha', type: 'SERVICE', subcategoryId: 'sub_rosto' },
  { id: 'quimica', name: 'Química', type: 'SERVICE', subcategoryId: 'sub_quimica' },
  { id: 'general', name: 'Gerais', type: 'PRODUCT', subcategoryId: 'sub_geral' },
  { id: 'avant', name: 'Avant', type: 'PRODUCT', subcategoryId: 'sub_geral' },
  { id: 'ex_sobrancelha_navalha', name: 'Sobrancelha na navalha', type: 'EXTRA_SERVICE' },
  { id: 'ex_sobrancelha_cera', name: 'Sobrancelha na Cera', type: 'EXTRA_SERVICE' },
  { id: 'ex_selagem', name: 'Selagem', type: 'EXTRA_SERVICE' },
  { id: 'ex_barboterapia', name: 'Barboterapia', type: 'EXTRA_SERVICE' },
  { id: 'ex_hidratacao', name: 'Hidratação capilar', type: 'EXTRA_SERVICE' },
  { id: 'ex_higienizacao', name: 'Higienização de barba', type: 'EXTRA_SERVICE' },
  { id: 'ex_limpeza_facial', name: 'Limpeza facial com remoção de cravos', type: 'EXTRA_SERVICE' },
  { id: 'ex_disfarce_cabelo', name: 'Disfarce de branco no cabelo', type: 'EXTRA_SERVICE' },
  { id: 'ex_disfarce_barba', name: 'Disfarce de brancos na barba', type: 'EXTRA_SERVICE' },
  { id: 'ex_manicure', name: 'Manicure', type: 'EXTRA_SERVICE' },
  { id: 'ex_pedicure', name: 'Pedicure', type: 'EXTRA_SERVICE' },
  { id: 'ex_consultoria', name: 'Consultoria', type: 'EXTRA_SERVICE' }
];

export const DEFAULT_TARGETS: Record<string, Target> = {
  '2': { clientsServed: 100, uniqueClientsServed: 100, items: { corte: 2000, barba: 1000, sobrancelha: 300, quimica: 500, general: 400, avant: 600 } },
  '3': { clientsServed: 80, uniqueClientsServed: 80, items: { corte: 1800, barba: 800, sobrancelha: 200, quimica: 400, general: 300, avant: 500 } },
  '4': { clientsServed: 120, uniqueClientsServed: 120, items: { corte: 2500, barba: 1200, sobrancelha: 400, quimica: 600, general: 500, avant: 800 } },
};

interface AppState {
  quarterlyRankingVisible: boolean | null;
  setQuarterlyRankingVisible: (visible: boolean) => Promise<void>;
  users: User[];
  entries: DailyEntry[];
  gdvEntries: GDVEntry[];
  gdvSettings: GDVSettings[];
  transactions: FinancialTransaction[];
  cashClosings: CashClosing[];
  financialCategories: FinancialCategory[];
  suppliers: Supplier[];
  finClassifications: FinClassification[];
  finSubclassifications: FinSubclassification[];
  addTransaction: (t: FinancialTransaction) => Promise<void>;
  updateTransaction: (t: FinancialTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveCashClosing: (closing: CashClosing) => Promise<void>;
  reopenCashClosing: (closingId: string, reason: string) => Promise<void>;
  addFinancialCategory: (cat: FinancialCategory) => Promise<void>;
  deleteFinancialCategory: (id: string) => Promise<void>;
  addSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addFinClassification: (c: FinClassification) => Promise<void>;
  deleteFinClassification: (id: string) => Promise<void>;
  addFinSubclassification: (s: FinSubclassification) => Promise<void>;
  deleteFinSubclassification: (id: string) => Promise<void>;
  monthlyUnitStats: MonthlyUnitStats[];
  monthlyBarberStats: MonthlyBarberStats[];
  targets: Record<string, Target>;
  catalog: CatalogItem[];
  payments: PaymentRecord[];
  currentUser: User | null;
  categories: Category[];
  subcategories: Subcategory[];
  systemUnits: SystemUnit[];
  notifications: SystemNotification[];
  announcements: SystemAnnouncement[];
}

interface StoreContextType extends AppState {
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  attachUserAuthentication: (profileId: string, authUid: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addEntry: (entry: DailyEntry) => void;
  updateEntry: (entry: DailyEntry) => void;
  deleteEntry: (id: string) => void;
  updateGDVEntry: (entry: GDVEntry) => void;
  updateGDVSettings: (settings: GDVSettings) => void;
  updateMonthlyUnitStats: (stats: MonthlyUnitStats) => Promise<void>;
  updateMonthlyBarberStats: (stats: MonthlyBarberStats) => Promise<void>;
  deleteMonthlyBarberStats: (id: string) => Promise<void>;
  deleteMonthlyUnitStats: (id: string) => Promise<void>;
  updateTarget: (userId: string, target: Target) => void;
  updateCatalog: (catalog: CatalogItem[]) => void;
  updateCategories: (categories: Category[]) => void;
  updateSubcategories: (subcategories: Subcategory[]) => void;
  addPayment: (payment: PaymentRecord) => Promise<void>;
  updatePayment: (payment: PaymentRecord) => Promise<void>;
  addSystemUnit: (unit: SystemUnit) => Promise<void>;
  updateSystemUnit: (unit: SystemUnit) => Promise<void>;
  deleteSystemUnit: (id: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  addNotification: (notification: SystemNotification) => Promise<void>;
  addNotifications: (notifications: SystemNotification[]) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addAnnouncement: (announcement: SystemAnnouncement) => Promise<void>;
  updateAnnouncement: (announcement: SystemAnnouncement) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  themeColor: string;
  setThemeColor: (color: string) => void;
  themeLightBg: string;
  setThemeLightBg: (color: string) => void;
  themeDarkBg: string;
  setThemeDarkBg: (color: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const SHOULD_SEED_DATABASE = (import.meta as any).env?.VITE_ENABLE_DATABASE_SEED === 'true';

// O ID do documento e o ID salvo no conteúdo podem divergir em importações
// antigas. O caminho do Firestore é a referência canônica para atualizações e
// exclusões, então sempre o incorporamos ao objeto carregado.
const withDocumentId = <T,>(snapshot: { id: string; data: () => unknown }): T => ({
  ...(snapshot.data() as object),
  id: snapshot.id,
} as T);

const withoutLegacyPassword = (user: User): User => {
  const sanitized = { ...user } as User & Record<string, unknown>;
  delete sanitized.password;
  return sanitized;
};

const findAuthenticatedProfile = async (uid: string, authenticatedEmail?: string | null) => {
  const canonical = await getDoc(doc(db, 'users', uid));
  if (canonical.exists()) {
    return { documentId: canonical.id, profile: withoutLegacyPassword(withDocumentId<User>(canonical)) };
  }

  const byAuthUid = await getDocs(query(collection(db, 'users'), where('authUid', '==', uid), limit(1)));
  if (!byAuthUid.empty) {
    const match = byAuthUid.docs[0];
    return { documentId: match.id, profile: withoutLegacyPassword(withDocumentId<User>(match)) };
  }

  const normalizedEmail = authenticatedEmail?.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const exactEmail = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail), limit(1)));
  if (!exactEmail.empty) {
    const match = exactEmail.docs[0];
    return { documentId: match.id, profile: withoutLegacyPassword(withDocumentId<User>(match)) };
  }

  const profiles = await getDocs(collection(db, 'users'));
  const caseInsensitiveMatch = profiles.docs.find(item =>
    String(item.data().email || '').trim().toLowerCase() === normalizedEmail
  );
  return caseInsensitiveMatch
    ? { documentId: caseInsensitiveMatch.id, profile: withoutLegacyPassword(withDocumentId<User>(caseInsensitiveMatch)) }
    : null;
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [quarterlyRankingVisible, setQuarterlyRankingVisibility] = useState<boolean | null>(null);

  const setQuarterlyRankingVisible = async (visible: boolean) => {
    if (currentUser?.role !== 'ADMIN') throw new Error('Somente a gerência pode alterar a visibilidade do ranking.');
    await setDoc(doc(db, 'appSettings', 'rankings'), { quarterlyRankingVisible: visible }, { merge: true });
    setQuarterlyRankingVisibility(visible);
  };
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedUsers, setHasLoadedUsers] = useState(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [systemUnits, setSystemUnits] = useState<SystemUnit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [gdvEntries, setGdvEntries] = useState<GDVEntry[]>([]);
  const [gdvSettings, setGdvSettings] = useState<GDVSettings[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([]);
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [finClassifications, setFinClassifications] = useState<FinClassification[]>([]);
  const [finSubclassifications, setFinSubclassifications] = useState<FinSubclassification[]>([]);
  const [monthlyUnitStats, setMonthlyUnitStats] = useState<MonthlyUnitStats[]>([]);
  const [monthlyBarberStats, setMonthlyBarberStats] = useState<MonthlyBarberStats[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);

  const clearPrivateState = () => {
    setCurrentUser(null);
    setUsers([]);
    setEntries([]);
    setGdvEntries([]);
    setGdvSettings([]);
    setTransactions([]);
    setCashClosings([]);
    setMonthlyUnitStats([]);
    setMonthlyBarberStats([]);
    setTargets({});
    setPayments([]);
    setNotifications([]);
    setAnnouncements([]);
    setQuarterlyRankingVisibility(null);
  };

  const [themeColor, setThemeColor] = useState<'green' | 'red' | 'blue' | 'orange' | 'purple'>(() => {
    return (localStorage.getItem('barber_theme_color') as any) || 'orange';
  });
  const [themeLightBg, setThemeLightBg] = useState<string>(() => {
    return localStorage.getItem('barber_theme_light_bg') || 'bg-gray-50';
  });
  const [themeDarkBg, setThemeDarkBg] = useState<string>(() => {
    return localStorage.getItem('barber_theme_dark_bg') || 'dark:bg-zinc-950';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
     return localStorage.getItem('barber_theme_dark') === 'true';
  });

  useEffect(() => {
    const init = async () => {
      try {
        // A carga inicial altera coleções vazias. Em bancos com dados reais ela
        // fica desativada por padrão e só roda quando explicitamente habilitada.
        if (SHOULD_SEED_DATABASE) {
          await seedDatabase();
        }
      } catch (err) {
        console.error('Error seeding database:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    let unsubscribeProfile = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, async fbUser => {
      unsubscribeProfile();
      clearPrivateState();
      if (!fbUser) {
        setHasLoadedUsers(true);
        return;
      }
      setHasLoadedUsers(false);
      try {
        const resolved = await findAuthenticatedProfile(fbUser.uid, fbUser.email);
        if (!resolved) {
          clearPrivateState();
          setHasLoadedUsers(true);
          await signOut(auth);
          return;
        }
        unsubscribeProfile = onSnapshot(doc(db, 'users', resolved.documentId), snapshot => {
        const profile = snapshot.exists()
          ? authenticatedProfile(withoutLegacyPassword(withDocumentId<User>(snapshot)), fbUser.uid)
          : null;
        if (!profile || profile.isActive === false) {
          clearPrivateState();
          setHasLoadedUsers(true);
          void signOut(auth);
          return;
        }
        setCurrentUser(profile);
        setHasLoadedUsers(true);
      }, error => {
        console.error('Erro ao carregar o perfil autenticado:', error);
        clearPrivateState();
        setHasLoadedUsers(true);
      });
      } catch (error) {
        console.error('Erro ao localizar o perfil autenticado:', error);
        clearPrivateState();
        setHasLoadedUsers(true);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, [isInitializing]);

  useEffect(() => {
    if (isInitializing || !currentUser) return;

    const userUnit = currentUser.unit || (currentUser as any).unitId;
    const isAdmin = currentUser.role === 'ADMIN';
    const isProfessional = currentUser.role === 'BARBER' || currentUser.role === 'MANICURE';
    const canReadFinance = isAdmin || currentUser.role === 'FINANCIAL';
    const canReadUnitOperation = canReadFinance || currentUser.role === 'RECEPTION';
    const professionalId = currentUser.legacyId || currentUser.id;
    const noSubscription = () => {};

    const getUnitScopedQuery = (collName: string) => {
      if (isAdmin) {
        return collection(db, collName);
      }
      if (!userUnit) throw new Error(`O perfil ${currentUser.id} não possui unidade para consultar ${collName}.`);
      return query(collection(db, collName), where('unitId', '==', userUnit));
    };

    const getUnitOrGlobalQuery = (collName: string) => {
      if (isAdmin) return collection(db, collName);
      if (!userUnit) throw new Error(`O perfil ${currentUser.id} não possui unidade para consultar ${collName}.`);
      return query(collection(db, collName), where('unitId', 'in', [userUnit, 'ALL']));
    };

    const unsubRankingSettings = onSnapshot(doc(db, 'appSettings', 'rankings'), snapshot => {
      setQuarterlyRankingVisibility(snapshot.data()?.quarterlyRankingVisible !== false);
    }, error => {
      console.error('Erro ao carregar visibilidade do ranking:', error);
      setQuarterlyRankingVisibility(null);
    });

    const usersSource = isAdmin
      ? collection(db, 'users')
      : isProfessional
        ? query(collection(db, 'users'), where('authUid', '==', currentUser.id), limit(1))
        : query(collection(db, 'users'), where('unit', '==', userUnit), limit(250));
    const unsubUsers = onSnapshot(usersSource, snap => {
      const nextUsers = snap.docs.map(d => withoutLegacyPassword(withDocumentId<User>(d)));
      setUsers(nextUsers);
      const refreshedUser = nextUsers.find(user =>
        user.id === currentUser.id ||
        user.authUid === currentUser.id ||
        user.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
      );
      if (!refreshedUser || refreshedUser.isActive === false) {
        clearPrivateState();
        void signOut(auth);
      } else {
        setCurrentUser(authenticatedProfile(refreshedUser, currentUser.id));
      }
    });

    const unsubCatalog = onSnapshot(collection(db, 'catalog'), snap => {
      setCatalog(snap.docs.map(d => withDocumentId<CatalogItem>(d)));
    });
    const entriesSource = isProfessional
      ? query(collection(db, 'entries'), where('unitId', '==', userUnit), where('userId', '==', professionalId))
      : getUnitScopedQuery('entries');
    const unsubEntries = onSnapshot(entriesSource, snap => {
      setEntries(snap.docs.map(d => withDocumentId<DailyEntry>(d)));
    });
    const unsubGdv = isAdmin ? onSnapshot(collection(db, 'gdvEntries'), snap => {
      setGdvEntries(snap.docs.map(d => withDocumentId<GDVEntry>(d)));
    }) : noSubscription;
    const unsubGdvSettings = isAdmin ? onSnapshot(collection(db, 'gdvSettings'), snap => {
      setGdvSettings(snap.docs.map(d => withDocumentId<GDVSettings>(d)));
    }) : noSubscription;
    const unsubMonthlyStats = !isProfessional ? onSnapshot(getUnitScopedQuery('monthlyUnitStats'), snap => {
      setMonthlyUnitStats(snap.docs.map(d => withDocumentId<MonthlyUnitStats>(d)));
    }) : noSubscription;
    const barberStatsSource = isProfessional
      ? query(collection(db, 'monthlyBarberStats'), where('unitId', '==', userUnit), where('barberId', '==', professionalId))
      : getUnitScopedQuery('monthlyBarberStats');
    const unsubMonthlyBarberStats = onSnapshot(barberStatsSource, snap => {
      setMonthlyBarberStats(snap.docs.map(d => withDocumentId<MonthlyBarberStats>(d)));
    });
    const targetsSource = isAdmin
      ? collection(db, 'targets')
      : isProfessional
        ? query(collection(db, 'targets'), where(documentId(), '==', professionalId))
        : null;
    const unsubTargets = targetsSource ? onSnapshot(targetsSource, snap => {
      const tg: Record<string, Target> = {};
      snap.docs.forEach(d => tg[d.id] = d.data() as Target);
      setTargets(tg);
    }) : noSubscription;
    const unsubCategories = onSnapshot(collection(db, 'categories'), snap => {
      setCategories(snap.docs.map(d => withDocumentId<Category>(d)));
    });
    const unsubSubcategories = onSnapshot(collection(db, 'subcategories'), snap => {
      setSubcategories(snap.docs.map(d => withDocumentId<Subcategory>(d)));
    });
    const unsubSystemUnits = onSnapshot(collection(db, 'systemUnits'), snap => {
      setSystemUnits(snap.docs.map(d => withDocumentId<SystemUnit>(d)));
    });
    const paymentsSource = isProfessional
      ? query(collection(db, 'payments'), where('unitId', '==', userUnit), where('userId', '==', professionalId))
      : getUnitScopedQuery('payments');
    const unsubPayments = (canReadFinance || isProfessional) ? onSnapshot(paymentsSource, snap => {
      setPayments(snap.docs.map(d => withDocumentId<PaymentRecord>(d)));
    }) : noSubscription;
    const unsubNotifications = onSnapshot(query(collection(db, 'notifications'), where('userId', '==', currentUser.id)), snap => {
      setNotifications(snap.docs.map(d => withDocumentId<SystemNotification>(d)));
    });
    const unsubAnnouncements = onSnapshot(getUnitOrGlobalQuery('announcements'), snap => {
      setAnnouncements(snap.docs.map(d => withDocumentId<SystemAnnouncement>(d)));
    });
    const unsubTransactions = canReadUnitOperation ? onSnapshot(getUnitScopedQuery('transactions'), snap => {
      setTransactions(snap.docs.map(d => withDocumentId<FinancialTransaction>(d)));
    }) : noSubscription;
    const unsubCashClosings = canReadUnitOperation ? onSnapshot(getUnitScopedQuery('cashClosings'), snap => {
      setCashClosings(snap.docs.map(d => withDocumentId<CashClosing>(d)));
    }) : noSubscription;
    const unsubFinancialCategories = canReadUnitOperation ? onSnapshot(collection(db, 'financialCategories'), snap => {
      setFinancialCategories(snap.docs.map(d => withDocumentId<FinancialCategory>(d)));
    }) : noSubscription;
    const unsubSuppliers = canReadUnitOperation ? onSnapshot(collection(db, 'suppliers'), snap => {
      setSuppliers(snap.docs.map(d => withDocumentId<Supplier>(d)));
    }) : noSubscription;
    const unsubFinClassifications = canReadUnitOperation ? onSnapshot(collection(db, 'finClassifications'), snap => {
      setFinClassifications(snap.docs.map(d => withDocumentId<FinClassification>(d)));
    }) : noSubscription;
    const unsubFinSubclassifications = canReadUnitOperation ? onSnapshot(collection(db, 'finSubclassifications'), snap => {
      setFinSubclassifications(snap.docs.map(d => withDocumentId<FinSubclassification>(d)));
    }) : noSubscription;

    return () => {
      unsubRankingSettings();
      setQuarterlyRankingVisibility(null);
      unsubUsers();
      unsubCatalog();
      unsubEntries();
      unsubGdv();
      unsubGdvSettings();
      unsubMonthlyStats();
      unsubMonthlyBarberStats();
      unsubTargets();
      unsubCategories();
      unsubSubcategories();
      unsubSystemUnits();
      unsubPayments();
      unsubNotifications();
      unsubAnnouncements();
      unsubTransactions();
      unsubCashClosings();
      unsubFinancialCategories();
      unsubSuppliers();
      unsubFinClassifications();
      unsubFinSubclassifications();
    };
  }, [isInitializing, currentUser?.id, currentUser?.unit, (currentUser as any)?.unitId, currentUser?.role]);

  useEffect(() => {
    localStorage.setItem('barber_theme_color', themeColor);
    localStorage.setItem('barber_theme_light_bg', themeLightBg);
    localStorage.setItem('barber_theme_dark_bg', themeDarkBg);
    document.documentElement.className = `theme-${themeColor} ${isDarkMode ? 'dark' : ''}`;
    
    // Apply background colors to body
    // Remove old backgrounds if necessary (Tailwind classes)
    let darkThemeClass = 'theme-dark-cool';
    if (themeDarkBg === 'dark:bg-gray-950') darkThemeClass = 'theme-dark-warm';
    if (themeDarkBg === 'dark:bg-black') darkThemeClass = 'theme-dark-pure';

    let lightThemeClass = 'theme-light-warm';
    if (themeLightBg === 'bg-white') lightThemeClass = 'theme-light-pure';
    if (themeLightBg === 'bg-zinc-50') lightThemeClass = 'theme-light-cool';

    document.body.className = `${themeLightBg} ${themeDarkBg} text-gray-900 dark:text-zinc-100 ${lightThemeClass} ${darkThemeClass}`;
  }, [themeColor, isDarkMode, themeLightBg, themeDarkBg]);

  useEffect(() => {
    localStorage.setItem('barber_theme_dark', String(isDarkMode));
  }, [isDarkMode]);

  const login = async (email: string, pass: string) => {
    const user = await startAuthenticatedSession({
      signIn: async (normalizedEmail, password) => {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        return { uid: credential.user.uid, email: credential.user.email };
      },
      signOut: () => signOut(auth),
      readProfile: async (uid, authenticatedEmail) =>
        (await findAuthenticatedProfile(uid, authenticatedEmail))?.profile || null,
    }, email, pass);
    if (!user) {
      clearPrivateState();
      return false;
    }
    setCurrentUser(user);
    return true;
  };

  const logout = async () => {
    await endAuthenticatedSession(() => signOut(auth), clearPrivateState);
  };

  const addEntry = async (entry: DailyEntry) => {
    if (entry.unitId) assertFinancialPeriodOpen(entry.unitId, entry.date, cashClosings);
    await setDoc(doc(db, 'entries', entry.id), entry);
  };

  const updateEntry = async (entry: DailyEntry) => {
    if (entry.unitId) assertFinancialPeriodOpen(entry.unitId, entry.date, cashClosings);
    await setDoc(doc(db, 'entries', entry.id), entry);
  };

  
  const cleanUndefined = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => newObj[key] === undefined && delete newObj[key]);
    return newObj;
  };
  
  const addTransaction = async (t: FinancialTransaction) => {
    assertFinancialPeriodOpen(t.unitId, t.date, cashClosings);
    await setDoc(doc(db, 'transactions', t.id), cleanUndefined(t));
  };
  const updateTransaction = async (t: FinancialTransaction) => {
    const previous = transactions.find(item => item.id === t.id);
    if (previous) assertFinancialPeriodOpen(previous.unitId, previous.date, cashClosings);
    assertFinancialPeriodOpen(t.unitId, t.date, cashClosings);
    await setDoc(doc(db, 'transactions', t.id), cleanUndefined(t));
  };
  const saveCashClosing = async (closing: CashClosing) => {
    const existing = cashClosings.find(item => item.id === closing.id);
    if (existing && existing.status !== 'REOPENED') throw new Error('Este período já está fechado. Reabra-o antes de realizar um novo fechamento.');
    const now = new Date().toISOString();
    const event: FinancialPeriodEvent = { id: `period_event_${Date.now()}_${crypto.randomUUID()}`, action: 'CLOSED', unitId: closing.unitId, date: closing.date, actorId: currentUser?.id || 'unknown', actorRole: currentUser?.role || 'RECEPTION', createdAt: now, closingSnapshot: cleanUndefined(closing) as CashClosing };
    const batch = writeBatch(db);
    batch.set(doc(db, 'cashClosings', closing.id), cleanUndefined(closing));
    batch.set(doc(db, 'financialPeriodEvents', event.id), cleanUndefined(event));
    batch.set(doc(db, 'financialPeriodLocks', `${closing.unitId}_${closing.date}`), { unitId: closing.unitId, period: closing.date, closingId: closing.id, active: true, updatedAt: now, updatedBy: currentUser?.id || 'unknown' });
    batch.set(doc(db, 'financialPeriodLocks', `${closing.unitId}_${closing.date.slice(0, 7)}`), { unitId: closing.unitId, period: closing.date.slice(0, 7), closingId: closing.id, active: true, updatedAt: now, updatedBy: currentUser?.id || 'unknown' });
    await batch.commit();
  };
  const reopenCashClosing = async (closingId: string, reason: string) => {
    const closing = cashClosings.find(item => item.id === closingId);
    if (!closing) throw new Error('Fechamento não encontrado. Atualize a página e tente novamente.');
    if (closing.status === 'REOPENED') throw new Error('Este período já está reaberto.');
    validateReopening(currentUser?.role, reason);
    const now = new Date().toISOString();
    const reopened: CashClosing = { ...closing, status: 'REOPENED', reopenedAt: now, reopenedBy: currentUser?.id, reopeningReason: reason.trim() };
    const event: FinancialPeriodEvent = { id: `period_event_${Date.now()}_${crypto.randomUUID()}`, action: 'REOPENED', unitId: closing.unitId, date: closing.date, actorId: currentUser?.id || 'unknown', actorRole: currentUser?.role || 'FINANCIAL', reason: reason.trim(), createdAt: now, closingSnapshot: cleanUndefined(reopened) as CashClosing };
    const batch = writeBatch(db);
    batch.set(doc(db, 'cashClosings', closing.id), cleanUndefined(reopened));
    batch.set(doc(db, 'financialPeriodEvents', event.id), cleanUndefined(event));
    batch.set(doc(db, 'financialPeriodLocks', `${closing.unitId}_${closing.date}`), { unitId: closing.unitId, period: closing.date, closingId: closing.id, active: false, updatedAt: now, updatedBy: currentUser?.id || 'unknown' });
    const otherClosedDay = cashClosings.find(item => item.id !== closing.id && item.unitId === closing.unitId && item.date.startsWith(closing.date.slice(0, 7)) && item.status !== 'REOPENED');
    batch.set(doc(db, 'financialPeriodLocks', `${closing.unitId}_${closing.date.slice(0, 7)}`), { unitId: closing.unitId, period: closing.date.slice(0, 7), closingId: otherClosedDay?.id || closing.id, active: Boolean(otherClosedDay), updatedAt: now, updatedBy: currentUser?.id || 'unknown' });
    await batch.commit();
  };
  const addFinancialCategory = async (cat: FinancialCategory) => {
      try {
        await setDoc(doc(db, 'financialCategories', cat.id), cat);
        setFinancialCategories(prev => [...prev, cat]);
      } catch (err) {
        console.error("Erro ao adicionar categoria financeira", err);
      }
    };
    
    const addSupplier = async (supplier: Supplier) => {
      try {
        await setDoc(doc(db, 'suppliers', supplier.id), supplier);
      } catch (err) {
        console.error("Erro ao adicionar fornecedor", err);
      }
    };
    
    const addFinClassification = async (c: FinClassification) => {
      try { await setDoc(doc(db, 'finClassifications', c.id), c); } catch (err) { console.error(err); }
    };
    const deleteFinClassification = async (id: string) => {
      try { await deleteDoc(doc(db, 'finClassifications', id)); } catch (err) { console.error(err); }
    };
    const addFinSubclassification = async (s: FinSubclassification) => {
      try { await setDoc(doc(db, 'finSubclassifications', s.id), s); } catch (err) { console.error(err); }
    };
    const deleteFinSubclassification = async (id: string) => {
      try { await deleteDoc(doc(db, 'finSubclassifications', id)); } catch (err) { console.error(err); }
    };
    
    const deleteSupplier = async (id: string) => {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
      } catch (err) {
        console.error("Erro ao deletar fornecedor", err);
      }
    };

    const deleteFinancialCategory = async (id: string) => {
      try {
        await deleteDoc(doc(db, 'financialCategories', id));
        setFinancialCategories(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error("Erro ao deletar categoria financeira", err);
      }
    };

    const deleteTransaction = async (id: string) => {
    const existing = transactions.find(item => item.id === id);
    if (existing) assertFinancialPeriodOpen(existing.unitId, existing.date, cashClosings);
    await deleteDoc(doc(db, 'transactions', id));
  };
  
  const deleteEntry = async (id: string) => {
    const existing = entries.find(item => item.id === id);
    if (existing?.unitId) assertFinancialPeriodOpen(existing.unitId, existing.date, cashClosings);
    await deleteDoc(doc(db, 'entries', id));
  };

  const updateTarget = async (userId: string, target: Target) => {
    await setDoc(doc(db, 'targets', userId), target);
  };

  const updateGDVEntry = async (entry: GDVEntry) => {
    Object.keys(entry.units || {}).forEach(unitId => assertFinancialPeriodOpen(unitId, entry.date, cashClosings));
    await setDoc(doc(db, 'gdvEntries', entry.id), entry);
  };

  const updateMonthlyUnitStats = async (stats: MonthlyUnitStats) => {
    assertFinancialPeriodOpen(stats.unitId, stats.month, cashClosings);
    await setDoc(doc(db, 'monthlyUnitStats', stats.id), stats);
  };

  const updateMonthlyBarberStats = async (stats: MonthlyBarberStats) => {
    assertFinancialPeriodOpen(stats.unitId, stats.month, cashClosings);
    await setDoc(doc(db, 'monthlyBarberStats', stats.id), stats);
  };

  const deleteMonthlyBarberStats = async (id: string) => {
    const existing = monthlyBarberStats.find(item => item.id === id);
    if (existing) assertFinancialPeriodOpen(existing.unitId, existing.month, cashClosings);
    await deleteDoc(doc(db, 'monthlyBarberStats', id));
  };

  const deleteMonthlyUnitStats = async (id: string) => {
    const existing = monthlyUnitStats.find(item => item.id === id);
    if (existing) assertFinancialPeriodOpen(existing.unitId, existing.month, cashClosings);
    await deleteDoc(doc(db, 'monthlyUnitStats', id));
  };

  const updateGDVSettings = async (settings: GDVSettings) => {
    await setDoc(doc(db, 'gdvSettings', settings.id), settings);
  };

  const updateCatalog = async (newCatalog: CatalogItem[]) => {
    try {
      const validNewCatalog = newCatalog.filter(item => item && item.id);
      const newCatalogIds = new Set(validNewCatalog.map(item => item.id));
      
      const itemsToDelete = catalog.filter(oldItem => oldItem && oldItem.id && !newCatalogIds.has(oldItem.id));
      for (const item of itemsToDelete) {
        if (!item.id) continue;
        try {
          await deleteDoc(doc(db, 'catalog', item.id));
        } catch (err) {
          console.error(`Erro ao deletar item ${item.id} do catálogo:`, err);
        }
      }
      
      // Salvar/Atualizar os que existem
      for (const item of validNewCatalog) {
        if (!item.id) continue;
        try {
          const cleanItem: any = {
            id: item.id,
            name: item.name || '',
            type: item.type || '',
            price: item.price || 0,
          };
          if (item.subcategoryId !== undefined) {
             cleanItem.subcategoryId = item.subcategoryId || '';
          } else {
             cleanItem.subcategoryId = '';
          }
          if (item.unit !== undefined) {
             cleanItem.unit = item.unit || 'ALL';
          } else {
             cleanItem.unit = 'ALL';
          }
          if (item.visibleToRoles !== undefined) {
             cleanItem.visibleToRoles = item.visibleToRoles || [];
          } else {
             cleanItem.visibleToRoles = ['BARBER', 'MANICURE'];
          }
          await setDoc(doc(db, 'catalog', item.id), cleanItem);
        } catch (err) {
          console.error(`Erro ao salvar item ${item.id} no catálogo:`, err);
        }
      }
    } catch (e) {
      console.error("Erro ao atualizar catálogo:", e);
      alert("Erro ao atualizar catálogo: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const updateCategories = async (newCategories: Category[]) => {
    try {
      const validNewCategories = newCategories.filter(cat => cat && cat.id);
      const newCategoriesIds = new Set(validNewCategories.map(cat => cat.id));
      
      const itemsToDelete = categories.filter(oldCat => oldCat && oldCat.id && !newCategoriesIds.has(oldCat.id));
      for (const cat of itemsToDelete) {
        if (!cat.id) continue;
        try {
          await deleteDoc(doc(db, 'categories', cat.id));
        } catch (err) {
          console.error(`Erro ao remover categoria ${cat.id}:`, err);
        }

        // Excluir subcategorias sob a categoria deletada
        const affectedSubs = subcategories.filter(sub => sub && sub.categoryId === cat.id);
        for (const sub of affectedSubs) {
          if (!sub.id) continue;
          try {
            await deleteDoc(doc(db, 'subcategories', sub.id));
          } catch (err) {
            console.error(`Erro ao remover subcategoria associada ${sub.id}:`, err);
          }
        }

        // Atualizar itens do catálogo que usavam essa categoria
        const affectedItems = catalog.filter(item => item && item.type === cat.id);
        for (const item of affectedItems) {
          if (!item || !item.id) continue;
          try {
            const updatedItem = {
              ...item,
              type: 'SERVICE',
              subcategoryId: ''
            };
            await setDoc(doc(db, 'catalog', item.id), updatedItem);
          } catch (err) {
            console.error(`Erro ao desvincular subcategoria do item ${item.id}:`, err);
          }
        }
      }
      
      // Salvar/Atualizar os que existem
      for (const cat of validNewCategories) {
        if (!cat.id) continue;
        try {
          const cleanCat: any = {
            id: cat.id,
            name: cat.name || ''
          };
          if (cat.type) {
            cleanCat.type = cat.type;
          }
          await setDoc(doc(db, 'categories', cat.id), cleanCat);
        } catch (err) {
          console.error(`Erro ao salvar categoria ${cat.id}:`, err);
        }
      }
    } catch (e) {
      console.error("Erro ao atualizar categorias:", e);
      alert("Erro ao atualizar categorias: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const updateSubcategories = async (newSubcategories: Subcategory[]) => {
    try {
      const validNewSubs = newSubcategories.filter(sub => sub && sub.id);
      const newSubcategoriesIds = new Set(validNewSubs.map(sub => sub.id));
      
      const itemsToDelete = subcategories.filter(oldSub => oldSub && oldSub.id && !newSubcategoriesIds.has(oldSub.id));
      for (const sub of itemsToDelete) {
        if (!sub.id) continue;
        try {
          await deleteDoc(doc(db, 'subcategories', sub.id));
        } catch (err) {
          console.error(`Erro ao deletar subcategoria ${sub.id}:`, err);
        }

        // Limpar subcategoria dos itens do catálogo associados
        const affectedItems = catalog.filter(item => item && item.subcategoryId === sub.id);
        for (const item of affectedItems) {
          if (!item || !item.id) continue;
          try {
            const updatedItem = {
              ...item,
              subcategoryId: ''
            };
            await setDoc(doc(db, 'catalog', item.id), updatedItem);
          } catch (err) {
            console.error(`Erro ao descontaminar item ${item.id} de subcategoria:`, err);
          }
        }
      }
      
      // Salvar/Atualizar os que existem
      for (const sub of validNewSubs) {
        if (!sub.id) continue;
        try {
          const cleanSub = {
            id: sub.id,
            name: sub.name || '',
            categoryId: sub.categoryId || ''
          };
          await setDoc(doc(db, 'subcategories', sub.id), cleanSub);
        } catch (err) {
          console.error(`Erro ao salvar subcategoria ${sub.id}:`, err);
        }
      }
    } catch (e) {
      console.error("Erro ao atualizar subcategorias:", e);
      alert("Erro ao atualizar subcategorias: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const addSystemUnit = async (unit: SystemUnit) => {
    await setDoc(doc(db, 'systemUnits', unit.id), unit);
  };
  const updateSystemUnit = async (unit: SystemUnit) => {
    await setDoc(doc(db, 'systemUnits', unit.id), unit);
  };
  const deleteSystemUnit = async (id: string) => {
    await deleteDoc(doc(db, 'systemUnits', id));
  };

  const addUser = async (user: User) => {
    try {
      if (!user.authUid || user.id !== user.authUid) {
        throw new Error('O perfil deve usar o UID do Firebase Authentication como identificador.');
      }
      const sanitizedUser: any = withoutLegacyPassword(user);
      Object.keys(sanitizedUser).forEach(key => {
        if (sanitizedUser[key] === undefined) {
          delete sanitizedUser[key];
        }
      });
      await setDoc(doc(db, 'users', user.id), sanitizedUser);
    } catch(err) {
      console.error("Error adding user:", err);
      throw err;
    }
  }

  const updateUser = async (user: User) => {
    try {
      if (user.authUid && user.id !== user.authUid) {
        throw new Error('O perfil deve ser salvo no documento correspondente ao UID autenticado.');
      }
      const sanitizedUser: any = withoutLegacyPassword(user);
      Object.keys(sanitizedUser).forEach(key => {
        if (sanitizedUser[key] === undefined) {
          delete sanitizedUser[key];
        }
      });
      await setDoc(doc(db, 'users', user.id), sanitizedUser);
      if (currentUser?.id === user.id) {
        setCurrentUser(withoutLegacyPassword(user));
      }
    } catch(err) {
      console.error("Error updating user:", err);
      throw err;
    }
  };

  const attachUserAuthentication = async (profileId: string, authUid: string) => {
    await setDoc(doc(db, 'users', profileId), { authUid, legacyId: profileId }, { merge: true });
  };

  const deleteUser = async (id: string) => {
    const userToSoftDelete = users.find(u => u.id === id);
    if (userToSoftDelete) {
      const sanitized: any = withoutLegacyPassword({ ...userToSoftDelete, isActive: false });
      Object.keys(sanitized).forEach(k => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });
      try {
        await setDoc(doc(db, 'users', id), sanitized);
      } catch (err) {
        console.error("Error softly deleting user:", err);
      }
    }
  };

  const addPayment = async (payment: PaymentRecord) => {
    const unitId = payment.unitId || users.find(user => user.id === payment.userId)?.unit || 'ALL';
    assertFinancialPeriodOpen(unitId, payment.date, cashClosings);
    await setDoc(doc(db, 'payments', payment.id), cleanUndefined({ ...payment, unitId }));
  };

  const updatePayment = async (payment: PaymentRecord) => {
    const previous = payments.find(item => item.id === payment.id);
    const unitId = payment.unitId || users.find(user => user.id === payment.userId)?.unit || 'ALL';
    if (previous) assertFinancialPeriodOpen(previous.unitId || users.find(user => user.id === previous.userId)?.unit || 'ALL', previous.date, cashClosings);
    assertFinancialPeriodOpen(unitId, payment.date, cashClosings);
    await setDoc(doc(db, 'payments', payment.id), cleanUndefined({ ...payment, unitId }));
  };

  const deletePayment = async (id: string) => {
    const existing = payments.find(item => item.id === id);
    if (existing) assertFinancialPeriodOpen(existing.unitId || users.find(user => user.id === existing.userId)?.unit || 'ALL', existing.date, cashClosings);
    await deleteDoc(doc(db, 'payments', id));
  };

  const addNotification = async (notification: SystemNotification) => {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  };

  const addNotifications = async (batch: SystemNotification[]) => {
    await Promise.all(batch.map(n => setDoc(doc(db, 'notifications', n.id), n)));
  };

  const markNotificationAsRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      await setDoc(doc(db, 'notifications', id), { ...notif, read: true });
    }
  };

  const markAllNotificationsAsRead = async () => {
    const unread = notifications.filter(n => n.userId === currentUser?.id && !n.read);
    await Promise.all(unread.map(n => setDoc(doc(db, 'notifications', n.id), { ...n, read: true })));
  };
  
  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const addAnnouncement = async (announcement: SystemAnnouncement) => {
    await setDoc(doc(db, 'announcements', announcement.id), cleanUndefined(announcement));
  };

  const updateAnnouncement = async (announcement: SystemAnnouncement) => {
    await setDoc(doc(db, 'announcements', announcement.id), cleanUndefined(announcement));
  };

  const deleteAnnouncement = async (id: string) => {
    await deleteDoc(doc(db, 'announcements', id));
  };

  if (isInitializing || !hasLoadedUsers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-zinc-200 p-6">
        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
          {/* Elegant Circular Glow Spinner */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/10 dark:border-amber-500/5"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-600 dark:border-amber-500 border-t-transparent animate-spin"></div>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/20 animate-pulse"></div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 font-sans">
              VANS
            </h1>
            <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">
              Carregando banco de dados...
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-widest animate-pulse">
              Iniciando conexões seguras
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ 
      quarterlyRankingVisible, setQuarterlyRankingVisible,
      financialCategories, suppliers, finClassifications, finSubclassifications, users, entries, gdvEntries, gdvSettings, transactions, cashClosings, monthlyUnitStats, monthlyBarberStats, targets, catalog, payments, currentUser, categories, subcategories, systemUnits, notifications, announcements,
      login, logout, addUser, updateUser, attachUserAuthentication, deleteUser, addEntry, updateEntry, deleteEntry, addTransaction, updateTransaction, deleteTransaction, saveCashClosing, reopenCashClosing, addFinancialCategory, deleteFinancialCategory, addSupplier, deleteSupplier, addFinClassification, deleteFinClassification, addFinSubclassification, deleteFinSubclassification, updateGDVEntry, updateGDVSettings, updateMonthlyUnitStats, updateMonthlyBarberStats, deleteMonthlyBarberStats, deleteMonthlyUnitStats, updateTarget, updateCatalog,
      updateCategories, updateSubcategories, addSystemUnit, updateSystemUnit, deleteSystemUnit, addPayment, updatePayment, deletePayment, addNotification, addNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, addAnnouncement, updateAnnouncement, deleteAnnouncement, themeColor, setThemeColor: setThemeColor as any, themeLightBg, setThemeLightBg, themeDarkBg, setThemeDarkBg,
      isDarkMode, setIsDarkMode
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
