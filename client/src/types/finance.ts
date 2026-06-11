export type Deposit = {
  id: string;
  amount: string;
  destination: string;
  note?: string | null;
  depositedAt: string;
  createdAt: string;
};

export type OperationalExpense = {
  id: string;
  title: string;
  amount: string;
  category?: string | null;
  note?: string | null;
  expenseAt: string;
  createdAt: string;
};

export type FinanceSummary = {
  salesTotal: number;
  cogsTotal: number;
  grossProfit: number;
  purchaseExpenseTotal: number;
  operationalExpenseTotal: number;
  totalExpense: number;
  depositTotal: number;
  cashBalance: number;
  salesCount: number;
  expenseCount: number;
  depositCount: number;
};

export type DepositsResponse = {
  deposits: Deposit[];
};

export type ExpensesResponse = {
  expenses: OperationalExpense[];
};

export type FinanceSummaryResponse = {
  summary: FinanceSummary;
};
