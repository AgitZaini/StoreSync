import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, createTeam, createUserDirect, place, setTeam } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;
let superAdminToken: string;

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
});

afterAll(async () => {
  await closeDatabase();
});

describe("Placements (AKN-02, BR-04)", () => {
  it("allows at most 3 active pharmacies per SPG with a clear message", async () => {
    const pharmacies = [];
    for (let index = 0; index < 4; index += 1) {
      pharmacies.push(await createPharmacy(superAdminToken));
    }

    for (const pharmacy of pharmacies.slice(0, 3)) {
      await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    }

    const fourth = await place(superAdminToken, users.spg.id, pharmacies[3].id).expect(409);
    expect(fourth.body.message).toMatch(/3 apotek/);

    const duplicate = await place(superAdminToken, users.spg.id, pharmacies[0].id).expect(409);
    expect(duplicate.body.message).toMatch(/sudah ditempatkan/);
  });

  it("never lets concurrent requests exceed the limit", async () => {
    const pharmacies = await Promise.all([1, 2, 3, 4].map(() => createPharmacy(superAdminToken)));
    await place(superAdminToken, users.spg.id, pharmacies[0].id).expect(201);
    await place(superAdminToken, users.spg.id, pharmacies[1].id).expect(201);

    const results = await Promise.all([
      place(superAdminToken, users.spg.id, pharmacies[2].id),
      place(superAdminToken, users.spg.id, pharmacies[3].id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await prisma.placement.count({ where: { spgId: users.spg.id, endedAt: null } })).toBe(3);
  });

  it("ends placements with a reason, keeps history, and notifies the SPG", async () => {
    const pharmacy = await createPharmacy(superAdminToken, { name: "Apotek Kenanga" });
    const created = await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    const placementId = created.body.placement.id;
    const end = (body: object) =>
      request(app).post(`/api/placements/${placementId}/end`).set(authHeader(superAdminToken)).send(body);

    await end({}).expect(400);
    const ended = await end({ reason: "Dipindah ke apotek lain" }).expect(200);
    expect(ended.body.placement.endedAt).toBeTruthy();
    await end({ reason: "Lagi" }).expect(409);

    // Penempatan lama tetap tersimpan; SPG bisa ditempatkan lagi di apotek yang sama.
    await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    expect(await prisma.placement.count({ where: { spgId: users.spg.id } })).toBe(2);

    const notifications = await prisma.notification.findMany({ where: { userId: users.spg.id } });
    expect(notifications.map((notification) => notification.title)).toEqual(
      expect.arrayContaining(["Penempatan baru", "Penempatan berakhir"]),
    );

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "placement.end" } });
    expect(audit.after).toMatchObject({ pharmacyName: "Apotek Kenanga", endReason: "Dipindah ke apotek lain" });
  });

  it("rejects non-SPG accounts, inactive pharmacies, and other roles", async () => {
    const pharmacy = await createPharmacy(superAdminToken);

    await place(superAdminToken, users.teamLeader.id, pharmacy.id).expect(400);

    await request(app).patch(`/api/pharmacies/${pharmacy.id}/status`).set(authHeader(superAdminToken)).send({ status: "INACTIVE" });
    await place(superAdminToken, users.spg.id, pharmacy.id).expect(400);

    const admin = await login("081100000002");
    await place(admin.accessToken, users.spg.id, pharmacy.id).expect(403);
  });

  it("scopes placement lists by role", async () => {
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    const outsider = await createUserDirect("SPG", "SPG Luar Tim");
    const pharmacy = await createPharmacy(superAdminToken);
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);
    await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    await place(superAdminToken, outsider.id, pharmacy.id).expect(201);

    const spgNames = async (phone: string) =>
      (await request(app).get("/api/placements").set(authHeader((await login(phone)).accessToken)).expect(200)).body.placements
        .map((placement: { spg: { name: string } }) => placement.spg.name)
        .sort();

    expect(await spgNames("081100000001")).toEqual(["SPG Luar Tim", "Test SPG"]);
    expect(await spgNames("081100000003")).toEqual(["Test SPG"]);
    expect(await spgNames("081100000004")).toEqual(["Test SPG"]);
    expect(await spgNames(outsider.loginPhone)).toEqual(["SPG Luar Tim"]);
  });
});

describe("Teams (BR-04)", () => {
  it("creates teams led by one active Team Leader each", async () => {
    const team = await createTeam(superAdminToken, users.teamLeader.id, "Tim Jakarta Timur");

    const create = (body: object) => request(app).post("/api/teams").set(authHeader(superAdminToken)).send(body);
    await create({ name: "Tim Kedua", leaderId: users.teamLeader.id }).expect(409);
    await create({ name: "Tim Jakarta Timur", leaderId: (await createUserDirect("TEAM_LEADER")).id }).expect(409);
    await create({ name: "Tim SPG", leaderId: users.spg.id }).expect(400);

    const renamed = await request(app)
      .patch(`/api/teams/${team.id}`)
      .set(authHeader(superAdminToken))
      .send({ name: "Tim Jaktim" })
      .expect(200);
    expect(renamed.body.team.name).toBe("Tim Jaktim");
  });

  it("keeps each SPG in one team and tells the leaders about moves", async () => {
    const otherLeader = await createUserDirect("TEAM_LEADER", "Leader Kedua");
    const teamA = await createTeam(superAdminToken, users.teamLeader.id, "Tim A");
    const teamB = await createTeam(superAdminToken, otherLeader.id, "Tim B");

    await setTeam(superAdminToken, users.spg.id, teamA.id).expect(200);
    const moved = await setTeam(superAdminToken, users.spg.id, teamB.id).expect(200);
    expect(moved.body.user.team.name).toBe("Tim B");

    const leaderANotes = await prisma.notification.findMany({ where: { userId: users.teamLeader.id } });
    expect(leaderANotes.map((note) => note.title)).toEqual(expect.arrayContaining(["Anggota tim baru", "Anggota tim keluar"]));
    expect(await prisma.notification.count({ where: { userId: otherLeader.id, title: "Anggota tim baru" } })).toBe(1);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "user.update_team" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toMatchObject({ before: { teamName: "Tim A" }, after: { teamName: "Tim B" } });

    await setTeam(superAdminToken, users.teamLeader.id, teamA.id).expect(400);
  });

  it("shows a Team Leader only their own team", async () => {
    const otherLeader = await createUserDirect("TEAM_LEADER");
    const team = await createTeam(superAdminToken, users.teamLeader.id, "Tim Saya");
    await createTeam(superAdminToken, otherLeader.id, "Tim Orang Lain");
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);

    const leader = await login("081100000003");
    const teams = await request(app).get("/api/teams").set(authHeader(leader.accessToken)).expect(200);
    expect(teams.body.teams).toHaveLength(1);
    expect(teams.body.teams[0]).toMatchObject({ name: "Tim Saya", members: [{ name: "Test SPG" }] });

    const admin = await login("081100000002");
    expect((await request(app).get("/api/teams").set(authHeader(admin.accessToken)).expect(200)).body.teams).toHaveLength(2);

    const spg = await login("081100000004");
    await request(app).get("/api/teams").set(authHeader(spg.accessToken)).expect(403);
  });
});
