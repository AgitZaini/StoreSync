import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

const users = [
  {
    name: "Pemilik StoreSync",
    email: "owner@storesync.local",
    password: "Password123!",
    role: UserRole.OWNER,
  },
  {
    name: "Supervisor StoreSync",
    email: "supervisor@storesync.local",
    password: "Password123!",
    role: UserRole.SUPERVISOR,
  },
  {
    name: "Sales StoreSync",
    email: "sales@storesync.local",
    password: "Password123!",
    role: UserRole.SALES,
  },
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword(user.password),
        role: user.role,
      },
    });
  }

  const stapleCategory = await prisma.productCategory.upsert({
    where: { name: "Sembako" },
    update: {},
    create: { name: "Sembako" },
  });

  const beverageCategory = await prisma.productCategory.upsert({
    where: { name: "Minuman" },
    update: {},
    create: { name: "Minuman" },
  });

  await prisma.product.upsert({
    where: { sku: "BRAS-5KG" },
    update: {},
    create: {
      name: "Beras Premium 5kg",
      sku: "BRAS-5KG",
      unit: "karung",
      purchasePrice: 62000,
      sellingPrice: 69000,
      stockQuantity: 18,
      minimumStock: 10,
      categoryId: stapleCategory.id,
    },
  });

  await prisma.product.upsert({
    where: { sku: "AMDK-600ML" },
    update: {},
    create: {
      name: "Air Mineral 600ml",
      sku: "AMDK-600ML",
      unit: "botol",
      purchasePrice: 2500,
      sellingPrice: 3500,
      stockQuantity: 7,
      minimumStock: 12,
      categoryId: beverageCategory.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
