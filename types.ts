
export type UserRole = 'admin' | 'coordinator' | 'usher';

export interface UserPermissions {
  registerSales: boolean;
  viewSalesHistory: boolean;
  registerInventory: boolean;
  viewInventoryHistory: boolean;
  registerCompetitorPrices: boolean;
  viewCompetitorReports: boolean;
  viewVacationMgmt: boolean;
  viewSettings: boolean;
  viewColleaguesSales: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  employeeName: string;
  employeeCode: string;
  phone: string;
  isOnline: boolean;
  permissions: UserPermissions;
  vacationBalance: {
    annual: number;
    casual: number;
    sick: number;
    exams: number;
    absent_with_permission?: number;
    absent_without_permission?: number;
  };
}

export interface Notification {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface AppSettings {
  tickerText: string;
  tickerSpeed: number;
  whatsappNumber: string;
  programName: string;
  showTopSalesInTicker?: boolean;
  isTickerAnimated?: boolean;
}

export interface Market {
  id: string;
  name: string;
  creatorId: string;
}

export interface Company {
  id: string;
  name: string;
  creatorId: string;
  products?: string[];
}

export interface SaleItem {
  id: string;
  category: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface DailySale {
  id: string;
  userId: string;
  userName: string;
  marketName: string;
  date: string;
  items: SaleItem[];
  total: number;
}

export interface Vacation {
  id: string;
  userId: string;
  userName: string;
  date: string;
  days: number;
  type: 'annual' | 'casual' | 'sick' | 'exams' | 'absent_with_permission' | 'absent_without_permission';
  createdAt: string;
}

export interface TargetRecord {
  id: string;
  userId: string;
  marketName: string;
  yearMonth: string; // e.g. "2023-10"
  targetValue: number;
}

export interface InventoryRecord {

  id: string;
  userId: string;
  userName: string;
  marketName: string;
  date: string;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
}
