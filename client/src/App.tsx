import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { LogOut } from "lucide-react";
import { api } from "./lib/api";
import { authStorage } from "./lib/auth-storage";
import type { AuthResponse, AuthUser, MeResponse, UserRole } from "./types/auth";
import type { DashboardSummary, DashboardSummaryResponse } from "./types/dashboard";
import type { Deposit, DepositsResponse, ExpensesResponse, FinanceSummary, FinanceSummaryResponse, OperationalExpense } from "./types/finance";
import type { HealthResponse } from "./types/health";
import type { NotificationItem, NotificationsResponse } from "./types/notification";
import type { CategoriesResponse, Product, ProductCategory, ProductsResponse, StockStatus } from "./types/product";
import type { PurchaseRequest, PurchaseRequestsResponse, PurchaseRequestStatus } from "./types/purchase-request";
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

const roleMenus: Record<UserRole, Array<{ key: DashboardMenuKey; label: string }>> = {
  OWNER: [
    { key: "dashboard", label: "Dashboard" },
    { key: "approval", label: "Approval SPP" },
    { key: "finance", label: "Keuangan" },
    { key: "users", label: "Pengguna" },
  ],
  SUPERVISOR: [
    { key: "dashboard", label: "Dashboard" },
    { key: "sales", label: "Penjualan" },
    { key: "stock", label: "Stok" },
    { key: "purchase", label: "SPP" },
    { key: "deposit", label: "Deposit" },
  ],
  SALES: [
    { key: "dashboard", label: "Dashboard" },
    { key: "sales", label: "Input Penjualan" },
    { key: "stock", label: "Stok" },
    { key: "history", label: "Riwayat" },
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

  if (!user || !dashboard) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
        <div className="grid min-h-screen lg:grid-cols-[41%_59%]">
          <section className="flex bg-[#101827] px-8 py-12 text-white sm:px-14 lg:px-[108px] lg:py-[126px]">
            <div className="flex w-full max-w-[442px] flex-col">
              <div>
                <h1 className="text-5xl font-bold tracking-normal sm:text-[64px] sm:leading-[1.05]">StoreSync</h1>
                <p className="mt-5 text-2xl font-semibold leading-9 text-[#c7d7f3]">
                  Aplikasi monitoring dan manajemen toko untuk Sales, Supervisor, dan Pemilik.
                </p>
              </div>

              <div className="mt-16 space-y-9">
                {demoAccounts.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => selectLoginRole(account.role)}
                    className={[
                      "w-full rounded-lg border px-5 py-4 text-left transition",
                      selectedRole === account.role
                        ? "border-[#5b78b4] bg-white/5"
                        : "border-[#33435f] bg-transparent hover:border-[#4d5f7e] hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <span className="block text-xl font-bold text-white">{account.label}</span>
                    <span className="mt-1 block text-base text-slate-300">{account.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-12 sm:px-10">
            <form
              onSubmit={handleLogin}
              className="w-full max-w-[512px] rounded-[18px] border border-slate-200 bg-white px-8 py-10 shadow-sm sm:px-10 sm:py-11"
            >
              <div>
                <h2 className="text-[32px] font-bold leading-tight tracking-normal text-[#101827]">
                  Masuk ke StoreSync
                </h2>
                <p className="mt-2 text-base font-medium text-slate-500">Gunakan akun sesuai role operasional toko.</p>
              </div>

              <div className="mt-12 space-y-7">
                <label className="block">
                  <span className="text-sm font-bold text-slate-800">Email / Username</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="sales@storesync.id"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-800">Password</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="••••••••"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-800">Pilih role</span>
                  <select
                    value={selectedRole}
                    onChange={(event) => selectLoginRole(event.target.value as UserRole)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-500 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {demoAccounts.map((account) => (
                      <option key={account.role} value={account.role}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>

                {authMessage ? <p className="text-sm font-semibold text-rose-600">{authMessage}</p> : null}

                <button
                  disabled={isLoading}
                  className="h-12 w-full rounded-lg bg-[#2f65e7] px-5 text-left text-base font-bold text-white transition hover:bg-[#2558cf] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Memproses..." : "Masuk"}
                </button>
              </div>

              <p className="mt-6 text-base font-medium text-slate-500">
                Lupa password? Hubungi Pemilik atau admin toko.
              </p>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const availableMenus = roleMenus[user.role];
  const currentMenu = availableMenus.some((menu) => menu.key === activeMenu) ? activeMenu : "dashboard";
  const roleLabel = roleLabels[user.role];
  const pageTitle = currentMenu === "dashboard" ? `${roleLabel} Dashboard` : menuTitles[currentMenu];
  const waitingRequests = purchaseRequests.filter((request) => request.status === "WAITING_APPROVAL");
  const lowStockProducts = products.filter((product) => product.stockStatus !== "SAFE");
  const latestTransactions = transactions.slice(0, 5);
  const salesTotal = dashboardSummary?.todaySalesTotal ?? 0;
  const monthlySales = dashboardSummary?.monthlySalesTotal ?? 0;
  const grossProfit = financeSummary?.grossProfit ?? Math.max(monthlySales * 0.31, 0);
  const cashBalance = financeSummary?.cashBalance ?? 0;
  const chartBars = [46, 60, 55, 74, 82, 78, 92, 100, 95, 108];
  const userRows = [
    { name: "Rani Supervisor", email: "rani@storesync.id", role: "Supervisor", status: "Aktif", lastLogin: "Hari ini" },
    { name: "Alya Sales", email: "alya@storesync.id", role: "Sales", status: "Aktif", lastLogin: "10 menit lalu" },
    { name: "Bima Sales", email: "bima@storesync.id", role: "Sales", status: "Aktif", lastLogin: "1 jam lalu" },
    { name: "Citra Sales", email: "citra@storesync.id", role: "Sales", status: "Nonaktif", lastLogin: "7 hari lalu" },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#121a2d]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="flex bg-[#101827] px-6 py-9 text-white lg:min-h-screen lg:flex-col">
          <div className="flex w-full flex-col">
            <div>
              <h1 className="text-3xl font-bold tracking-normal">StoreSync</h1>
              <p className="mt-1 text-sm text-slate-300">Manajemen toko terpadu</p>
              <div className="mt-5 h-px bg-slate-300/70" />
            </div>

            <nav className="mt-8 space-y-2">
              {availableMenus.map((menu) => {
                const isActive = menu.key === currentMenu;

                return (
                  <button
                    key={menu.key}
                    type="button"
                    onClick={() => setActiveMenu(menu.key)}
                    className={[
                      "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition",
                      isActive ? "bg-[#2d5be3] text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <span className={["h-5 w-5 rounded-md", isActive ? "bg-white" : "bg-slate-700"].join(" ")} />
                    {menu.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 rounded-lg border border-slate-700 p-4 lg:mt-auto">
              <p className="text-sm text-slate-400">Mode akun</p>
              <p className="mt-2 text-xl font-bold">{roleLabel}</p>
              <p className="mt-1 text-sm text-slate-400">Akses sesuai role PRD</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-slate-600 px-3 text-sm font-bold text-slate-200 hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex min-h-20 flex-col gap-3 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-9">
            <h2 className="text-2xl font-bold tracking-normal">{pageTitle}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-500">
                {statusLabel} · {serviceName}
              </span>
              <span className="rounded-full bg-emerald-100 px-5 py-2 text-emerald-700">Toko Utama aktif</span>
              <span className="rounded-full bg-blue-100 px-5 py-2 text-blue-700">{roleLabel}</span>
              <button
                type="button"
                onClick={handleMarkAllNotificationsRead}
                className="rounded-md px-3 py-2 text-slate-500 hover:bg-slate-50"
              >
                Notifikasi
              </button>
            </div>
          </header>

          <div className="space-y-8 p-6 lg:p-9">
            {currentMenu === "dashboard" ? (
              <>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <DashboardCard dot="bg-emerald-600" label={user.role === "SALES" ? "Penjualan Saya Hari Ini" : "Pendapatan Hari Ini"} value={formatCurrency(user.role === "SALES" ? dashboardSummary?.mySalesTodayTotal ?? 0 : salesTotal)} helper={user.role === "SALES" ? `${dashboardSummary?.mySalesTodayCount ?? 0} transaksi` : "Naik dari data aktif"} helperTone="text-emerald-700" />
                  <DashboardCard dot="bg-blue-600" label="Laba Kotor Bulan Ini" value={formatCurrency(grossProfit)} helper="Margin operasional" helperTone="text-blue-700" />
                  <DashboardCard dot="bg-teal-700" label="Kas Toko" value={formatCurrency(cashBalance)} helper={`${deposits.length} deposit tercatat`} helperTone="text-teal-700" />
                  <DashboardCard dot="bg-amber-600" label={user.role === "SALES" ? "Stok Perlu Dicek" : "SPP Menunggu"} value={`${user.role === "SALES" ? lowStockProducts.length : waitingRequests.length}`} helper={user.role === "SALES" ? "Prioritas penjualan" : "Butuh keputusan"} helperTone="text-amber-700" />
                </div>

                <div className="grid gap-8 xl:grid-cols-[1.25fr_0.875fr]">
                  <Panel title={user.role === "SALES" ? "Performa penjualan" : "Tren penjualan 30 hari"}>
                    <div className="flex h-56 items-end gap-3 border-b border-slate-200 px-4 pb-0">
                      {chartBars.map((height, index) => (
                        <div
                          key={index}
                          className="w-full rounded-t-md bg-[#2f65e7]"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-500">7 hari terakhir</p>
                  </Panel>

                  <Panel title={user.role === "OWNER" ? "SPP menunggu approval" : "Aktivitas terbaru"}>
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
                  </Panel>
                </div>

                <div className="grid gap-8 xl:grid-cols-2">
                  <Panel title={user.role === "SALES" ? "Produk tersedia" : "Ringkasan keuangan"}>
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
                  </Panel>

                  <Panel title="Alert prioritas">
                    <DataTable
                      headers={["Area", "Masalah", "Dampak"]}
                      rows={[
                        ["Stok", `${lowStockProducts[0]?.name ?? "Produk"} perlu dicek`, "Penjualan"],
                        ["Kas", `Saldo ${formatCurrency(cashBalance)}`, "Keuangan"],
                        ["Notifikasi", `${notifications.filter((notification) => !notification.readAt).length} belum dibaca`, "Operasional"],
                      ]}
                    />
                  </Panel>
                </div>
              </>
            ) : null}

            {currentMenu === "approval" ? (
              <>
                <div className="grid gap-8 xl:grid-cols-[1.2fr_0.9fr]">
                  <Panel title="Daftar approval">
                    <DataTable
                      headers={["SPP", "Supplier", "Estimasi", "Status"]}
                      rows={purchaseRequests.map((request) => [
                        request.requestNo,
                        request.supplier ?? "Tanpa supplier",
                        formatCurrency(request.items.reduce((sum, item) => sum + Number(item.estimatedPrice), 0)),
                        <PurchaseStatusBadge key={request.id} status={request.status} />,
                      ])}
                    />
                  </Panel>

                  <Panel title={waitingRequests[0] ? `${waitingRequests[0].requestNo} · ${waitingRequests[0].supplier ?? "Pengajuan stok"}` : "Detail SPP"}>
                    {waitingRequests[0] ? (
                      <div>
                        <p className="mb-5 text-sm font-medium text-slate-500">
                          Diajukan {formatDateTime(waitingRequests[0].createdAt)}
                        </p>
                        <div className="space-y-3">
                          {waitingRequests[0].items.map((item) => (
                            <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                              <span className="font-bold">{item.product.name}</span>
                              <span className="text-slate-500">{item.quantity} {item.product.unit}</span>
                              <span className="font-bold text-blue-700">{formatCurrency(item.estimatedPrice)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-16 flex flex-wrap gap-4">
                          <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "reject")} className="h-11 rounded-lg bg-red-600 px-8 text-sm font-bold text-white">Tolak</button>
                          <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "approve")} className="h-11 rounded-lg bg-[#2f65e7] px-8 text-sm font-bold text-white">Setujui</button>
                          <button type="button" onClick={() => handleOwnerDecision(waitingRequests[0], "request-revision")} className="h-11 rounded-lg border border-slate-200 px-8 text-sm font-bold">Revisi</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Tidak ada SPP yang menunggu approval.</p>
                    )}
                  </Panel>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <DashboardCard dot="bg-emerald-600" label="Pemasukan" value={formatCurrency(financeSummary?.salesTotal ?? monthlySales)} helper="Penjualan bulan ini" helperTone="text-emerald-700" />
                  <DashboardCard dot="bg-amber-600" label="Pengeluaran" value={formatCurrency(financeSummary?.totalExpense ?? 0)} helper="Stok + operasional" helperTone="text-amber-700" />
                  <DashboardCard dot="bg-blue-600" label="Laba Kotor" value={formatCurrency(grossProfit)} helper="Margin berjalan" helperTone="text-blue-700" />
                  <DashboardCard dot="bg-teal-700" label="Saldo Kas" value={formatCurrency(cashBalance)} helper="Kas terkini" helperTone="text-teal-700" />
                </div>
              </>
            ) : null}

            {currentMenu === "users" ? (
              <>
                <div className="flex flex-wrap gap-4">
                  <button className="h-11 rounded-lg bg-[#2f65e7] px-5 text-sm font-bold text-white">Tambah Pengguna</button>
                  <button className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold">Role & Akses</button>
                </div>
                <Panel title="Daftar pengguna">
                  <DataTable
                    headers={["Nama", "Email", "Role", "Status", "Login terakhir"]}
                    rows={userRows.map((row) => [
                      row.name,
                      row.email,
                      row.role,
                      <span key={row.email} className={["inline-flex min-w-32 justify-center rounded-full px-4 py-1 text-sm font-bold", row.status === "Aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"].join(" ")}>{row.status}</span>,
                      row.lastLogin,
                    ])}
                  />
                </Panel>
                <Panel title="Ringkasan akses per role">
                  <div className="space-y-6 text-base">
                    <RoleAccessBadge label="Pemilik" tone="bg-violet-100 text-violet-700" text="Semua fitur, approval SPP, laporan lengkap, manajemen pengguna" />
                    <RoleAccessBadge label="Supervisor" tone="bg-blue-100 text-blue-700" text="Monitor penjualan, stok, SPP, deposit, laporan dasar" />
                    <RoleAccessBadge label="Sales" tone="bg-emerald-100 text-emerald-700" text="Input penjualan, lihat stok, target, riwayat sendiri" />
                  </div>
                </Panel>
              </>
            ) : null}

            {currentMenu === "finance" || currentMenu === "deposit" ? (
              <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
                <Panel title={currentMenu === "deposit" ? "Catat deposit" : "Input keuangan"}>
                  {financeMessage ? <p className="mb-3 text-sm font-bold text-emerald-700">{financeMessage}</p> : null}
                  <div className="grid gap-5">
                    <form onSubmit={handleCreateDeposit} className="grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-slate-700">Jumlah deposit</span>
                        <input value={depositForm.amount} onChange={(event) => setDepositForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Contoh: 500000" type="number" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-slate-700">Tujuan kas</span>
                        <input value={depositForm.destination} onChange={(event) => setDepositForm((current) => ({ ...current, destination: event.target.value }))} placeholder="Kas toko / bank tujuan" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-slate-700">Catatan deposit</span>
                        <input value={depositForm.note} onChange={(event) => setDepositForm((current) => ({ ...current, note: event.target.value }))} placeholder="Opsional" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                      </label>
                      <button className="h-11 rounded-lg bg-[#2f65e7] text-sm font-bold text-white">Simpan deposit</button>
                    </form>
                    {currentMenu === "finance" ? (
                      <form onSubmit={handleCreateExpense} className="grid gap-3 border-t border-slate-100 pt-5">
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">Nama biaya</span>
                          <input value={expenseForm.title} onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: listrik toko" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">Jumlah biaya</span>
                          <input value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Contoh: 250000" type="number" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                        </label>
                        <button className="h-11 rounded-lg bg-slate-900 text-sm font-bold text-white">Simpan biaya</button>
                      </form>
                    ) : null}
                  </div>
                </Panel>
                <Panel title="Breakdown laporan">
                  <DataTable
                    headers={["Kategori", "Pemasukan", "Pengeluaran", "Laba"]}
                    rows={[
                      ["Penjualan", formatCurrency(financeSummary?.salesTotal ?? 0), "-", formatCurrency(financeSummary?.grossProfit ?? 0)],
                      ["Pembelian stok", "-", formatCurrency(financeSummary?.purchaseExpenseTotal ?? 0), "-"],
                      ["Operasional", "-", formatCurrency(financeSummary?.operationalExpenseTotal ?? 0), "-"],
                      ["Deposit", formatCurrency(financeSummary?.depositTotal ?? 0), "-", formatCurrency(cashBalance)],
                    ]}
                  />
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <p className="mb-3 text-sm font-bold text-slate-800">Biaya terbaru</p>
                    <div className="space-y-2">
                      {expenses.slice(0, 4).map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-bold text-slate-800">{expense.title}</span>
                          <span className="text-slate-500">{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
            ) : null}

            {currentMenu === "sales" ? (
              <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
                <Panel title="Catat transaksi">
                  {salesMessage ? <p className="mb-3 text-sm font-bold text-emerald-700">{salesMessage}</p> : null}
                  <form onSubmit={handleCreateSale} className="grid gap-3">
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Produk yang dijual</span>
                      <select value={salesForm.productId} onChange={(event) => setSalesForm((current) => ({ ...current, productId: event.target.value }))} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500">
                        <option value="">Pilih produk</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id} disabled={product.stockQuantity <= 0}>{product.name} · stok {product.stockQuantity}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Jumlah terjual</span>
                      <input value={salesForm.quantity} onChange={(event) => setSalesForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Masukkan jumlah item" type="number" min={1} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Nama pelanggan</span>
                      <input value={salesForm.customerName} onChange={(event) => setSalesForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Opsional" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    </label>
                    <button className="h-11 rounded-lg bg-[#2f65e7] text-sm font-bold text-white">Simpan transaksi</button>
                  </form>
                </Panel>
                <Panel title="Transaksi terbaru">
                  <DataTable headers={["No", "Sales", "Total", "Waktu"]} rows={latestTransactions.map((transaction) => [transaction.transactionNo, transaction.sales.name, formatCurrency(transaction.total), formatDateTime(transaction.transactionAt)])} />
                </Panel>
              </div>
            ) : null}

            {currentMenu === "stock" ? (
              <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                <Panel title="Daftar stok produk">
                  {productMessage ? <p className="mb-3 text-sm font-bold text-emerald-700">{productMessage}</p> : null}
                  <DataTable
                    headers={["Produk", "Kategori", "Stok", "Minimum", "Status"]}
                    rows={products.map((product) => [
                      product.name,
                      product.category?.name ?? "Tanpa kategori",
                      `${product.stockQuantity} ${product.unit}`,
                      `${product.minimumStock}`,
                      <span key={product.id} className="inline-flex items-center gap-3">
                        <StockBadge status={product.stockStatus} />
                        {canManageStock ? (
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(product)}
                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700"
                          >
                            Adjust
                          </button>
                        ) : null}
                      </span>,
                    ])}
                  />
                </Panel>

                {canManageStock ? (
                  <Panel title="Kelola produk">
                    <div className="grid gap-5">
                      <form onSubmit={handleCreateCategory} className="grid gap-3">
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">Nama kategori produk</span>
                          <input
                            value={categoryName}
                            onChange={(event) => setCategoryName(event.target.value)}
                            placeholder="Contoh: Minuman"
                            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                        <button className="h-11 rounded-lg bg-slate-900 text-sm font-bold text-white">
                          Simpan kategori
                        </button>
                      </form>

                      <form onSubmit={handleCreateProduct} className="grid gap-3 border-t border-slate-100 pt-5">
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">Nama produk</span>
                          <input
                            value={productForm.name}
                            onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Contoh: Cup 16oz"
                            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">SKU produk</span>
                          <input
                            value={productForm.sku}
                            onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                            placeholder="Kode unik produk"
                            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-bold text-slate-700">Kategori produk</span>
                          <select
                            value={productForm.categoryId}
                            onChange={(event) =>
                              setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                            }
                            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                          >
                            <option value="">Tanpa kategori</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-2">
                            <span className="text-sm font-bold text-slate-700">Harga jual</span>
                            <input
                              value={productForm.sellingPrice}
                              onChange={(event) =>
                                setProductForm((current) => ({ ...current, sellingPrice: event.target.value }))
                              }
                              placeholder="Rp"
                              type="number"
                              className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-bold text-slate-700">Stok awal</span>
                            <input
                              value={productForm.stockQuantity}
                              onChange={(event) =>
                                setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))
                              }
                              placeholder="Jumlah stok"
                              type="number"
                              className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                            />
                          </label>
                        </div>
                        <button className="h-11 rounded-lg bg-[#2f65e7] text-sm font-bold text-white">
                          Tambah produk
                        </button>
                      </form>
                    </div>
                  </Panel>
                ) : null}
              </div>
            ) : null}

            {currentMenu === "purchase" ? (
              <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
                <Panel title="Buat SPP">
                  {purchaseMessage ? <p className="mb-3 text-sm font-bold text-emerald-700">{purchaseMessage}</p> : null}
                  <form onSubmit={handleCreatePurchaseRequest} className="grid gap-3">
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Produk yang diminta</span>
                      <select value={purchaseForm.productId} onChange={(event) => setPurchaseForm((current) => ({ ...current, productId: event.target.value }))} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500">
                        <option value="">Pilih produk</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name} · stok {product.stockQuantity}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Jumlah pembelian</span>
                      <input value={purchaseForm.quantity} onChange={(event) => setPurchaseForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Masukkan jumlah item" type="number" min={1} className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Estimasi harga</span>
                      <input value={purchaseForm.estimatedPrice} onChange={(event) => setPurchaseForm((current) => ({ ...current, estimatedPrice: event.target.value }))} placeholder="Total estimasi biaya" type="number" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-700">Supplier</span>
                      <input value={purchaseForm.supplier} onChange={(event) => setPurchaseForm((current) => ({ ...current, supplier: event.target.value }))} placeholder="Nama supplier" className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
                    </label>
                    <button className="h-11 rounded-lg bg-[#2f65e7] text-sm font-bold text-white">Kirim SPP</button>
                  </form>
                </Panel>
                <Panel title="Daftar SPP">
                  <DataTable headers={["SPP", "Supplier", "Estimasi", "Status"]} rows={purchaseRequests.map((request) => [request.requestNo, request.supplier ?? "Tanpa supplier", formatCurrency(request.items.reduce((sum, item) => sum + Number(item.estimatedPrice), 0)), <PurchaseStatusBadge key={request.id} status={request.status} />])} />
                  <div className="mt-5 flex flex-wrap gap-3">
                    {purchaseRequests
                      .filter((request) => request.status === "APPROVED")
                      .map((request) => (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => handleRealizePurchaseRequest(request)}
                          className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white"
                        >
                          Realisasi {request.requestNo}
                        </button>
                      ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {currentMenu === "history" ? (
              <Panel title="Riwayat penjualan saya">
                <DataTable headers={["No", "Produk", "Total", "Waktu"]} rows={transactions.map((transaction) => [transaction.transactionNo, transaction.items.map((item) => item.product.name).join(", "), formatCurrency(transaction.total), formatDateTime(transaction.transactionAt)])} />
              </Panel>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );

  /*
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">StoreSync</p>
            <h1 className="text-2xl font-semibold tracking-normal">Auth & RBAC foundation</h1>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                apiState === "online" ? "bg-emerald-500" : apiState === "offline" ? "bg-rose-500" : "bg-amber-500",
              ].join(" ")}
            />
            <span className="font-medium">{statusLabel}</span>
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[1fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
                <BadgeCheck className="h-4 w-4" />
                Phase 1 active
              </div>
              <h2 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
                Role-based access is now wired from API to dashboard.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Login with seeded accounts to preview how Pemilik, Supervisor, and Sales land on different operational
                dashboards.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-semibold">JWT Auth</p>
                <p className="mt-1 text-sm text-slate-600">Access and refresh token flow</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <UserRoundCog className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-semibold">RBAC</p>
                <p className="mt-1 text-sm text-slate-600">Owner, supervisor, sales</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <Boxes className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-semibold">Prisma</p>
                <p className="mt-1 text-sm text-slate-600">Seeded users and tokens</p>
              </div>
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            {user && dashboard ? (
              <div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-slate-900 p-2 text-white">
                      <ChartNoAxesCombined className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{dashboard.title}</p>
                      <p className="text-sm text-slate-500">{user.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">{dashboard.description}</p>

                <div className="mt-5 space-y-3">
                  {dashboard.items.map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <span className="text-sm font-medium">{item}</span>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        planned
                      </span>
                    </div>
                  ))}
                </div>

                {dashboardSummary ? (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Ringkasan dashboard</p>
                        <p className="text-sm text-slate-500">Disesuaikan dengan role {dashboardSummary.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadDashboard().catch(() => undefined)}
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {user.role === "SALES" ? (
                        <>
                          <Metric label="Penjualan saya hari ini" value={formatCurrency(dashboardSummary.mySalesTodayTotal)} />
                          <Metric label="Transaksi saya" value={`${dashboardSummary.mySalesTodayCount}`} />
                        </>
                      ) : (
                        <>
                          <Metric label="Penjualan hari ini" value={formatCurrency(dashboardSummary.todaySalesTotal)} />
                          <Metric label="Penjualan bulan ini" value={formatCurrency(dashboardSummary.monthlySalesTotal)} />
                          <Metric label="SPP menunggu" value={`${dashboardSummary.waitingPurchaseRequests}`} />
                          <Metric label="Stok rendah/habis" value={`${dashboardSummary.lowStockCount}/${dashboardSummary.outStockCount}`} />
                        </>
                      )}
                    </div>

                    <div className="mt-4 rounded-md border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Notifikasi</p>
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50"
                        >
                          Tandai dibaca
                        </button>
                      </div>
                      <div className="max-h-48 space-y-2 overflow-auto">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-slate-500">Belum ada notifikasi.</p>
                        ) : (
                          notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={[
                                "rounded-md px-3 py-2",
                                notification.readAt ? "bg-slate-50" : "bg-amber-50",
                              ].join(" ")}
                            >
                              <p className="text-sm font-semibold">{notification.title}</p>
                              <p className="text-xs text-slate-600">{notification.message}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Produk & stok</p>
                      <p className="text-sm text-slate-500">{products.length} produk aktif</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadInventory().catch(() => setProductMessage("Gagal memuat ulang stok."))}
                      className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
                    >
                      Refresh
                    </button>
                  </div>

                  {productMessage ? <p className="mb-3 text-sm font-medium text-emerald-700">{productMessage}</p> : null}

                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {products.map((product) => (
                      <div key={product.id} className="rounded-md border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {product.sku} · {product.category?.name ?? "Tanpa kategori"}
                            </p>
                          </div>
                          <StockBadge status={product.stockStatus} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <Metric label="Stok" value={`${product.stockQuantity} ${product.unit}`} />
                          <Metric label="Minimum" value={`${product.minimumStock}`} />
                          <Metric label="Harga jual" value={formatCurrency(product.sellingPrice)} />
                        </div>
                        {canManageStock ? (
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(product)}
                            className="mt-3 h-9 w-full rounded-md border border-slate-200 text-sm font-medium hover:bg-slate-50"
                          >
                            Sesuaikan stok
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {canManageStock ? (
                    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5">
                      <form onSubmit={handleCreateCategory} className="grid gap-2">
                        <p className="text-sm font-semibold">Tambah kategori</p>
                        <div className="flex gap-2">
                          <input
                            value={categoryName}
                            onChange={(event) => setCategoryName(event.target.value)}
                            placeholder="Nama kategori"
                            className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <button className="h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white">
                            Simpan
                          </button>
                        </div>
                      </form>

                      <form onSubmit={handleCreateProduct} className="grid gap-2">
                        <p className="text-sm font-semibold">Tambah produk</p>
                        <input
                          value={productForm.name}
                          onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Nama produk"
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={productForm.sku}
                            onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                            placeholder="SKU"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <input
                            value={productForm.unit}
                            onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))}
                            placeholder="Satuan"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={productForm.purchasePrice}
                            onChange={(event) =>
                              setProductForm((current) => ({ ...current, purchasePrice: event.target.value }))
                            }
                            placeholder="Harga beli"
                            type="number"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <input
                            value={productForm.sellingPrice}
                            onChange={(event) =>
                              setProductForm((current) => ({ ...current, sellingPrice: event.target.value }))
                            }
                            placeholder="Harga jual"
                            type="number"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={productForm.stockQuantity}
                            onChange={(event) =>
                              setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))
                            }
                            placeholder="Stok awal"
                            type="number"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <input
                            value={productForm.minimumStock}
                            onChange={(event) =>
                              setProductForm((current) => ({ ...current, minimumStock: event.target.value }))
                            }
                            placeholder="Stok minimum"
                            type="number"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <select
                          value={productForm.categoryId}
                          onChange={(event) =>
                            setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                          }
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="">Tanpa kategori</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <button className="h-10 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                          Tambah produk
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Penjualan</p>
                      <p className="text-sm text-slate-500">{transactions.length} transaksi terbaru</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadSales().catch(() => setSalesMessage("Gagal memuat transaksi."))}
                      className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
                    >
                      Refresh
                    </button>
                  </div>

                  {salesMessage ? <p className="mb-3 text-sm font-medium text-emerald-700">{salesMessage}</p> : null}

                  <form onSubmit={handleCreateSale} className="grid gap-2 rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-semibold">Catat transaksi</p>
                    <select
                      value={salesForm.productId}
                      onChange={(event) => setSalesForm((current) => ({ ...current, productId: event.target.value }))}
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="">Pilih produk</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id} disabled={product.stockQuantity <= 0}>
                          {product.name} · stok {product.stockQuantity}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={salesForm.quantity}
                        onChange={(event) => setSalesForm((current) => ({ ...current, quantity: event.target.value }))}
                        placeholder="Jumlah"
                        type="number"
                        min={1}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                      />
                      <select
                        value={salesForm.paymentMethod}
                        onChange={(event) =>
                          setSalesForm((current) => ({
                            ...current,
                            paymentMethod: event.target.value as PaymentMethod,
                          }))
                        }
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="CASH">Tunai</option>
                        <option value="TRANSFER">Transfer</option>
                        <option value="QRIS">QRIS</option>
                        <option value="OTHER">Lainnya</option>
                      </select>
                    </div>
                    <input
                      value={salesForm.customerName}
                      onChange={(event) => setSalesForm((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder="Nama pelanggan (opsional)"
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                    />
                    <button className="h-10 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                      Simpan transaksi
                    </button>
                  </form>

                  <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="rounded-md border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{transaction.transactionNo}</p>
                            <p className="text-xs text-slate-500">
                              {transaction.sales.name} · {formatDateTime(transaction.transactionAt)}
                            </p>
                          </div>
                          <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            {formatCurrency(transaction.total)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {transaction.items.map((item) => (
                            <p key={item.id} className="text-xs text-slate-600">
                              {item.product.name} · {item.quantity} {item.product.unit} · {formatCurrency(item.total)}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {canUsePurchaseRequests ? (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">SPP pembelian stok</p>
                        <p className="text-sm text-slate-500">{purchaseRequests.length} pengajuan terbaru</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          loadPurchaseRequests().catch(() => setPurchaseMessage("Gagal memuat data SPP."))
                        }
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>

                    {purchaseMessage ? (
                      <p className="mb-3 text-sm font-medium text-emerald-700">{purchaseMessage}</p>
                    ) : null}

                    <form onSubmit={handleCreatePurchaseRequest} className="grid gap-2 rounded-md border border-slate-200 p-3">
                      <p className="text-sm font-semibold">Buat SPP</p>
                      <select
                        value={purchaseForm.productId}
                        onChange={(event) =>
                          setPurchaseForm((current) => ({ ...current, productId: event.target.value }))
                        }
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="">Pilih produk</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} · stok {product.stockQuantity}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={purchaseForm.quantity}
                          onChange={(event) =>
                            setPurchaseForm((current) => ({ ...current, quantity: event.target.value }))
                          }
                          placeholder="Jumlah"
                          type="number"
                          min={1}
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <input
                          value={purchaseForm.estimatedPrice}
                          onChange={(event) =>
                            setPurchaseForm((current) => ({ ...current, estimatedPrice: event.target.value }))
                          }
                          placeholder="Estimasi harga"
                          type="number"
                          min={0}
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                      <input
                        value={purchaseForm.supplier}
                        onChange={(event) =>
                          setPurchaseForm((current) => ({ ...current, supplier: event.target.value }))
                        }
                        placeholder="Supplier (opsional)"
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        value={purchaseForm.note}
                        onChange={(event) => setPurchaseForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Catatan SPP (opsional)"
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                      />
                      <button className="h-10 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                        Kirim SPP
                      </button>
                    </form>

                    <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                      {purchaseRequests.map((purchaseRequest) => (
                        <div key={purchaseRequest.id} className="rounded-md border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{purchaseRequest.requestNo}</p>
                              <p className="text-xs text-slate-500">
                                {purchaseRequest.supplier ?? "Tanpa supplier"} ·{" "}
                                {formatDateTime(purchaseRequest.createdAt)}
                              </p>
                            </div>
                            <PurchaseStatusBadge status={purchaseRequest.status} />
                          </div>
                          <div className="mt-2 space-y-1">
                            {purchaseRequest.items.map((item) => (
                              <p key={item.id} className="text-xs text-slate-600">
                                {item.product.name} · {item.quantity} {item.product.unit} · estimasi{" "}
                                {formatCurrency(item.estimatedPrice)}
                              </p>
                            ))}
                          </div>
                          {purchaseRequest.ownerNote ? (
                            <p className="mt-2 text-xs font-medium text-slate-600">Catatan: {purchaseRequest.ownerNote}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {user?.role === "OWNER" && purchaseRequest.status === "WAITING_APPROVAL" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOwnerDecision(purchaseRequest, "approve")}
                                  className="h-8 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOwnerDecision(purchaseRequest, "reject")}
                                  className="h-8 rounded-md bg-rose-700 px-3 text-xs font-semibold text-white"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOwnerDecision(purchaseRequest, "request-revision")}
                                  className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold"
                                >
                                  Revisi
                                </button>
                              </>
                            ) : null}
                            {purchaseRequest.status === "APPROVED" ? (
                              <button
                                type="button"
                                onClick={() => handleRealizePurchaseRequest(purchaseRequest)}
                                className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
                              >
                                Realisasi
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {canUseFinance ? (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Keuangan & deposit</p>
                        <p className="text-sm text-slate-500">Ringkasan pemasukan, pengeluaran, dan kas</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadFinance().catch(() => setFinanceMessage("Gagal memuat data keuangan."))}
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>

                    {financeMessage ? <p className="mb-3 text-sm font-medium text-emerald-700">{financeMessage}</p> : null}

                    {financeSummary ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Metric label="Penjualan" value={formatCurrency(financeSummary.salesTotal)} />
                        <Metric label="Laba kotor" value={formatCurrency(financeSummary.grossProfit)} />
                        <Metric label="Pengeluaran" value={formatCurrency(financeSummary.totalExpense)} />
                        <Metric label="Saldo kas" value={formatCurrency(financeSummary.cashBalance)} />
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4">
                      <form onSubmit={handleCreateDeposit} className="grid gap-2 rounded-md border border-slate-200 p-3">
                        <p className="text-sm font-semibold">Catat deposit</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={depositForm.amount}
                            onChange={(event) =>
                              setDepositForm((current) => ({ ...current, amount: event.target.value }))
                            }
                            placeholder="Jumlah"
                            type="number"
                            min={0}
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <input
                            value={depositForm.destination}
                            onChange={(event) =>
                              setDepositForm((current) => ({ ...current, destination: event.target.value }))
                            }
                            placeholder="Tujuan"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <input
                          value={depositForm.note}
                          onChange={(event) => setDepositForm((current) => ({ ...current, note: event.target.value }))}
                          placeholder="Catatan deposit (opsional)"
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <button className="h-10 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                          Simpan deposit
                        </button>
                      </form>

                      <form onSubmit={handleCreateExpense} className="grid gap-2 rounded-md border border-slate-200 p-3">
                        <p className="text-sm font-semibold">Catat biaya operasional</p>
                        <input
                          value={expenseForm.title}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Nama biaya"
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={expenseForm.amount}
                            onChange={(event) =>
                              setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                            }
                            placeholder="Jumlah"
                            type="number"
                            min={0}
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                          <input
                            value={expenseForm.category}
                            onChange={(event) =>
                              setExpenseForm((current) => ({ ...current, category: event.target.value }))
                            }
                            placeholder="Kategori"
                            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                        <input
                          value={expenseForm.note}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, note: event.target.value }))}
                          placeholder="Catatan biaya (opsional)"
                          className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                        />
                        <button className="h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white">
                          Simpan biaya
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-200 p-3">
                        <p className="mb-2 text-sm font-semibold">Deposit terbaru</p>
                        <div className="max-h-48 space-y-2 overflow-auto">
                          {deposits.map((deposit) => (
                            <div key={deposit.id} className="rounded-md bg-slate-50 px-3 py-2">
                              <p className="text-sm font-medium">{formatCurrency(deposit.amount)}</p>
                              <p className="text-xs text-slate-500">
                                {deposit.destination} · {formatDateTime(deposit.depositedAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 p-3">
                        <p className="mb-2 text-sm font-semibold">Biaya terbaru</p>
                        <div className="max-h-48 space-y-2 overflow-auto">
                          {expenses.map((expense) => (
                            <div key={expense.id} className="rounded-md bg-slate-50 px-3 py-2">
                              <p className="text-sm font-medium">{expense.title}</p>
                              <p className="text-xs text-slate-500">
                                {formatCurrency(expense.amount)} · {expense.category ?? "Tanpa kategori"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleLogin}>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="rounded-md bg-slate-900 p-2 text-white">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Login development</p>
                    <p className="text-sm text-slate-500">{serviceName}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Email</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      type="email"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Password</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      type="password"
                    />
                  </label>

                  {authMessage ? <p className="text-sm font-medium text-rose-600">{authMessage}</p> : null}

                  <button
                    type="submit"
                    disabled={isLoading || apiState === "offline"}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <WalletCards className="h-4 w-4" />
                    {isLoading ? "Signing in..." : "Sign in"}
                  </button>
                </div>

                <div className="mt-5 grid gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword("Password123!");
                      }}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span className="font-medium">{account.label}</span>
                      <span className="text-xs text-slate-500">{account.role}</span>
                    </button>
                  ))}
                </div>
              </form>
            )}
          </aside>
        </section>
      </div>
    </main>
  ); */
}

export default App;

function DashboardCard({
  dot,
  label,
  value,
  helper,
  helperTone,
}: {
  dot: string;
  label: string;
  value: string;
  helper: string;
  helperTone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={["h-2.5 w-2.5 rounded-full", dot].join(" ")} />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-normal text-[#121a2d]">{value}</p>
      <p className={["mt-2 text-sm font-medium", helperTone].join(" ")}>{helper}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5">
        <h3 className="text-lg font-bold tracking-normal text-[#121a2d]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-slate-100 px-0 py-3 pr-6 text-xs font-bold text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-8 text-sm font-medium text-slate-500">
                Belum ada data.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={[
                      "border-b border-slate-100 py-3 pr-6 text-slate-500",
                      cellIndex === 0 ? "font-bold text-slate-800" : "",
                    ].join(" ")}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RoleAccessBadge({ label, tone, text }: { label: string; tone: string; text: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className={["inline-flex w-fit min-w-32 justify-center rounded-full px-4 py-1 text-sm font-bold", tone].join(" ")}>
        {label}
      </span>
      <p className="font-medium text-slate-800">{text}</p>
    </div>
  );
}

function StockBadge({ status }: { status: StockStatus }) {
  const labels: Record<StockStatus, string> = {
    SAFE: "Aman",
    LOW: "Rendah",
    OUT: "Habis",
  };
  const classes: Record<StockStatus, string> = {
    SAFE: "bg-emerald-100 text-emerald-800",
    LOW: "bg-amber-100 text-amber-800",
    OUT: "bg-rose-100 text-rose-800",
  };

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>;
}

function PurchaseStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const labels: Record<PurchaseRequestStatus, string> = {
    DRAFT: "Draft",
    WAITING_APPROVAL: "Menunggu",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    REVISION_REQUESTED: "Revisi",
    COMPLETED: "Selesai",
  };
  const classes: Record<PurchaseRequestStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    WAITING_APPROVAL: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-rose-100 text-rose-800",
    REVISION_REQUESTED: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-slate-900 text-white",
  };

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>;
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
