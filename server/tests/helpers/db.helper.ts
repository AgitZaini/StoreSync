import { UserRole, UserStatus } from "@prisma/client";
import { hashPassword } from "../../src/utils/password";
import { prisma } from "../../src/utils/prisma";

export const TEST_PASSWORD = "Password123!";

/** Mengosongkan semua tabel. TRUNCATE tidak memicu trigger append-only milik AuditLog. */
export const resetDatabase = async () => {
  const [{ current_database: database }] = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database()
  `;

  if (!database.includes("test")) {
    throw new Error(`Menolak mengosongkan database "${database}" karena bukan database test`);
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ")} CASCADE`,
    );
  }
};

export const seedUsers = async () => {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const createUser = (name: string, phone: string, role: UserRole, mustChangePassword = false) =>
    prisma.user.create({
      data: { name, phone, role, passwordHash, mustChangePassword, status: UserStatus.ACTIVE },
    });

  return {
    superAdmin: await createUser("Test Super Admin", "6281100000001", UserRole.SUPER_ADMIN),
    admin: await createUser("Test Admin", "6281100000002", UserRole.ADMIN),
    teamLeader: await createUser("Test Team Leader", "6281100000003", UserRole.TEAM_LEADER),
    spg: await createUser("Test SPG", "6281100000004", UserRole.SPG),
    kasir: await createUser("Test Kasir", "6281100000005", UserRole.KASIR),
    newcomer: await createUser("Test SPG Baru", "6281100000006", UserRole.SPG, true),
  };
};

export type SeededUsers = Awaited<ReturnType<typeof seedUsers>>;

export const closeDatabase = async () => {
  await prisma.$disconnect();
};
