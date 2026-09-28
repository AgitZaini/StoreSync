import "dotenv/config";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { normalizePhone } from "../src/utils/phone";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

// Akun demo untuk development dan staging. Tidak dibuat saat NODE_ENV=production.
const demoUsers = [
  { name: "Super Admin Demo", phone: "081200000001", role: UserRole.SUPER_ADMIN, mustChangePassword: false },
  { name: "Admin Gudang Demo", phone: "081200000002", role: UserRole.ADMIN, mustChangePassword: false },
  { name: "Team Leader Demo", phone: "081200000003", role: UserRole.TEAM_LEADER, mustChangePassword: false },
  { name: "SPG Demo", phone: "081200000004", role: UserRole.SPG, mustChangePassword: false },
  { name: "Kasir Apotek Demo", phone: "081200000005", role: UserRole.KASIR, mustChangePassword: false },
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

  await prisma.user.upsert({
    where: { phone },
    update: data,
    create: { ...data, phone },
  });

  console.log(`  ${user.role.padEnd(12)} ${phone}  ${user.name}`);
};

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

  for (const user of demoUsers) {
    await upsertUser({ ...user, password: DEMO_PASSWORD });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
