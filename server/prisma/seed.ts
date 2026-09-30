import "dotenv/config";
import { PharmacyStatus, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { normalizePhone } from "../src/utils/phone";
import { addBusinessDays, businessDate, mondayOf, startOfBusinessDay, weekDates } from "../src/utils/time";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

// Akun demo untuk development dan staging. Tidak dibuat saat NODE_ENV=production.
const demoUsers = [
  { name: "Super Admin Demo", phone: "081200000001", role: UserRole.SUPER_ADMIN, mustChangePassword: false },
  { name: "Admin Gudang Demo", phone: "081200000002", role: UserRole.ADMIN, mustChangePassword: false },
  { name: "Team Leader Demo", phone: "081200000003", role: UserRole.TEAM_LEADER, mustChangePassword: false },
  { name: "SPG Demo", phone: "081200000004", role: UserRole.SPG, mustChangePassword: false },
  // Akun kasir dibuat bersama apoteknya di seedDemoMasterData (AKN-03).
  // Untuk mencoba alur wajib ganti kata sandi saat login pertama.
  { name: "SPG Baru Demo", phone: "081200000006", role: UserRole.SPG, mustChangePassword: true },
];

const upsertUser = async (user: {
  name: string;
  phone: string;
  role: UserRole;
  password: string;
  mustChangePassword: boolean;
}) => {
  const phone = normalizePhone(user.phone);

  if (!phone) {
    throw new Error(`Nomor HP seed tidak valid: ${user.phone}`);
  }

  const data = {
    name: user.name,
    role: user.role,
    status: UserStatus.ACTIVE,
    passwordHash: await hashPassword(user.password),
    mustChangePassword: user.mustChangePassword,
  };

  const saved = await prisma.user.upsert({
    where: { phone },
    update: data,
    create: { ...data, phone },
  });

  console.log(`  ${user.role.padEnd(12)} ${phone}  ${user.name}`);
  return saved;
};

const demoPharmacies = [
  {
    name: "Apotek Demo Sehat",
    address: "Jl. Pemuda No. 12, Rawamangun, Jakarta Timur",
    latitude: -6.1942,
    longitude: 106.8906,
    kasirPhone: "081200000005",
    openTime: "08:00",
    closeTime: "22:00",
  },
  {
    name: "Apotek Demo Keluarga",
    address: "Jl. Kramat Raya No. 45, Senen, Jakarta Pusat",
    latitude: -6.1873,
    longitude: 106.8456,
    kasirPhone: "081200000011",
    openTime: "07:00",
    closeTime: "21:00",
  },
  {
    name: "Apotek Demo Harapan 24 Jam",
    address: "Jl. Fatmawati No. 8, Cilandak, Jakarta Selatan",
    latitude: -6.2922,
    longitude: 106.7967,
    kasirPhone: "081200000012",
    is24h: true,
  },
];

const demoProducts = [
  { code: "DEMO-MDU-250", name: "Madu Herbal 250 ml", unit: "botol", price: 65000 },
  { code: "DEMO-KYP-60", name: "Minyak Kayu Putih 60 ml", unit: "botol", price: 28000 },
  { code: "DEMO-VTC-10", name: "Vitamin C 500 mg isi 10", unit: "strip", price: 18000 },
  { code: "DEMO-TLH-20", name: "Teh Herbal Pelangsing isi 20", unit: "kotak", price: 45000 },
  { code: "DEMO-MSK-50", name: "Masker Medis isi 50", unit: "kotak", price: 38000 },
];

/** Data utama demo (Tahap 2): apotek + kasir, tim, penempatan, produk, dan target bulan ini. */
async function seedDemoMasterData(users: Map<string, { id: string }>) {
  console.log("Seeding data utama demo:");

  const pharmacies = [];
  for (const { kasirPhone, ...pharmacy } of demoPharmacies) {
    const kasir = await upsertUser({
      name: `Kasir ${pharmacy.name}`,
      phone: kasirPhone,
      role: UserRole.KASIR,
      password: DEMO_PASSWORD,
      mustChangePassword: false,
    });
    const fields = {
      ...pharmacy,
      is24h: pharmacy.is24h ?? false,
      openTime: pharmacy.openTime ?? null,
      closeTime: pharmacy.closeTime ?? null,
      status: PharmacyStatus.ACTIVE,
    };
    pharmacies.push(
      await prisma.pharmacy.upsert({
        where: { kasirUserId: kasir.id },
        update: fields,
        create: { ...fields, kasirUserId: kasir.id },
      }),
    );
  }

  const leader = users.get("081200000003")!;
  const spg = users.get("081200000004")!;
  const newSpg = users.get("081200000006")!;
  const team = await prisma.team.upsert({
    where: { leaderId: leader.id },
    update: { name: "Tim Demo Jakarta" },
    create: { name: "Tim Demo Jakarta", leaderId: leader.id },
  });
  await prisma.user.updateMany({ where: { id: { in: [spg.id, newSpg.id] } }, data: { teamId: team.id } });
  console.log(`  Tim         ${team.name}`);

  for (const pharmacy of pharmacies.slice(0, 2)) {
    const active = await prisma.placement.findFirst({ where: { spgId: spg.id, pharmacyId: pharmacy.id, endedAt: null } });
    if (!active) {
      await prisma.placement.create({ data: { spgId: spg.id, pharmacyId: pharmacy.id } });
    }
    console.log(`  Penempatan  SPG Demo → ${pharmacy.name}`);
  }

  for (const product of demoProducts) {
    await prisma.product.upsert({ where: { code: product.code }, update: product, create: product });
  }
  console.log(`  Produk      ${demoProducts.length} produk demo`);

  const month = businessDate().slice(0, 7);
  for (const [spgId, amount] of [
    [spg.id, 15_000_000],
    [newSpg.id, 10_000_000],
  ] as const) {
    await prisma.salesTarget.upsert({
      where: { spgId_month: { spgId, month } },
      update: { amount },
      create: { spgId, month, amount },
    });
  }
  console.log(`  Target      ${month}`);

  // Jadwal minggu ini dan minggu depan: Sehat di Sen/Rab/Jum, Keluarga di Sel/Kam/Sab, Minggu libur.
  const [sehat, keluarga] = pharmacies;
  const thisWeek = mondayOf(businessDate());
  for (const weekStart of [thisWeek, addBusinessDays(thisWeek, 7)]) {
    const dates = weekDates(weekStart);
    const plan = [
      { date: dates[0], pharmacyId: sehat.id, startTime: "08:00", endTime: "16:00" },
      { date: dates[1], pharmacyId: keluarga.id, startTime: "09:00", endTime: "17:00" },
      { date: dates[2], pharmacyId: sehat.id, startTime: "08:00", endTime: "16:00" },
      { date: dates[3], pharmacyId: keluarga.id, startTime: "09:00", endTime: "17:00" },
      { date: dates[4], pharmacyId: sehat.id, startTime: "08:00", endTime: "16:00" },
      { date: dates[5], pharmacyId: keluarga.id, startTime: "09:00", endTime: "15:00" },
    ];
    for (const entry of plan) {
      const value = { startTime: entry.startTime, endTime: entry.endTime, isOff: false };
      await prisma.schedule.upsert({
        where: { spgId_pharmacyId_date: { spgId: spg.id, pharmacyId: entry.pharmacyId, date: entry.date } },
        update: value,
        create: { spgId: spg.id, pharmacyId: entry.pharmacyId, date: entry.date, ...value },
      });
    }
    await prisma.schedule.upsert({
      where: { spgId_pharmacyId_date: { spgId: spg.id, pharmacyId: sehat.id, date: dates[6] } },
      update: { isOff: true, startTime: null, endTime: null },
      create: { spgId: spg.id, pharmacyId: sehat.id, date: dates[6], isOff: true },
    });
  }
  console.log(`  Jadwal      SPG Demo, minggu ${thisWeek} dan berikutnya`);

  await seedDemoVisitPlans(leader.id, pharmacies);
  await seedDemoStock(users.get("081200000002")!.id, spg.id, pharmacies);
}

/**
 * Stok demo (Tahap 5): stok pusat (Vitamin C sengaja kosong untuk mencoba "permintaan belum
 * terpenuhi"), stok awal SPG Demo di kedua apotek tugasnya, dan satu order menunggu persetujuan.
 * Hanya dibuat bila belum ada, lewat mutasi ber-saldo supaya ledger tetap konsisten.
 */
async function seedDemoStock(adminId: string, spgId: string, pharmacies: Array<{ id: string }>) {
  const [sehat, keluarga] = pharmacies;
  const products = new Map(
    (await prisma.product.findMany({ where: { code: { startsWith: "DEMO-" } }, select: { id: true, code: true } })).map((product) => [
      product.code,
      product.id,
    ]),
  );
  const date = businessDate();

  const warehouse: Array<[string, number]> = [
    ["DEMO-MDU-250", 120],
    ["DEMO-KYP-60", 80],
    ["DEMO-VTC-10", 0],
    ["DEMO-TLH-20", 40],
    ["DEMO-MSK-50", 25],
  ];
  for (const [code, qty] of warehouse) {
    const productId = products.get(code)!;
    if (await prisma.warehouseStock.findUnique({ where: { productId } })) continue;
    await prisma.warehouseStock.create({ data: { productId, qty } });
    if (qty > 0) {
      await prisma.warehouseMovement.create({
        data: { productId, type: "INBOUND", qty, balanceAfter: qty, date, poNumber: "PO-DEMO-001", note: "Stok demo", createdById: adminId },
      });
    }
  }
  console.log("  Stok pusat  5 produk demo (Vitamin C kosong)");

  const opening: Array<[string, string, number]> = [
    [sehat.id, "DEMO-MDU-250", 12],
    [sehat.id, "DEMO-KYP-60", 8],
    [sehat.id, "DEMO-TLH-20", 5],
    [keluarga.id, "DEMO-MDU-250", 6],
    [keluarga.id, "DEMO-MSK-50", 4],
  ];
  for (const [pharmacyId, code, qty] of opening) {
    const productId = products.get(code)!;
    const key = { holderId_pharmacyId_productId: { holderId: spgId, pharmacyId, productId } };
    if (await prisma.fieldStock.findUnique({ where: key })) continue;
    await prisma.fieldStock.create({ data: { holderId: spgId, pharmacyId, productId, qty } });
    await prisma.fieldStockMovement.create({
      data: { holderId: spgId, pharmacyId, productId, type: "OPENING", qty, balanceAfter: qty, note: "Stok awal", createdById: adminId },
    });
  }
  console.log("  Stok awal   SPG Demo di Apotek Demo Sehat dan Apotek Demo Keluarga");

  if ((await prisma.order.count({ where: { spgId } })) === 0) {
    const stockOf = async (code: string) => (await prisma.warehouseStock.findUnique({ where: { productId: products.get(code)! } }))?.qty ?? 0;
    const items = [
      { code: "DEMO-MDU-250", qty: 10 },
      { code: "DEMO-VTC-10", qty: 6 },
    ];
    await prisma.order.create({
      data: {
        spgId,
        pharmacyId: sehat.id,
        note: "Stok madu menipis",
        items: {
          create: await Promise.all(
            items.map(async (item) => {
              const stock = await stockOf(item.code);
              return { productId: products.get(item.code)!, requestedQty: item.qty, stockAtSubmit: stock, unfulfilledAtSubmit: stock < item.qty };
            }),
          ),
        },
      },
    });
    console.log("  Order       1 order SPG Demo menunggu persetujuan");
  }
}

/**
 * Rencana kunjungan Team Leader demo (Tahap 4): minggu lalu (untuk dicoba di Evaluasi, apotek
 * yang tidak dikunjungi wajib diberi alasan), minggu ini, dan minggu depan. Hanya menambah apotek
 * yang belum ada, jadi perubahan saat UAT tidak ditimpa.
 */
async function seedDemoVisitPlans(leaderId: string, pharmacies: Array<{ id: string }>) {
  const [sehat, keluarga, harapan] = pharmacies;
  // Senin–Sabtu; Minggu tanpa kunjungan.
  const pattern = [[sehat, keluarga], [harapan], [sehat, keluarga], [keluarga, harapan], [sehat], [keluarga]];
  const thisWeek = mondayOf(businessDate());

  for (const weekStart of [addBusinessDays(thisWeek, -7), thisWeek, addBusinessDays(thisWeek, 7)]) {
    const plan = await prisma.visitPlan.upsert({
      where: { leaderId_weekStart: { leaderId, weekStart } },
      update: {},
      create: { leaderId, weekStart, lockedAt: startOfBusinessDay(weekStart) },
    });
    const dates = weekDates(weekStart);
    for (const [index, dayPharmacies] of pattern.entries()) {
      for (const pharmacy of dayPharmacies) {
        const exists = await prisma.visitPlanItem.findFirst({ where: { planId: plan.id, date: dates[index], pharmacyId: pharmacy.id } });
        if (!exists) {
          await prisma.visitPlanItem.create({ data: { planId: plan.id, date: dates[index], pharmacyId: pharmacy.id } });
        }
      }
    }
  }
  console.log(`  Rencana     Team Leader Demo, minggu ${addBusinessDays(thisWeek, -7)} s/d ${addBusinessDays(thisWeek, 7)}`);
}

async function main() {
  console.log("Seeding akun:");

  // Super Admin pertama untuk environment baru (staging/produksi), diisi lewat env.
  const { SEED_SUPER_ADMIN_NAME, SEED_SUPER_ADMIN_PHONE, SEED_SUPER_ADMIN_PASSWORD } = process.env;

  if (SEED_SUPER_ADMIN_PHONE && SEED_SUPER_ADMIN_PASSWORD) {
    await upsertUser({
      name: SEED_SUPER_ADMIN_NAME ?? "Super Admin",
      phone: SEED_SUPER_ADMIN_PHONE,
      role: UserRole.SUPER_ADMIN,
      password: SEED_SUPER_ADMIN_PASSWORD,
      mustChangePassword: true,
    });
  }

  if (process.env.NODE_ENV === "production") {
    console.log("NODE_ENV=production: akun demo dilewati.");
    return;
  }

  const users = new Map<string, { id: string }>();
  for (const user of demoUsers) {
    users.set(user.phone, await upsertUser({ ...user, password: DEMO_PASSWORD }));
  }

  await seedDemoMasterData(users);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
