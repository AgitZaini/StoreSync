import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Crown,
  History,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  Package,
  PackageCheck,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Server,
  ShoppingCart,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { RadialGauge, SalesTrendChart, SplitBar, WeekdayBars } from "./components/charts";
import type { SplitSegment } from "./components/charts";
import { NotificationMenu, SearchBox, Sidebar, UserMenu } from "./components/layout";
import type { NavItem } from "./components/layout";
import { buttonStyles, iconButtonClass, inputClass } from "./components/styles";
import {
  Avatar,
  Card,
  DataTable,
  EmptyState,
  Field,
  Logo,
  Notice,
  Pill,
  PurchaseStatusBadge,
  StatCard,
  StockBadge,
} from "./components/ui";
import type { PillTone, Trend } from "./components/ui";
import { api } from "./lib/api";
import { authStorage } from "./lib/auth-storage";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatPercent,
  getInitials,
} from "./lib/format";
import { getDailySales, getPaymentBreakdown, getTopProducts, getWeekdayActivity } from "./lib/sales-insights";
import { cn } from "./lib/utils";
import type { AuthResponse, AuthUser, MeResponse, UserRole } from "./types/auth";
import type { DashboardSummary, DashboardSummaryResponse } from "./types/dashboard";
import type { Deposit, DepositsResponse, ExpensesResponse, FinanceSummary, FinanceSummaryResponse, OperationalExpense } from "./types/finance";
import type { HealthResponse } from "./types/health";
import type { NotificationItem, NotificationsResponse } from "./types/notification";
import type { CategoriesResponse, Product, ProductCategory, ProductsResponse } from "./types/product";
import type { PurchaseRequest, PurchaseRequestsResponse } from "./types/purchase-request";
import type { PaymentMethod, SalesTransaction, SalesTransactionsResponse } from "./types/sales";

type ApiState = "checking" | "online" | "offline";
type DashboardMenuKey =
  | "dashboard"
  | "approval"
  | "finance"
  | "users"
  | "sales"
  | "stock"
  | "purchase"
  | "deposit"
  | "history";

const demoAccounts: Array<{ label: string; email: string; role: UserRole; description: string }> = [
  { label: "Sales", email: "sales@storesync.local", role: "SALES", description: "Input penjualan cepat" },
  { label: "Supervisor", email: "supervisor@storesync.local", role: "SUPERVISOR", description: "Monitor stok dan tim" },
  { label: "Pemilik", email: "owner@storesync.local", role: "OWNER", description: "Approval dan laporan" },
];

const roleCopy: Record<UserRole, { title: string; description: string; items: string[] }> = {
  OWNER: {
    title: "Dashboard Pemilik",
    description: "Pantau seluruh penjualan, kas, stok kritis, dan approval SPP dari satu layar.",
    items: ["Approval SPP", "Laporan keuangan", "Ringkasan kas", "Manajemen user"],
  },
  SUPERVISOR: {
    title: "Dashboard Supervisor",
    description: "Awasi aktivitas sales, stok harian, deposit, dan pengajuan pembelian stok.",
    items: ["Monitor sales", "Buat SPP", "Input deposit", "Opname stok"],
  },
  SALES: {
    title: "Dashboard Sales",
    description: "Catat transaksi penjualan, cek stok tersedia, dan pantau riwayat transaksi sendiri.",
    items: ["Input penjualan", "Lihat stok", "Riwayat pribadi", "Target harian"],
  },
};

const roleMenus: Record<UserRole, Array<Omit<NavItem<DashboardMenuKey>, "badge" | "badgeTone">>> = {
  OWNER: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
    { key: "approval", label: "Approval SPP", icon: ClipboardCheck, group: "main" },
    { key: "finance", label: "Keuangan", icon: Wallet, group: "manage" },
    { key: "users", label: "Pengguna", icon: Users, group: "manage" },
  ],
  SUPERVISOR: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
    { key: "sales", label: "Penjualan", icon: ShoppingCart, group: "main" },
    { key: "stock", label: "Stok", icon: Package, group: "main" },
    { key: "purchase", label: "SPP", icon: ClipboardList, group: "manage" },
    { key: "deposit", label: "Deposit", icon: Landmark, group: "manage" },
  ],
  SALES: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
    { key: "sales", label: "Input Penjualan", icon: ShoppingCart, group: "main" },
    { key: "stock", label: "Stok", icon: Package, group: "main" },
    { key: "history", label: "Riwayat", icon: History, group: "manage" },
  ],
};

const menuTitles: Record<DashboardMenuKey, string> = {
  dashboard: "Dashboard",
  approval: "Approval & Keuangan",
  finance: "Keuangan",
  users: "Manajemen Pengguna",
  sales: "Penjualan",
  stock: "Stok Produk",
  purchase: "Surat Permintaan Pembelian",
  deposit: "Deposit Kas",
  history: "Riwayat Penjualan",
};

const roleLabels: Record<UserRole, string> = {
  OWNER: "Pemilik",
  SUPERVISOR: "Supervisor",
  SALES: "Sales",
};

const roleIcons: Record<UserRole, LucideIcon> = {
  OWNER: Crown,
  SUPERVISOR: BriefcaseBusiness,
  SALES: ShoppingCart,
};

const quickActions: Record<UserRole, { key: DashboardMenuKey; label: string; icon: LucideIcon }> = {
  OWNER: { key: "approval", label: "Tinjau SPP", icon: ClipboardCheck },
  SUPERVISOR: { key: "purchase", label: "Buat SPP", icon: Plus },
  SALES: { key: "sales", label: "Catat penjualan", icon: Plus },
};

const paymentMeta: Record<PaymentMethod, { label: string; icon: LucideIcon; color: SplitSegment["color"] }> = {
  CASH: { label: "Tunai", icon: Banknote, color: "blue" },
  TRANSFER: { label: "Transfer", icon: ArrowRightLeft, color: "green" },
  QRIS: { label: "QRIS", icon: QrCode, color: "orange" },
  OTHER: { label: "Lainnya", icon: Coins, color: "gray" },
};

const alertTones = {
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-brand-50 text-brand-600",
  green: "bg-green-50 text-green-600",
};

