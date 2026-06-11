import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  BadgeCheck,
  Boxes,
  ChartNoAxesCombined,
  LogOut,
  ShieldCheck,
  UserRoundCog,
  WalletCards,
} from "lucide-react";
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

const demoAccounts = [
  { label: "Pemilik", email: "owner@storesync.local", role: "OWNER" },
  { label: "Supervisor", email: "supervisor@storesync.local", role: "SUPERVISOR" },
  { label: "Sales", email: "sales@storesync.local", role: "SALES" },
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

function App() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [serviceName, setServiceName] = useState("storesync-api");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("owner@storesync.local");
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
  );
}

export default App;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
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
