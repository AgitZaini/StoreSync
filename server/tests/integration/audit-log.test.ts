import { recordAudit } from "../../src/utils/audit";
import { prisma } from "../../src/utils/prisma";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Audit log (LOG-01)", () => {
  it("stores before/after values without secrets", async () => {
    const entry = await recordAudit(prisma, {
      actor: users.superAdmin,
      action: "user.update",
      entity: "User",
      entityId: users.spg.id,
      before: users.spg,
      after: { ...users.spg, name: "Nama Baru" },
      evidenceFileIds: ["file-1"],
    });

    expect(entry.actorRole).toBe("SUPER_ADMIN");
    expect(entry.before).not.toHaveProperty("passwordHash");
    expect(entry.after).toMatchObject({ name: "Nama Baru" });
    expect(entry.evidenceFileIds).toEqual(["file-1"]);
  });

  it("cannot be changed or deleted by anyone", async () => {
    const entry = await recordAudit(prisma, { actor: users.admin, action: "test.create", entity: "Test" });

    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: "test.tampered" } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany()).rejects.toThrow(/append-only/);

    expect(await prisma.auditLog.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({ action: "test.create" });
  });
});
