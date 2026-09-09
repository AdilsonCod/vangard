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
} from './types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { seedDatabase } from './firebase-sync';

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

const AUTH_SESSION_KEY = 'vans_authenticated_user_id';
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

const canonicalUser = (user: User, uid: string): User => ({
  ...withoutLegacyPassword(user),
  id: uid,
  authUid: uid,
});

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
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const canonicalSnapshot = await getDoc(doc(db, 'users', fbUser.uid));
          let u = canonicalSnapshot.exists()
            ? canonicalUser(withDocumentId<User>(canonicalSnapshot), fbUser.uid)
            : undefined;
          if (!u && fbUser.email) {
            const legacySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', fbUser.email.toLowerCase())));
            const legacy = legacySnapshot.docs.map(d => withoutLegacyPassword(withDocumentId<User>(d)))[0];
            if (legacy) u = { ...legacy, authUid: fbUser.uid };
          }
          if (u && u.isActive !== false) {
            setCurrentUser(u);
            localStorage.setItem(AUTH_SESSION_KEY, u.id);
          }
        } catch (e) {
          console.error('Erro ao sincronizar usuário do Firebase Auth:', e);
        }
      }
      setHasLoadedUsers(true);
    });

    if (isInitializing) return;

    const storedUserId = localStorage.getItem(AUTH_SESSION_KEY);
    if (!storedUserId) {
      setHasLoadedUsers(true);
      return () => unsubAuth();
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', storedUserId),
      snapshot => {
        const storedUser = snapshot.exists() ? withoutLegacyPassword(withDocumentId<User>(snapshot)) : null;
        if (!storedUser || storedUser.isActive === false) {
          localStorage.removeItem(AUTH_SESSION_KEY);
          setCurrentUser(null);
        } else {
          setCurrentUser(storedUser);
        }
        setHasLoadedUsers(true);
      },
      error => {
        console.error('Erro ao carregar usuários do Firestore:', error);
        setHasLoadedUsers(true);
      }
    );

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, [isInitializing]);

  useEffect(() => {
    if (isInitializing || !currentUser) return;

    const userUnit = currentUser.unit || (currentUser as any).unitId;
    const isAdmin = currentUser.role === 'ADMIN';

    const getUnitScopedQuery = (collName: string) => {
      if (isAdmin || !userUnit) {
        return collection(db, collName);
      }
      return query(collection(db, collName), where('unitId', '==', userUnit));
    };

    const unsubRankingSettings = onSnapshot(doc(db, 'appSettings', 'rankings'), snapshot => {
      setQuarterlyRankingVisibility(snapshot.data()?.quarterlyRankingVisible !== false);
    }, error => {
      console.error('Erro ao carregar visibilidade do ranking:', error);
      setQuarterlyRankingVisibility(null);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const nextUsers = snap.docs.map(d => withoutLegacyPassword(withDocumentId<User>(d)));
      setUsers(nextUsers);
      const refreshedUser = nextUsers.find(user => user.id === currentUser.id);
      if (!refreshedUser || refreshedUser.isActive === false) {
        localStorage.removeItem(AUTH_SESSION_KEY);
        setCurrentUser(null);
      } else {
        setCurrentUser(refreshedUser);
      }
    });

    const unsubCatalog = onSnapshot(collection(db, 'catalog'), snap => {
      setCatalog(snap.docs.map(d => withDocumentId<CatalogItem>(d)));
    });
    const unsubEntries = onSnapshot(getUnitScopedQuery('entries'), snap => {
      setEntries(snap.docs.map(d => withDocumentId<DailyEntry>(d)));
    });
    const unsubGdv = onSnapshot(getUnitScopedQuery('gdvEntries'), snap => {
      setGdvEntries(snap.docs.map(d => withDocumentId<GDVEntry>(d)));
    });
    const unsubGdvSettings = onSnapshot(collection(db, 'gdvSettings'), snap => {
      setGdvSettings(snap.docs.map(d => withDocumentId<GDVSettings>(d)));
    });
    const unsubMonthlyStats = onSnapshot(collection(db, 'monthlyUnitStats'), snap => {
      setMonthlyUnitStats(snap.docs.map(d => withDocumentId<MonthlyUnitStats>(d)));
    });
    const unsubMonthlyBarberStats = onSnapshot(collection(db, 'monthlyBarberStats'), snap => {
      setMonthlyBarberStats(snap.docs.map(d => withDocumentId<MonthlyBarberStats>(d)));
    });
    const unsubTargets = onSnapshot(collection(db, 'targets'), snap => {
      const tg: Record<string, Target> = {};
      snap.docs.forEach(d => tg[d.id] = d.data() as Target);
      setTargets(tg);
    });
    const unsubCategories = onSnapshot(collection(db, 'categories'), snap => {
      setCategories(snap.docs.map(d => withDocumentId<Category>(d)));
    });
    const unsubSubcategories = onSnapshot(collection(db, 'subcategories'), snap => {
      setSubcategories(snap.docs.map(d => withDocumentId<Subcategory>(d)));
    });
    const unsubSystemUnits = onSnapshot(collection(db, 'systemUnits'), snap => {
      setSystemUnits(snap.docs.map(d => withDocumentId<SystemUnit>(d)));
    });
    const unsubPayments = onSnapshot(getUnitScopedQuery('payments'), snap => {
      setPayments(snap.docs.map(d => withDocumentId<PaymentRecord>(d)));
    });
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), snap => {
      setNotifications(snap.docs.map(d => withDocumentId<SystemNotification>(d)));
    });
    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), snap => {
      setAnnouncements(snap.docs.map(d => withDocumentId<SystemAnnouncement>(d)));
    });
    const unsubTransactions = onSnapshot(getUnitScopedQuery('transactions'), snap => {
      setTransactions(snap.docs.map(d => withDocumentId<FinancialTransaction>(d)));
    });
    const unsubCashClosings = onSnapshot(getUnitScopedQuery('cashClosings'), snap => {
      setCashClosings(snap.docs.map(d => withDocumentId<CashClosing>(d)));
    });
    const unsubFinancialCategories = onSnapshot(collection(db, 'financialCategories'), snap => {
      setFinancialCategories(snap.docs.map(d => withDocumentId<FinancialCategory>(d)));
    });
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), snap => {
      setSuppliers(snap.docs.map(d => withDocumentId<Supplier>(d)));
    });
    const unsubFinClassifications = onSnapshot(collection(db, 'finClassifications'), snap => {
      setFinClassifications(snap.docs.map(d => withDocumentId<FinClassification>(d)));
    });
    const unsubFinSubclassifications = onSnapshot(collection(db, 'finSubclassifications'), snap => {
      setFinSubclassifications(snap.docs.map(d => withDocumentId<FinSubclassification>(d)));
    });

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
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, pass);
      const uid = auth.currentUser?.uid;
      const canonicalSnapshot = uid ? await getDoc(doc(db, 'users', uid)) : null;
      let u = canonicalSnapshot?.exists()
        ? canonicalUser(withDocumentId<User>(canonicalSnapshot), uid!)
        : undefined;
      if (!u) {
        const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
        const legacy = snapshot.docs.map(document => withoutLegacyPassword(withDocumentId<User>(document)))[0];
        if (legacy && uid) u = { ...legacy, authUid: uid };
      }
      if (u && u.isActive !== false) {
        setCurrentUser(u);
        localStorage.setItem(AUTH_SESSION_KEY, u.id);
        return true;
      }
    } catch (authError) {
      console.error('Falha na autenticação Firebase:', authError);
    }
    return false;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao encerrar sessão Firebase Auth:', error);
    }
    localStorage.removeItem(AUTH_SESSION_KEY);
    setCurrentUser(null);
  };

  const addEntry = async (entry: DailyEntry) => {
    await setDoc(doc(db, 'entries', entry.id), entry);
  };

  const updateEntry = async (entry: DailyEntry) => {
    await setDoc(doc(db, 'entries', entry.id), entry);
  };

  
  const cleanUndefined = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => newObj[key] === undefined && delete newObj[key]);
    return newObj;
  };
  
  const addTransaction = async (t: FinancialTransaction) => {
    await setDoc(doc(db, 'transactions', t.id), cleanUndefined(t));
  };
  const updateTransaction = async (t: FinancialTransaction) => {
    await setDoc(doc(db, 'transactions', t.id), cleanUndefined(t));
  };
  const saveCashClosing = async (closing: CashClosing) => {
    await setDoc(doc(db, 'cashClosings', closing.id), cleanUndefined(closing));
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
    await deleteDoc(doc(db, 'transactions', id));
  };
  
  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, 'entries', id));
  };

  const updateTarget = async (userId: string, target: Target) => {
    await setDoc(doc(db, 'targets', userId), target);
  };

  const updateGDVEntry = async (entry: GDVEntry) => {
    await setDoc(doc(db, 'gdvEntries', entry.id), entry);
  };

  const updateMonthlyUnitStats = async (stats: MonthlyUnitStats) => {
    await setDoc(doc(db, 'monthlyUnitStats', stats.id), stats);
  };

  const updateMonthlyBarberStats = async (stats: MonthlyBarberStats) => {
    await setDoc(doc(db, 'monthlyBarberStats', stats.id), stats);
  };

  const deleteMonthlyBarberStats = async (id: string) => {
    await deleteDoc(doc(db, 'monthlyBarberStats', id));
  };

  const deleteMonthlyUnitStats = async (id: string) => {
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
    await setDoc(doc(db, 'payments', payment.id), cleanUndefined(payment));
  };

  const updatePayment = async (payment: PaymentRecord) => {
    await setDoc(doc(db, 'payments', payment.id), cleanUndefined(payment));
  };

  const deletePayment = async (id: string) => {
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
      login, logout, addUser, updateUser, deleteUser, addEntry, updateEntry, deleteEntry, addTransaction, updateTransaction, deleteTransaction, saveCashClosing, addFinancialCategory, deleteFinancialCategory, addSupplier, deleteSupplier, addFinClassification, deleteFinClassification, addFinSubclassification, deleteFinSubclassification, updateGDVEntry, updateGDVSettings, updateMonthlyUnitStats, updateMonthlyBarberStats, deleteMonthlyBarberStats, deleteMonthlyUnitStats, updateTarget, updateCatalog,
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
