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
  FinancialCategory,
  Supplier,
  FinClassification,
  FinSubclassification,
} from './types';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
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
  users: User[];
  entries: DailyEntry[];
  gdvEntries: GDVEntry[];
  gdvSettings: GDVSettings[];
  transactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  suppliers: Supplier[];
  finClassifications: FinClassification[];
  finSubclassifications: FinSubclassification[];
  addTransaction: (t: FinancialTransaction) => Promise<void>;
  updateTransaction: (t: FinancialTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
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
  addPayment: (payment: PaymentRecord) => void;
  updatePayment: (payment: PaymentRecord) => void;
  addSystemUnit: (unit: SystemUnit) => void;
  updateSystemUnit: (unit: SystemUnit) => void;
  deleteSystemUnit: (id: string) => void;
  deletePayment: (id: string) => void;
  addNotification: (notification: SystemNotification) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addAnnouncement: (announcement: SystemAnnouncement) => Promise<void>;
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

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
    if (isInitializing) return;

    const unsubCatalog = onSnapshot(collection(db, 'catalog'), snap => {
      setCatalog(snap.docs.map(d => d.data() as CatalogItem));
    });
    const unsubEntries = onSnapshot(collection(db, 'entries'), snap => {
      setEntries(snap.docs.map(d => d.data() as DailyEntry));
    });
    const unsubGdv = onSnapshot(collection(db, 'gdvEntries'), snap => {
      setGdvEntries(snap.docs.map(d => d.data() as GDVEntry));
    });
    const unsubGdvSettings = onSnapshot(collection(db, 'gdvSettings'), snap => {
      setGdvSettings(snap.docs.map(d => d.data() as GDVSettings));
    });
    const unsubMonthlyStats = onSnapshot(collection(db, 'monthlyUnitStats'), snap => {
      setMonthlyUnitStats(snap.docs.map(d => d.data() as MonthlyUnitStats));
    });
    const unsubMonthlyBarberStats = onSnapshot(collection(db, 'monthlyBarberStats'), snap => {
      setMonthlyBarberStats(snap.docs.map(d => d.data() as MonthlyBarberStats));
    });
    const unsubTargets = onSnapshot(collection(db, 'targets'), snap => {
      const tg: Record<string, Target> = {};
      snap.docs.forEach(d => tg[d.id] = d.data() as Target);
      setTargets(tg);
    });
    const unsubCategories = onSnapshot(collection(db, 'categories'), snap => {
      setCategories(snap.docs.map(d => d.data() as Category));
    });
    const unsubSubcategories = onSnapshot(collection(db, 'subcategories'), snap => {
      setSubcategories(snap.docs.map(d => d.data() as Subcategory));
    });
    const unsubSystemUnits = onSnapshot(collection(db, 'systemUnits'), snap => {
      setSystemUnits(snap.docs.map(d => d.data() as SystemUnit));
    });
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      snap => {
        const nextUsers = snap.docs.map(d => d.data() as User);
        setUsers(nextUsers);

        // Restaura somente o ID da sessão e sempre utiliza o documento atual do
        // Firestore. Usuários removidos ou desativados perdem a sessão.
        setCurrentUser(previousUser => {
          const storedUserId = previousUser?.id || localStorage.getItem(AUTH_SESSION_KEY);
          if (!storedUserId) return null;

          const refreshedUser = nextUsers.find(user =>
            user.id === storedUserId && user.isActive !== false
          );

          if (!refreshedUser) {
            localStorage.removeItem(AUTH_SESSION_KEY);
            return null;
          }

          localStorage.setItem(AUTH_SESSION_KEY, refreshedUser.id);
          return refreshedUser;
        });
        setHasLoadedUsers(true);
      },
      error => {
        console.error('Erro ao carregar usuários do Firestore:', error);
        setHasLoadedUsers(true);
      }
    );
    const unsubPayments = onSnapshot(collection(db, 'payments'), snap => {
      setPayments(snap.docs.map(d => d.data() as PaymentRecord));
    });
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), snap => {
      setNotifications(snap.docs.map(d => d.data() as SystemNotification));
    });
    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), snap => {
      setAnnouncements(snap.docs.map(d => d.data() as SystemAnnouncement));
    });
    const unsubTransactions = onSnapshot(collection(db, 'transactions'), snap => {
      setTransactions(snap.docs.map(d => d.data() as FinancialTransaction));
    });
    const unsubFinancialCategories = onSnapshot(collection(db, 'financialCategories'), snap => {
      setFinancialCategories(snap.docs.map(d => d.data() as FinancialCategory));
    });
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), snap => {
      setSuppliers(snap.docs.map(d => d.data() as Supplier));
    });
    const unsubFinClassifications = onSnapshot(collection(db, 'finClassifications'), snap => {
      setFinClassifications(snap.docs.map(d => d.data() as FinClassification));
    });
    const unsubFinSubclassifications = onSnapshot(collection(db, 'finSubclassifications'), snap => {
      setFinSubclassifications(snap.docs.map(d => d.data() as FinSubclassification));
    });

    return () => {
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
      unsubUsers();
      unsubPayments();
      unsubNotifications();
      unsubAnnouncements();
      unsubTransactions();
      unsubFinancialCategories();
      unsubSuppliers();
      unsubFinClassifications();
      unsubFinSubclassifications();
    };
  }, [isInitializing]);

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

  const login = (email: string, pass: string) => {
    const u = users.find(u => u.email === email && u.password === pass && u.isActive !== false);
    if (u) {
      setCurrentUser(u);
      localStorage.setItem(AUTH_SESSION_KEY, u.id);
      return true;
    }
    return false;
  };

  const logout = () => {
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
      const sanitizedUser: any = { ...user };
      Object.keys(sanitizedUser).forEach(key => {
        if (sanitizedUser[key] === undefined) {
          delete sanitizedUser[key];
        }
      });
      await setDoc(doc(db, 'users', user.id), sanitizedUser);
    } catch(err) {
      console.error("Error adding user:", err);
    }
  }

  const updateUser = async (user: User) => {
    try {
      const sanitizedUser: any = { ...user };
      Object.keys(sanitizedUser).forEach(key => {
        if (sanitizedUser[key] === undefined) {
          delete sanitizedUser[key];
        }
      });
      await setDoc(doc(db, 'users', user.id), sanitizedUser);
      if (currentUser?.id === user.id) {
        setCurrentUser(user);
      }
    } catch(err) {
      console.error("Error updating user:", err);
    }
  };

  const deleteUser = async (id: string) => {
    const userToSoftDelete = users.find(u => u.id === id);
    if (userToSoftDelete) {
      const sanitized: any = { ...userToSoftDelete, isActive: false };
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
    await setDoc(doc(db, 'payments', payment.id), payment);
  };

  const updatePayment = async (payment: PaymentRecord) => {
    await setDoc(doc(db, 'payments', payment.id), payment);
  };

  const deletePayment = async (id: string) => {
    await deleteDoc(doc(db, 'payments', id));
  };

  const addNotification = async (notification: SystemNotification) => {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  };

  const markNotificationAsRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      await setDoc(doc(db, 'notifications', id), { ...notif, read: true });
    }
  };
  
  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const addAnnouncement = async (announcement: SystemAnnouncement) => {
    await setDoc(doc(db, 'announcements', announcement.id), announcement);
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
      financialCategories, suppliers, finClassifications, finSubclassifications, users, entries, gdvEntries, gdvSettings, transactions, monthlyUnitStats, monthlyBarberStats, targets, catalog, payments, currentUser, categories, subcategories, systemUnits, notifications, announcements,
      login, logout, addUser, updateUser, deleteUser, addEntry, updateEntry, deleteEntry, addTransaction, updateTransaction, deleteTransaction, addFinancialCategory, deleteFinancialCategory, addSupplier, deleteSupplier, addFinClassification, deleteFinClassification, addFinSubclassification, deleteFinSubclassification, updateGDVEntry, updateGDVSettings, updateMonthlyUnitStats, updateMonthlyBarberStats, deleteMonthlyBarberStats, deleteMonthlyUnitStats, updateTarget, updateCatalog,
      updateCategories, updateSubcategories, addSystemUnit, updateSystemUnit, deleteSystemUnit, addPayment, updatePayment, deletePayment, addNotification, markNotificationAsRead, deleteNotification, addAnnouncement, deleteAnnouncement, themeColor, setThemeColor: setThemeColor as any, themeLightBg, setThemeLightBg, themeDarkBg, setThemeDarkBg,
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