function App() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [serviceName, setServiceName] = useState("storesync-api");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("SALES");
  const [email, setEmail] = useState("sales@storesync.local");
  const [password, setPassword] = useState("Password123!");
  const [isLoading, setIsLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    unit: "pcs",
    purchasePrice: "0",
    sellingPrice: "0",
    stockQuantity: "0",
    minimumStock: "0",
    categoryId: "",
  });
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [salesMessage, setSalesMessage] = useState<string | null>(null);
  const [salesForm, setSalesForm] = useState({
    productId: "",
    quantity: "1",
    customerName: "",
    paymentMethod: "CASH" as PaymentMethod,
  });
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    productId: "",
    quantity: "1",
    estimatedPrice: "0",
    supplier: "",
    note: "",
  });
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [financeMessage, setFinanceMessage] = useState<string | null>(null);
  const [depositForm, setDepositForm] = useState({
    amount: "0",
    destination: "Kas toko",
    note: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "0",
    category: "Operasional",
    note: "",
  });
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeMenu, setActiveMenu] = useState<DashboardMenuKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    api
      .get<HealthResponse>("/health")
      .then((response) => {
        setServiceName(response.data.service);
        setApiState("online");
      })
      .catch(() => {
        setApiState("offline");
      });
  }, []);

  useEffect(() => {
    const token = authStorage.getAccessToken();

    if (!token) {
      return;
    }

    api
      .get<MeResponse>("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => authStorage.clear());
  }, []);

  const statusLabel =
    apiState === "checking" ? "Checking API" : apiState === "online" ? "API online" : "API offline";

  const dashboard = useMemo(() => (user ? roleCopy[user.role] : null), [user]);
  const canManageStock = user?.role === "OWNER" || user?.role === "SUPERVISOR";
  const canUsePurchaseRequests = user?.role === "OWNER" || user?.role === "SUPERVISOR";
  const canUseFinance = user?.role === "OWNER" || user?.role === "SUPERVISOR";

  const selectLoginRole = (role: UserRole) => {
    const account = demoAccounts.find((demoAccount) => demoAccount.role === role);

    setSelectedRole(role);
    if (account) {
      setEmail(account.email);
      setPassword("Password123!");
    }
  };

  const loadInventory = async () => {
    const [productsResponse, categoriesResponse] = await Promise.all([
      api.get<ProductsResponse>("/products"),
      api.get<CategoriesResponse>("/products/categories"),
    ]);

    setProducts(productsResponse.data.products);
    setCategories(categoriesResponse.data.categories);
  };

  const loadSales = async () => {
    const response = await api.get<SalesTransactionsResponse>("/sales");
    setTransactions(response.data.transactions);
  };

  const loadPurchaseRequests = async () => {
    if (!canUsePurchaseRequests) {
      setPurchaseRequests([]);
      return;
    }

    const response = await api.get<PurchaseRequestsResponse>("/purchase-requests");
    setPurchaseRequests(response.data.purchaseRequests);
  };

  const loadFinance = async () => {
    if (!canUseFinance) {
      setFinanceSummary(null);
      setDeposits([]);
      setExpenses([]);
      return;
    }

    const [summaryResponse, depositsResponse, expensesResponse] = await Promise.all([
      api.get<FinanceSummaryResponse>("/finance/summary"),
      api.get<DepositsResponse>("/deposits"),
      api.get<ExpensesResponse>("/finance/expenses"),
    ]);

    setFinanceSummary(summaryResponse.data.summary);
    setDeposits(depositsResponse.data.deposits);
    setExpenses(expensesResponse.data.expenses);
  };

  const loadDashboard = async () => {
    const [dashboardResponse, notificationsResponse] = await Promise.all([
      api.get<DashboardSummaryResponse>("/dashboard/summary"),
      api.get<NotificationsResponse>("/notifications"),
    ]);

    setDashboardSummary(dashboardResponse.data.summary);
    setNotifications(notificationsResponse.data.notifications);
  };

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setCategories([]);
      setTransactions([]);
      setPurchaseRequests([]);
      setFinanceSummary(null);
      setDeposits([]);
      setExpenses([]);
      setDashboardSummary(null);
      setNotifications([]);
      return;
    }

    Promise.all([loadInventory(), loadSales(), loadPurchaseRequests(), loadFinance(), loadDashboard()]).catch(() =>
      setProductMessage("Gagal memuat data dashboard."),
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const availableMenus = roleMenus[user.role];
    if (!availableMenus.some((menu) => menu.key === activeMenu)) {
      setActiveMenu("dashboard");
    }
  }, [activeMenu, user]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setAuthMessage(null);

    try {
      const response = await api.post<AuthResponse>("/auth/login", { email, password });
      authStorage.setTokens(response.data.accessToken, response.data.refreshToken);
      setUser(response.data.user);
    } catch {
      authStorage.clear();
      setAuthMessage("Login gagal. Periksa email, password, atau status backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const refreshToken = authStorage.getRefreshToken();

    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }

    authStorage.clear();
    setUser(null);
  };

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductMessage(null);

    try {
      await api.post("/products/categories", { name: categoryName });
      setCategoryName("");
      await loadInventory();
      setProductMessage("Kategori berhasil ditambahkan.");
    } catch {
      setProductMessage("Gagal menambahkan kategori.");
    }
  };

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductMessage(null);

    try {
      await api.post("/products", {
        ...productForm,
        categoryId: productForm.categoryId || undefined,
        purchasePrice: Number(productForm.purchasePrice),
        sellingPrice: Number(productForm.sellingPrice),
        stockQuantity: Number(productForm.stockQuantity),
        minimumStock: Number(productForm.minimumStock),
      });
      setProductForm({
        name: "",
        sku: "",
        unit: "pcs",
        purchasePrice: "0",
        sellingPrice: "0",
        stockQuantity: "0",
        minimumStock: "0",
        categoryId: "",
      });
      await loadInventory();
      setProductMessage("Produk berhasil ditambahkan.");
    } catch {
      setProductMessage("Gagal menambahkan produk. Periksa SKU dan input lainnya.");
    }
  };

  const handleAdjustStock = async (product: Product) => {
    const nextQuantity = window.prompt(`Stok baru untuk ${product.name}`, String(product.stockQuantity));

    if (nextQuantity === null) {
      return;
    }

    const quantity = Number(nextQuantity);

    if (!Number.isInteger(quantity) || quantity < 0) {
      setProductMessage("Stok harus berupa angka bulat minimal 0.");
      return;
    }

    try {
      await api.post(`/inventory/products/${product.id}/adjust`, {
        quantity,
        note: "Adjusted from StoreSync dashboard",
      });
      await loadInventory();
      setProductMessage("Stok berhasil disesuaikan.");
    } catch {
      setProductMessage("Gagal menyesuaikan stok.");
    }
  };

  const handleCreateSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSalesMessage(null);

    if (!salesForm.productId) {
      setSalesMessage("Pilih produk terlebih dahulu.");
      return;
    }

    const quantity = Number(salesForm.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setSalesMessage("Jumlah penjualan harus lebih dari 0.");
      return;
    }

    try {
      await api.post("/sales", {
        customerName: salesForm.customerName || undefined,
        paymentMethod: salesForm.paymentMethod,
        items: [
          {
            productId: salesForm.productId,
            quantity,
          },
        ],
      });
      setSalesForm((current) => ({ ...current, quantity: "1", customerName: "" }));
      await Promise.all([loadInventory(), loadSales()]);
      setSalesMessage("Transaksi penjualan berhasil dicatat.");
    } catch {
      setSalesMessage("Gagal mencatat penjualan. Pastikan stok produk mencukupi.");
    }
  };

  const handleCreatePurchaseRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPurchaseMessage(null);

    if (!purchaseForm.productId) {
      setPurchaseMessage("Pilih produk untuk SPP.");
      return;
    }

    try {
      await api.post("/purchase-requests", {
        supplier: purchaseForm.supplier || undefined,
        note: purchaseForm.note || undefined,
        items: [
          {
            productId: purchaseForm.productId,
            quantity: Number(purchaseForm.quantity),
            estimatedPrice: Number(purchaseForm.estimatedPrice),
          },
        ],
      });
      setPurchaseForm({
        productId: "",
        quantity: "1",
        estimatedPrice: "0",
        supplier: "",
        note: "",
      });
      await loadPurchaseRequests();
      setPurchaseMessage("SPP berhasil dibuat dan menunggu approval.");
    } catch {
      setPurchaseMessage("Gagal membuat SPP. Periksa produk, jumlah, dan estimasi harga.");
    }
  };

  const handleOwnerDecision = async (purchaseRequest: PurchaseRequest, action: "approve" | "reject" | "request-revision") => {
    const note = window.prompt("Catatan Pemilik (opsional)", "");

    if (note === null) {
      return;
    }

    try {
      await api.post(`/purchase-requests/${purchaseRequest.id}/${action}`, { note: note || undefined });
      await loadPurchaseRequests();
      setPurchaseMessage("Status SPP berhasil diperbarui.");
    } catch {
      setPurchaseMessage("Gagal memperbarui status SPP.");
    }
  };

  const handleRealizePurchaseRequest = async (purchaseRequest: PurchaseRequest) => {
    const realizedItems = [];

    for (const item of purchaseRequest.items) {
      const actualPrice = window.prompt(`Harga aktual untuk ${item.product.name}`, item.estimatedPrice);

      if (actualPrice === null) {
        return;
      }

      realizedItems.push({
        itemId: item.id,
        actualPrice: Number(actualPrice),
      });
    }

    try {
      await api.post(`/purchase-requests/${purchaseRequest.id}/realize`, {
        items: realizedItems,
        note: "Realisasi pembelian stok dari dashboard StoreSync",
      });
      await Promise.all([loadInventory(), loadPurchaseRequests()]);
      setPurchaseMessage("Pembelian berhasil direalisasikan dan stok bertambah.");
    } catch {
      setPurchaseMessage("Gagal merealisasikan pembelian.");
    }
  };

  const handleCreateDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFinanceMessage(null);

    try {
      await api.post("/deposits", {
        amount: Number(depositForm.amount),
        destination: depositForm.destination,
        note: depositForm.note || undefined,
      });
      setDepositForm({ amount: "0", destination: "Kas toko", note: "" });
      await loadFinance();
      setFinanceMessage("Deposit berhasil dicatat.");
    } catch {
      setFinanceMessage("Gagal mencatat deposit.");
    }
  };

  const handleCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFinanceMessage(null);

    try {
      await api.post("/finance/expenses", {
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        category: expenseForm.category || undefined,
        note: expenseForm.note || undefined,
      });
      setExpenseForm({ title: "", amount: "0", category: "Operasional", note: "" });
      await loadFinance();
      setFinanceMessage("Biaya operasional berhasil dicatat.");
    } catch {
      setFinanceMessage("Gagal mencatat biaya operasional.");
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    await api.post("/notifications/read-all").catch(() => undefined);
    await loadDashboard().catch(() => undefined);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadInventory(), loadSales(), loadPurchaseRequests(), loadFinance(), loadDashboard()]).catch(() =>
      setProductMessage("Gagal memuat data dashboard."),
    );
    setIsRefreshing(false);
  };

  const apiDot = apiState === "online" ? "bg-green-500" : apiState === "offline" ? "bg-red-500" : "bg-amber-400";

  if (!user || !dashboard) {
    return (
      <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)]">
        <section className="relative hidden overflow-hidden bg-navy-950 px-12 py-12 text-white lg:flex xl:px-16">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-56 -left-32 size-[600px] rounded-full bg-brand-600/45 blur-[120px]" />
          <div className="pointer-events-none absolute -right-40 top-16 size-80 rounded-full bg-brand-400/15 blur-[100px]" />

          <div className="relative flex w-full max-w-[460px] flex-col">
            <Logo inverted />

            <div className="mt-auto pt-16">
              <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight xl:text-[46px]">
                Monitoring toko dalam satu layar.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                Aplikasi monitoring dan manajemen toko untuk Sales, Supervisor, dan Pemilik.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {demoAccounts.map((account) => {
                const isSelected = selectedRole === account.role;
                const RoleIcon = roleIcons[account.role];

                return (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => selectLoginRole(account.role)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-brand-400/60 bg-white/10 shadow-[0_0_0_4px_rgb(58_115_243/0.15)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl transition",
                        isSelected ? "bg-linear-to-b from-brand-500 to-brand-600 shadow-button" : "bg-white/10 text-white/80",
                      )}
                    >
                      <RoleIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">{account.label}</span>
                      <span className="mt-0.5 block text-sm text-white/60">{account.description}</span>
                    </span>
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border transition",
                        isSelected ? "border-brand-400 bg-brand-500" : "border-white/25",
                      )}
                    >
                      {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-10 text-xs text-white/40">© {new Date().getFullYear()} StoreSync</p>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-[440px] rounded-3xl border border-line bg-white p-6 shadow-[0_24px_48px_-24px_rgb(16_24_40/0.18)] sm:p-10"
          >
            <Logo className="mb-8 lg:hidden" />
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Masuk ke StoreSync</h2>
            <p className="mt-1.5 text-sm text-muted">Gunakan akun sesuai role operasional toko.</p>

            <div className="mt-8 space-y-5">
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-gray-700">Pilih role</span>
                <div role="radiogroup" aria-label="Pilih role" className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.role}
                      type="button"
                      role="radio"
                      aria-checked={selectedRole === account.role}
                      onClick={() => selectLoginRole(account.role)}
                      className={cn(
                        "h-9 rounded-lg text-sm font-medium transition",
                        selectedRole === account.role
                          ? "bg-white text-ink shadow-[0_1px_3px_rgb(16_24_40/0.12)]"
                          : "text-muted hover:text-ink",
                      )}
                    >
                      {account.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Email / Username">
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={cn(inputClass, "pl-10")}
                    placeholder="sales@storesync.id"
                  />
                </span>
              </Field>

              <Field label="Password">
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className={cn(inputClass, "pl-10")}
                    placeholder="••••••••"
                  />
                </span>
              </Field>

              {authMessage ? <Notice tone="red">{authMessage}</Notice> : null}

              <button disabled={isLoading} className={cn(buttonStyles.primary, "h-11 w-full")}>
                {isLoading ? "Memproses..." : "Masuk"}
                {isLoading ? null : <ArrowRight />}
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-muted">Lupa password? Hubungi Pemilik atau admin toko.</p>
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-subtle">
              <span className={cn("size-2 rounded-full", apiDot)} />
              {statusLabel} · {serviceName}
            </p>
          </form>
        </section>
      </main>
    );
  }

  const availableMenus = roleMenus[user.role];
  const currentMenu = availableMenus.some((menu) => menu.key === activeMenu) ? activeMenu : "dashboard";
  const roleLabel = roleLabels[user.role];
  const pageTitle = currentMenu === "dashboard" ? dashboard.title : menuTitles[currentMenu];
  const waitingRequests = purchaseRequests.filter((request) => request.status === "WAITING_APPROVAL");
  const lowStockProducts = products.filter((product) => product.stockStatus !== "SAFE");
  const latestTransactions = transactions.slice(0, 5);
  const salesTotal = dashboardSummary?.todaySalesTotal ?? 0;
  const monthlySales = dashboardSummary?.monthlySalesTotal ?? 0;
  const monthlySalesCount = dashboardSummary?.monthlySalesCount ?? 0;
  const grossProfit = financeSummary?.grossProfit ?? Math.max(monthlySales * 0.31, 0);
  const cashBalance = financeSummary?.cashBalance ?? 0;
  const userRows = [
    { name: "Rani Supervisor", email: "rani@storesync.id", role: "Supervisor", status: "Aktif", lastLogin: "Hari ini" },
    { name: "Alya Sales", email: "alya@storesync.id", role: "Sales", status: "Aktif", lastLogin: "10 menit lalu" },
    { name: "Bima Sales", email: "bima@storesync.id", role: "Sales", status: "Aktif", lastLogin: "1 jam lalu" },
    { name: "Citra Sales", email: "citra@storesync.id", role: "Sales", status: "Nonaktif", lastLogin: "7 hari lalu" },
  ];

  // Charts are derived from the latest transactions returned by /sales (max 100).
  const dailySales = getDailySales(transactions, 30);
  const hasRecentSales = dailySales.some((day) => day.count > 0);
  const weekdayActivity = getWeekdayActivity(transactions);
  const paymentSegments: SplitSegment[] = getPaymentBreakdown(transactions)
    .filter((payment) => payment.method !== "OTHER" || payment.count > 0)
    .map((payment) => ({
      ...paymentMeta[payment.method],
      value: payment.count,
      caption: formatCompactCurrency(payment.total),
    }));
  const topProducts = getTopProducts(transactions, 5);
  const todaySales = user.role === "SALES" ? dashboardSummary?.mySalesTodayTotal ?? 0 : salesTotal;
  const todaySalesCount = user.role === "SALES" ? dashboardSummary?.mySalesTodayCount ?? 0 : dashboardSummary?.todaySalesCount ?? 0;
  const yesterdaySales = dailySales[dailySales.length - 2]?.total ?? 0;
  const salesTrend: Trend | undefined =
    yesterdaySales > 0
      ? {
          value: Math.abs(((todaySales - yesterdaySales) / yesterdaySales) * 100),
          direction: todaySales >= yesterdaySales ? "up" : "down",
        }
      : undefined;
  const profitMargin =
    financeSummary && financeSummary.salesTotal > 0 ? (financeSummary.grossProfit / financeSummary.salesTotal) * 100 : null;
  const stockHealth = products.length > 0 ? ((products.length - lowStockProducts.length) / products.length) * 100 : 0;
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;
  const hasMenu = (key: DashboardMenuKey) => availableMenus.some((menu) => menu.key === key);
  const quickAction = quickActions[user.role];
  const menuBadges: Partial<Record<DashboardMenuKey, number>> = {
    approval: waitingRequests.length,
    purchase: waitingRequests.length,
    stock: lowStockProducts.length,
  };
  const navItems: NavItem<DashboardMenuKey>[] = availableMenus.map((menu) => ({
    ...menu,
    badge: menuBadges[menu.key],
    badgeTone: menu.key === "stock" ? "orange" : "green",
  }));
  const alerts = [
    {
      area: "Stok",
      title: lowStockProducts[0] ? `${lowStockProducts[0].name} perlu dicek` : "Semua stok aman",
      impact: "Penjualan",
      icon: Package,
      tone: "orange" as const,
    },
    { area: "Kas", title: `Saldo ${formatCurrency(cashBalance)}`, impact: "Keuangan", icon: Wallet, tone: "blue" as const },
    {
      area: "Notifikasi",
      title: `${unreadNotifications} belum dibaca`,
      impact: "Operasional",
      icon: Bell,
      tone: "green" as const,
    },
  ];

  const selectMenu = (key: DashboardMenuKey) => {
    setActiveMenu(key);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar
        items={navItems}
        activeKey={currentMenu}
        onSelect={selectMenu}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        statusRows={[
          { icon: Server, label: `${statusLabel} · ${serviceName}`, dot: apiDot },
          { icon: Store, label: "Toko Utama aktif", dot: "bg-green-500" },
        ]}
        account={{ title: `Mode ${roleLabel}`, description: `${user.name} · akses sesuai role PRD` }}
        onLogout={handleLogout}
      />

      <div className={cn("min-w-0 transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className={cn(iconButtonClass, "lg:hidden")}
              aria-label="Buka menu"
            >
              <Menu className="size-[18px]" />
            </button>
            <SearchBox
              menus={navItems}
              products={products}
              productMenuKey={hasMenu("stock") ? "stock" : null}
              onNavigate={selectMenu}
            />
            <div className="ml-auto flex items-center gap-2.5">
              <NotificationMenu notifications={notifications} onMarkAllRead={handleMarkAllNotificationsRead} />
              <UserMenu
                name={user.name}
                email={user.email}
                roleLabel={roleLabel}
                initials={getInitials(user.name)}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{pageTitle}</h1>
              <p className="mt-1 text-sm text-muted">
                {currentMenu === "dashboard" ? dashboard.description : `${roleLabel} · Toko Utama`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-card">
                <CalendarDays className="size-4 text-muted" />
                {formatLongDate(new Date())}
              </span>
              <button type="button" onClick={handleRefresh} disabled={isRefreshing} className={buttonStyles.secondary}>
                <RefreshCw className={cn(isRefreshing && "animate-spin")} />
                Muat ulang
              </button>
              {currentMenu !== quickAction.key ? (
                <button type="button" onClick={() => selectMenu(quickAction.key)} className={buttonStyles.primary}>
                  <quickAction.icon />
                  {quickAction.label}
                </button>
              ) : null}
            </div>
          </div>

          {currentMenu === "dashboard" ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label={user.role === "SALES" ? "Penjualan Saya Hari Ini" : "Pendapatan Hari Ini"}
                  value={formatCompactCurrency(todaySales)}
                  title={formatCurrency(todaySales)}
                  icon={TrendingUp}
                  trend={salesTrend}
                  caption={
                    yesterdaySales > 0
                      ? `vs. ${formatCompactCurrency(yesterdaySales)} kemarin`
                      : `${todaySalesCount} transaksi hari ini`
                  }
                />
                <StatCard
                  label="Laba Kotor Bulan Ini"
                  value={formatCompactCurrency(grossProfit)}
                  title={formatCurrency(grossProfit)}
                  icon={PiggyBank}
                  trend={profitMargin === null ? undefined : { label: `margin ${formatPercent(profitMargin)}`, tone: "blue" }}
                  caption="Margin operasional"
                />
                <StatCard
                  label="Kas Toko"
                  value={formatCompactCurrency(cashBalance)}
                  title={formatCurrency(cashBalance)}
                  icon={Wallet}
                  caption={`${deposits.length} deposit tercatat`}
                />
                {user.role === "SALES" ? (
                  <StatCard
                    label="Stok Perlu Dicek"
                    value={`${lowStockProducts.length}`}
                    icon={Package}
                    trend={lowStockProducts.length > 0 ? { label: "cek stok", tone: "orange" } : undefined}
                    caption="Prioritas penjualan"
                  />
                ) : (
                  <StatCard
                    label="SPP Menunggu"
                    value={`${waitingRequests.length}`}
                    icon={ClipboardList}
                    trend={waitingRequests.length > 0 ? { label: "perlu keputusan", tone: "orange" } : undefined}
                    caption="Butuh keputusan"
                  />
                )}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                <div className="min-w-0 space-y-5">
                  <Card>
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <div className="flex flex-col lg:w-56 lg:shrink-0">
                        <h3 className="text-[15px] font-semibold tracking-tight text-ink">Penjualan Bulan Ini</h3>
                        <p
                          title={formatCurrency(monthlySales)}
                          className="mt-6 text-[40px] font-semibold leading-none tracking-tight text-ink tabular-nums lg:mt-auto"
                        >
                          {formatCompactCurrency(monthlySales)}
                        </p>
                        <p className="mt-3 text-sm text-muted">
                          {monthlySalesCount} transaksi
                          {monthlySalesCount > 0
                            ? ` · rata-rata ${formatCompactCurrency(monthlySales / monthlySalesCount)}`
                            : ""}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex items-center justify-end gap-2 text-xs text-muted">
                          <span className="h-0.5 w-3 rounded-full bg-brand-500" />
                          {user.role === "SALES" ? "Penjualan saya" : "Penjualan harian"} · 30 hari terakhir
                        </div>
                        {hasRecentSales ? (
                          <SalesTrendChart points={dailySales} />
                        ) : (
                          <EmptyState icon={TrendingUp}>Belum ada penjualan dalam 30 hari terakhir.</EmptyState>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-line p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-ink">Metode Pembayaran</h4>
                        <span className="text-xs text-muted">{transactions.length} transaksi terakhir</span>
                      </div>
                      <SplitBar segments={paymentSegments} />
                    </div>
                  </Card>

                  <Card
                    title="Produk Terlaris"
                    action={<span className="text-xs text-muted">Dari {transactions.length} transaksi terakhir</span>}
                  >
                    <DataTable
                      emphasizeFirst={false}
                      minWidth="min-w-[600px]"
                      headers={["SKU", "Produk", "Terjual", "Pendapatan", "Stok"]}
                      rows={topProducts.map((topProduct) => {
                        const product = products.find((item) => item.id === topProduct.productId);

                        return [
                          topProduct.sku,
                          <ProductName key={topProduct.productId} name={topProduct.name} />,
                          `${topProduct.quantity} ${topProduct.unit}`,
                          <span key={topProduct.productId} className="inline-flex items-center gap-1.5 font-medium text-green-600">
                            <Banknote className="size-4" />
                            {formatCurrency(topProduct.revenue)}
                          </span>,
                          product ? <StockBadge key={topProduct.productId} status={product.stockStatus} /> : "-",
                        ];
                      })}
                    />
                  </Card>
                </div>

                <div className="grid content-start gap-5 sm:grid-cols-2 xl:grid-cols-1">
                  <Card title="Hari Paling Ramai" action={<span className="text-xs text-muted">Jumlah transaksi</span>}>
                    <WeekdayBars data={weekdayActivity} />
                  </Card>

                  <Card title="Kesehatan Stok" action={<span className="text-xs text-muted">{products.length} produk</span>}>
                    {products.length > 0 ? (
                      <div className="relative mx-auto max-w-[260px]">
                        <RadialGauge
                          value={stockHealth}
                          tone={stockHealth >= 80 ? "green" : stockHealth >= 50 ? "orange" : "red"}
                        />
                        <div className="absolute inset-x-0 top-[36%] flex flex-col items-center text-center">
                          <p className="text-[32px] font-semibold leading-none tracking-tight text-ink tabular-nums">
                            {formatPercent(Math.round(stockHealth))}
                          </p>
                          <p className="mt-2 text-xs text-muted">
                            {lowStockProducts.length > 0
                              ? `${lowStockProducts.length} produk perlu restock`
                              : "Semua stok aman"}
                          </p>
                          {hasMenu("stock") ? (
                            <button
                              type="button"
                              onClick={() => selectMenu("stock")}
                              className={cn(buttonStyles.secondary, buttonStyles.small, "mt-3")}
                            >
                              Lihat stok
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <EmptyState icon={Package}>Belum ada produk.</EmptyState>
                    )}
                  </Card>

                <Card title="Alert Prioritas" className="sm:col-span-2 xl:col-span-1">
                  <div className="divide-y divide-line">
                    {alerts.map((alert) => (
                      <div key={alert.area} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", alertTones[alert.tone])}>
                          <alert.icon className="size-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted">{alert.area}</p>
                          <p className="truncate text-sm font-semibold text-ink">{alert.title}</p>
                          <span className="mt-2 inline-block rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-muted">
                            #{alert.impact}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Card title={user.role === "OWNER" ? "SPP Menunggu Approval" : "Aktivitas Terbaru"}>
                  <DataTable
                    headers={user.role === "OWNER" ? ["SPP", "Supplier", "Estimasi", "Status"] : ["No", "Sales", "Total", "Waktu"]}
                    rows={(user.role === "OWNER" ? waitingRequests.slice(0, 4) : latestTransactions).map((item) =>
                      user.role === "OWNER"
                        ? [
                            (item as PurchaseRequest).requestNo,
                            (item as PurchaseRequest).supplier ?? "Tanpa supplier",
                            formatCurrency((item as PurchaseRequest).items.reduce((sum, row) => sum + Number(row.estimatedPrice), 0)),
                            <PurchaseStatusBadge key={(item as PurchaseRequest).id} status={(item as PurchaseRequest).status} />,
                          ]
                        : [
                            (item as SalesTransaction).transactionNo,
                            (item as SalesTransaction).sales.name,
                            formatCurrency((item as SalesTransaction).total),
                            formatDateTime((item as SalesTransaction).transactionAt),
                          ],
                    )}
                  />
                </Card>

                <Card title={user.role === "SALES" ? "Produk Tersedia" : "Ringkasan Keuangan"}>
                  {user.role === "SALES" ? (
                    <DataTable
                      headers={["Produk", "SKU", "Stok", "Status"]}
                      rows={products.slice(0, 5).map((product) => [
                        product.name,
                        product.sku,
                        `${product.stockQuantity} ${product.unit}`,
                        <StockBadge key={product.id} status={product.stockStatus} />,
                      ])}
                    />
                  ) : (
                    <DataTable
                      headers={["Kategori", "Masuk", "Keluar", "Laba"]}
                      rows={[
                        ["Hari ini", formatCurrency(salesTotal), formatCurrency(financeSummary?.totalExpense ?? 0), formatCurrency(Math.max(salesTotal - (financeSummary?.totalExpense ?? 0), 0))],
                        ["Bulan ini", formatCurrency(monthlySales), formatCurrency(financeSummary?.totalExpense ?? 0), formatCurrency(grossProfit)],
                        ["Deposit", formatCurrency(financeSummary?.depositTotal ?? 0), "-", formatCurrency(cashBalance)],
                      ]}
                    />
                  )}
                </Card>
              </div>
            </>
          ) : null}

          {currentMenu === "approval" ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
                <Card title="Daftar Approval" action={<span className="text-xs text-muted">{purchaseRequests.length} pengajuan</span>}>
                  {purchaseMessage ? (
                    <div className="mb-4">
                      <Notice>{purchaseMessage}</Notice>
                    </div>
                  ) : null}
                  <DataTable
                    headers={["SPP", "Supplier", "Estimasi", "Status"]}
                    rows={purchaseRequests.map((request) => [
                      request.requestNo,
                      request.supplier ?? "Tanpa supplier",
                      formatCurrency(request.items.reduce((sum, item) => sum + Number(item.estimatedPrice), 0)),
                      <PurchaseStatusBadge key={request.id} status={request.status} />,
                    ])}
                  />
                </Card>

                <Card title={waitingRequests[0] ? `${waitingRequests[0].requestNo} · ${waitingRequests[0].supplier ?? "Pengajuan stok"}` : "Detail SPP"}>
                  {waitingRequests[0] ? (
                    <div>
                      <p className="-mt-2 mb-5 text-sm text-muted">Diajukan {formatDateTime(waitingRequests[0].createdAt)}</p>
                      <div className="space-y-2">
                        {waitingRequests[0].items.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm"
                          >
                            <span className="font-medium text-ink">{item.product.name}</span>
                            <span className="text-muted">
                              {item.quantity} {item.product.unit}
                            </span>
                            <span className="font-semibold text-brand-600 tabular-nums">{formatCurrency(item.estimatedPrice)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-8 flex flex-wrap gap-3">
                        <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "reject")} className={buttonStyles.danger}>
                          Tolak
                        </button>
                        <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "approve")} className={buttonStyles.primary}>
                          <Check />
                          Setujui
                        </button>
                        <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "request-revision")} className={buttonStyles.secondary}>
                          Revisi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={ClipboardCheck}>Tidak ada SPP yang menunggu approval.</EmptyState>
                  )}
                </Card>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Pemasukan"
                  value={formatCompactCurrency(financeSummary?.salesTotal ?? monthlySales)}
                  title={formatCurrency(financeSummary?.salesTotal ?? monthlySales)}
                  icon={TrendingUp}
                  caption="Penjualan bulan ini"
                />
                <StatCard
                  label="Pengeluaran"
                  value={formatCompactCurrency(financeSummary?.totalExpense ?? 0)}
                  title={formatCurrency(financeSummary?.totalExpense ?? 0)}
                  icon={Receipt}
                  caption="Stok + operasional"
                />
                <StatCard
                  label="Laba Kotor"
                  value={formatCompactCurrency(grossProfit)}
                  title={formatCurrency(grossProfit)}
                  icon={PiggyBank}
                  caption="Margin berjalan"
                />
                <StatCard
                  label="Saldo Kas"
                  value={formatCompactCurrency(cashBalance)}
                  title={formatCurrency(cashBalance)}
                  icon={Wallet}
                  caption="Kas terkini"
                />
              </div>
            </>
          ) : null}

          {currentMenu === "users" ? (
            <>
              <div className="flex flex-wrap gap-3">
                <button className={buttonStyles.primary}>
                  <UserPlus />
                  Tambah Pengguna
                </button>
                <button className={buttonStyles.secondary}>
                  <KeyRound />
                  Role & Akses
                </button>
              </div>
              <Card title="Daftar Pengguna" action={<span className="text-xs text-muted">{userRows.length} pengguna</span>}>
                <DataTable
                  emphasizeFirst={false}
                  minWidth="min-w-[640px]"
                  headers={["Nama", "Email", "Role", "Status", "Login terakhir"]}
                  rows={userRows.map((row) => [
                    <span key={row.email} className="flex items-center gap-3">
                      <Avatar initials={getInitials(row.name)} />
                      <span className="font-medium text-ink">{row.name}</span>
                    </span>,
                    row.email,
                    row.role,
                    <Pill key={row.email} tone={row.status === "Aktif" ? "green" : "gray"}>
                      {row.status}
                    </Pill>,
                    row.lastLogin,
                  ])}
                />
              </Card>
              <Card title="Ringkasan Akses per Role">
                <div className="divide-y divide-line">
                  <RoleAccessBadge label="Pemilik" tone="violet" text="Semua fitur, approval SPP, laporan lengkap, manajemen pengguna" />
                  <RoleAccessBadge label="Supervisor" tone="blue" text="Monitor penjualan, stok, SPP, deposit, laporan dasar" />
                  <RoleAccessBadge label="Sales" tone="green" text="Input penjualan, lihat stok, target, riwayat sendiri" />
                </div>
              </Card>
            </>
          ) : null}

          {currentMenu === "finance" || currentMenu === "deposit" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card title={currentMenu === "deposit" ? "Catat Deposit" : "Input Keuangan"}>
                {financeMessage ? (
                  <div className="mb-4">
                    <Notice>{financeMessage}</Notice>
                  </div>
                ) : null}
                <div className="grid gap-6">
                  <form onSubmit={handleCreateDeposit} className="grid gap-4">
                    <Field label="Jumlah deposit">
                      <input value={depositForm.amount} onChange={(event) => setDepositForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Contoh: 500000" type="number" className={inputClass} />
                    </Field>
                    <Field label="Tujuan kas">
                      <input value={depositForm.destination} onChange={(event) => setDepositForm((current) => ({ ...current, destination: event.target.value }))} placeholder="Kas toko / bank tujuan" className={inputClass} />
                    </Field>
                    <Field label="Catatan deposit">
                      <input value={depositForm.note} onChange={(event) => setDepositForm((current) => ({ ...current, note: event.target.value }))} placeholder="Opsional" className={inputClass} />
                    </Field>
                    <button className={buttonStyles.primary}>Simpan deposit</button>
                  </form>
                  {currentMenu === "finance" ? (
                    <form onSubmit={handleCreateExpense} className="grid gap-4 border-t border-line pt-6">
                      <Field label="Nama biaya">
                        <input value={expenseForm.title} onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: listrik toko" className={inputClass} />
                      </Field>
                      <Field label="Jumlah biaya">
                        <input value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Contoh: 250000" type="number" className={inputClass} />
                      </Field>
                      <button className={buttonStyles.secondary}>Simpan biaya</button>
                    </form>
                  ) : null}
                </div>
              </Card>
              <Card title="Breakdown Laporan">
                <DataTable
                  headers={["Kategori", "Pemasukan", "Pengeluaran", "Laba"]}
                  rows={[
                    ["Penjualan", formatCurrency(financeSummary?.salesTotal ?? 0), "-", formatCurrency(financeSummary?.grossProfit ?? 0)],
                    ["Pembelian stok", "-", formatCurrency(financeSummary?.purchaseExpenseTotal ?? 0), "-"],
                    ["Operasional", "-", formatCurrency(financeSummary?.operationalExpenseTotal ?? 0), "-"],
                    ["Deposit", formatCurrency(financeSummary?.depositTotal ?? 0), "-", formatCurrency(cashBalance)],
                  ]}
                />
                <div className="mt-6 border-t border-line pt-5">
                  <p className="mb-3 text-sm font-semibold text-ink">Biaya terbaru</p>
                  <div className="space-y-2">
                    {expenses.length === 0 ? <p className="text-sm text-muted">Belum ada biaya tercatat.</p> : null}
                    {expenses.slice(0, 4).map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                        <span className="flex min-w-0 items-center gap-3 font-medium text-ink">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-50 text-orange-600">
                            <Receipt className="size-4" />
                          </span>
                          <span className="truncate">{expense.title}</span>
                        </span>
                        <span className="shrink-0 font-medium text-muted tabular-nums">{formatCurrency(expense.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {currentMenu === "sales" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <Card title="Catat Transaksi">
                {salesMessage ? (
                  <div className="mb-4">
                    <Notice>{salesMessage}</Notice>
                  </div>
                ) : null}
                <form onSubmit={handleCreateSale} className="grid gap-4">
                  <Field label="Produk yang dijual">
                    <select value={salesForm.productId} onChange={(event) => setSalesForm((current) => ({ ...current, productId: event.target.value }))} className={inputClass}>
                      <option value="">Pilih produk</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id} disabled={product.stockQuantity <= 0}>{product.name} · stok {product.stockQuantity}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Jumlah terjual">
                      <input value={salesForm.quantity} onChange={(event) => setSalesForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Masukkan jumlah item" type="number" min={1} className={inputClass} />
                    </Field>
                    <Field label="Metode pembayaran">
                      <select value={salesForm.paymentMethod} onChange={(event) => setSalesForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))} className={inputClass}>
                        {(Object.keys(paymentMeta) as PaymentMethod[]).map((method) => (
                          <option key={method} value={method}>{paymentMeta[method].label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Nama pelanggan">
                    <input value={salesForm.customerName} onChange={(event) => setSalesForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Opsional" className={inputClass} />
                  </Field>
                  <button className={buttonStyles.primary}>Simpan transaksi</button>
                </form>
              </Card>
              <Card title="Transaksi Terbaru">
                <DataTable headers={["No", "Sales", "Total", "Waktu"]} rows={latestTransactions.map((transaction) => [transaction.transactionNo, transaction.sales.name, formatCurrency(transaction.total), formatDateTime(transaction.transactionAt)])} />
              </Card>
            </div>
          ) : null}

          {currentMenu === "stock" ? (
            <div className={cn("grid gap-5", canManageStock && "xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]")}>
              <Card title="Daftar Stok Produk" action={<span className="text-xs text-muted">{products.length} produk</span>}>
                {productMessage ? (
                  <div className="mb-4">
                    <Notice>{productMessage}</Notice>
                  </div>
                ) : null}
                <DataTable
                  emphasizeFirst={false}
                  minWidth="min-w-[640px]"
                  headers={["Produk", "Kategori", "Stok", "Minimum", "Status"]}
                  rows={products.map((product) => [
                    <ProductName key={product.id} name={product.name} sku={product.sku} />,
                    product.category?.name ?? "Tanpa kategori",
                    `${product.stockQuantity} ${product.unit}`,
                    `${product.minimumStock}`,
                    <span key={product.id} className="inline-flex items-center gap-2">
                      <StockBadge status={product.stockStatus} />
                      {canManageStock ? (
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(product)}
                          className={cn(buttonStyles.secondary, buttonStyles.small)}
                        >
                          Adjust
                        </button>
                      ) : null}
                    </span>,
                  ])}
                />
              </Card>

              {canManageStock ? (
                <Card title="Kelola Produk">
                  <div className="grid gap-6">
                    <form onSubmit={handleCreateCategory} className="grid gap-4">
                      <Field label="Nama kategori produk">
                        <input
                          value={categoryName}
                          onChange={(event) => setCategoryName(event.target.value)}
                          placeholder="Contoh: Minuman"
                          className={inputClass}
                        />
                      </Field>
                      <button className={buttonStyles.secondary}>Simpan kategori</button>
                    </form>

                    <form onSubmit={handleCreateProduct} className="grid gap-4 border-t border-line pt-6">
                      <Field label="Nama produk">
                        <input
                          value={productForm.name}
                          onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Contoh: Cup 16oz"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="SKU produk">
                        <input
                          value={productForm.sku}
                          onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                          placeholder="Kode unik produk"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Kategori produk">
                        <select
                          value={productForm.categoryId}
                          onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}
                          className={inputClass}
                        >
                          <option value="">Tanpa kategori</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Harga jual">
                          <input
                            value={productForm.sellingPrice}
                            onChange={(event) => setProductForm((current) => ({ ...current, sellingPrice: event.target.value }))}
                            placeholder="Rp"
                            type="number"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Stok awal">
                          <input
                            value={productForm.stockQuantity}
                            onChange={(event) => setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))}
                            placeholder="Jumlah stok"
                            type="number"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <button className={buttonStyles.primary}>
                        <Plus />
                        Tambah produk
                      </button>
                    </form>
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          {currentMenu === "purchase" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <Card title="Buat SPP">
                {purchaseMessage ? (
                  <div className="mb-4">
                    <Notice>{purchaseMessage}</Notice>
                  </div>
                ) : null}
                <form onSubmit={handleCreatePurchaseRequest} className="grid gap-4">
                  <Field label="Produk yang diminta">
                    <select value={purchaseForm.productId} onChange={(event) => setPurchaseForm((current) => ({ ...current, productId: event.target.value }))} className={inputClass}>
                      <option value="">Pilih produk</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name} · stok {product.stockQuantity}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Jumlah pembelian">
                      <input value={purchaseForm.quantity} onChange={(event) => setPurchaseForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Masukkan jumlah item" type="number" min={1} className={inputClass} />
                    </Field>
                    <Field label="Estimasi harga">
                      <input value={purchaseForm.estimatedPrice} onChange={(event) => setPurchaseForm((current) => ({ ...current, estimatedPrice: event.target.value }))} placeholder="Total estimasi biaya" type="number" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Supplier">
                    <input value={purchaseForm.supplier} onChange={(event) => setPurchaseForm((current) => ({ ...current, supplier: event.target.value }))} placeholder="Nama supplier" className={inputClass} />
                  </Field>
                  <button className={buttonStyles.primary}>Kirim SPP</button>
                </form>
              </Card>
              <Card title="Daftar SPP" action={<span className="text-xs text-muted">{purchaseRequests.length} pengajuan</span>}>
                <DataTable headers={["SPP", "Supplier", "Estimasi", "Status"]} rows={purchaseRequests.map((request) => [request.requestNo, request.supplier ?? "Tanpa supplier", formatCurrency(request.items.reduce((sum, item) => sum + Number(item.estimatedPrice), 0)), <PurchaseStatusBadge key={request.id} status={request.status} />])} />
                <div className="mt-5 flex flex-wrap gap-2">
                  {purchaseRequests
                    .filter((request) => request.status === "APPROVED")
                    .map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => handleRealizePurchaseRequest(request)}
                        className={cn(buttonStyles.secondary, buttonStyles.small)}
                      >
                        <PackageCheck />
                        Realisasi {request.requestNo}
                      </button>
                    ))}
                </div>
              </Card>
            </div>
          ) : null}

          {currentMenu === "history" ? (
            <Card title="Riwayat Penjualan Saya" action={<span className="text-xs text-muted">{transactions.length} transaksi</span>}>
              <DataTable headers={["No", "Produk", "Total", "Waktu"]} rows={transactions.map((transaction) => [transaction.transactionNo, transaction.items.map((item) => item.product.name).join(", "), formatCurrency(transaction.total), formatDateTime(transaction.transactionAt)])} />
            </Card>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;

function ProductName({ name, sku }: { name: string; sku?: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-muted">
        <Package className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[260px] truncate font-medium text-ink">{name}</span>
        {sku ? <span className="block text-xs text-subtle">{sku}</span> : null}
      </span>
    </span>
  );
}

function RoleAccessBadge({ label, tone, text }: { label: string; tone: PillTone; text: string }) {
  return (
    <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr] sm:items-center">
      <Pill tone={tone} className="w-fit">
        {label}
      </Pill>
      <p className="text-sm text-gray-700">{text}</p>
    </div>
  );
}
