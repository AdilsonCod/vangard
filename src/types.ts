export type Role = 'ADMIN' | 'BARBER' | 'MANICURE' | 'FINANCIAL' | 'MARKETING';
export type Unit = string;
export type ItemType = string;

export interface SystemUnit {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type?: 'SERVICE' | 'PRODUCT' | 'SUBSCRIPTION';
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface User {
  isActive?: boolean;
  id: string;
  name: string;
  email?: string;
  role: Role;
  unit: Unit | null;
  password?: string;
  notes?: string; 
  barberNotes?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  type: ItemType; // Points to Category ID
  subcategoryId?: string; // Optional reference to Subcategory ID
  unit?: string; // ALL or Unit ID
  visibleToRoles?: Role[];
  price?: number;
}

export interface Target {
  items: Record<string, number>;
  clientsServed: number;
  uniqueClientsServed: number;
}

export interface DailyItemEntry {
  amount: number;
  commission: number;
}

export interface PotServiceData {
  id: string;
  name: string;
  quantity: number;
  tokens: number; // fichas
}

export interface PaymentRecord {
  id: string;
  userId: string; // The barber being paid
  date: string; // System sortable date, e.g. YYYY-MM-DD
  
  commissionAvulso: number;
  commissionProductGeneral: number;
  commissionProductAvant: number;
  commissionSubscriptions: number;
  discount: number;
  discountDescription: string;
  discounts?: { description: string; value: number }[];
  amountToBePaid: number;
  status: 'PENDENTE' | 'AGENDADO' | 'PAGO';
  isPaid: boolean; // Keep for backward compatibility temp, but prefer status

  potData: PotServiceData[];
  potPercentage?: number;
}

export interface DailyEntry {
  id: string;
  userId: string;
  date: string; // Data de Lancamento (YYYY-MM-DD)
  dueDate?: string; // Data de Vencimento (YYYY-MM-DD)
  createdAt?: string;
  isDayOff: boolean;
  workedDays?: number[];
  clientsServed: number;
  uniqueClientsServed: number;
  items: Record<string, DailyItemEntry>;
  cortesias?: Record<string, DailyItemEntry>;
}

export interface GDVUnitData {
  servicos: number | null;
  produtos: number | null;
  assinaturas: number | null;
  isNonWorkingDay?: boolean;
}

export interface GDVEntry {
  id: string; // YYYY-MM-DD
  date: string; // Data de Lancamento (YYYY-MM-DD)
  dueDate?: string; // Data de Vencimento (YYYY-MM-DD)
  units: Record<string, GDVUnitData>; // unit => data
  recorrencia: number;
}

export interface MonthlyUnitStats {
  id: string; // YYYY-MM_UNIT_ID
  unitId: string;
  month: string; // YYYY-MM
  faturamentoTotal: number;
  faturamentoAssinatura: number;
  assinantes: number;
  assinantesNovos?: number;
  assinantesCancelados?: number;
  assinantesReativados?: number;
  frequenciaAssinantes?: number;
  valorFichaAssinantes?: number;
  clientesNovos: number;
  clientesSemPreferencia: number;
  taxaRetorno?: number; // %
  vendaProdutosValor?: number;
  clientesAtendidos?: number;
  servicosRealizados?: number;
  vendasProdutosQtd?: number;
  extraCounts?: Record<string, number>; // itemId => quantity value
  extraValues?: Record<string, number>; // itemId => monetary value
}

export interface MonthlyBarberStats {
  id: string; // YYYY-MM_BARBER_ID
  barberId: string;
  unitId: string; // the unit the barber belongs to for this month
  month: string; // YYYY-MM
  faturamentoTotal: number; // Faturamento Total = Faturamento Avulso + Faturamento Assinatura
  faturamentoAvulso?: number; // Faturamento de atendimentos e serviços avulsos
  faturamentoAssinatura: number; // Faturamento de assinaturas / pote
  comissao: number;
  clientesAtendidos: number;
  servicosRealizados: number;
  vendaProdutosValor: number;
  vendasProdutosQtd: number;
  taxaRetorno: number; // %
  clientesNovos: number;
  clientesSemPreferencia: number;
  extraCounts?: Record<string, number>; // itemId => quantity value
  extraValues?: Record<string, number>; // itemId => monetary value
}

export interface SystemNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
  createdAt: string; // ISO date string
  read: boolean;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'INFO' | 'IMPORTANT' | 'ALERT' | 'CELEBRATION';
  unitId: string; // 'ALL' or specific unit ID
  createdAt: string; // ISO date string
  createdBy: string; // Admin's Name
}

export interface GDVSettings {
  id: string; // YYYY-MM
  metaGeral: number;
  units: Record<string, {
    metaQuinzenal: number;
    metaMensal: number;
    diasNaoUteisQuinzenal: number;
    diasNaoUteisMensal: number;
  }>;
}


export interface FinancialTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  pixKey?: string;
  category: string; // e.g., 'Aluguel', 'Fornecedores', 'Agua/Luz', 'Venda Direta'
  description: string;
  amount: number;
  date: string; // Data de Lancamento (YYYY-MM-DD)
  dueDate?: string; // Data de Vencimento (YYYY-MM-DD)
  unitId: string; // 'ALL' or specific unit ID
  status: 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'AGENDADO';
  recurrence?: string;
  supplier?: string;
  classification?: string;
  subclassification?: string;
  customIntervalType?: "DAYS" | "WEEKS" | "MONTHS";
  customIntervalValue?: number;
  installments?: number;
  installmentIndex?: number;
}
export interface FinancialCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  pixKey?: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface FinClassification {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  pixKey?: string;
}
export interface FinSubclassification {
  id: string;
  name: string;
  classificationId: string;
}
