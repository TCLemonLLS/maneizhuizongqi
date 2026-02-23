export interface Transaction {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  created_at: string;
}

export interface Stats {
  total_income: number;
  total_expense: number;
}
