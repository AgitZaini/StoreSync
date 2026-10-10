import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { addBusinessDays, businessDate } from "../../src/utils/time";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, createTeam, createUserDirect, place, setTeam } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;
let superAdminToken: string;
let adminToken: string;
let spgToken: string;
let kasirToken: string;
let pharmacy: { id: string; name: string };
let madu: { id: string };
let teh: { id: string };

const today = businessDate();

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
  adminToken = (await login("081100000002")).accessToken;
  spgToken = (await login("081100000004")).accessToken;
  pharmacy = await createPharmacy(superAdminToken, { name: "Apotek Penjualan" });
  // Akun kasir test yang sudah ganti sandi dijadikan kasir apotek ini.
  await prisma.pharmacy.update({ where: { id: pharmacy.id }, data: { kasirUserId: users.kasir.id } });
  kasirToken = (await login("081100000005")).accessToken;
  await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
  madu = await prisma.product.create({ data: { code: "MADU", name: "Madu", unit: "botol", price: 65000 } });
  teh = await prisma.product.create({ data: { code: "TEH", name: "Teh Herbal", unit: "kotak", price: 45000 } });
  await request(app)
    .put("/api/field-stock/opening")
    .set(authHeader(adminToken))
    .send({ spgId: users.spg.id, pharmacyId: pharmacy.id, items: [{ productId: madu.id, qty: 10 }, { productId: teh.id, qty: 4 }] })
    .expect(200);
});

afterAll(async () => {
  await closeDatabase();
});

let photoSequence = 0;
const cashierPhoto = async (userId = users.kasir.id) =>
  prisma.fileObject.create({
    data: {
      key: `cashier_photo/test/${Date.now()}-${++photoSequence}.jpg`,
      purpose: "CASHIER_PHOTO",
      mimeType: "image/jpeg",
      size: 120_000,
      status: "UPLOADED",
      uploadedAt: new Date(),
      uploadedById: userId,
    },
  });

const fieldQty = async (productId: string) =>
  (await prisma.fieldStock.findUnique({ where: { holderId_pharmacyId_productId: { holderId: users.spg.id, pharmacyId: pharmacy.id, productId } } }))?.qty ?? 0;
const warehouseQty = async (productId: string) => (await prisma.warehouseStock.findUnique({ where: { productId } }))?.qty ?? 0;

const submitReport = (items: Array<{ productId: string; qty: number }>, extra: Record<string, unknown> = {}, token = spgToken) =>
  request(app).post("/api/sales-reports").set(authHeader(token)).send({ pharmacyId: pharmacy.id, items, ...extra });

const kasirDecision = async (reportId: string, action: "approve" | "reject", body: Record<string, unknown> = {}, token = kasirToken) => {
  const photo = await cashierPhoto();
  return request(app)
    .post(`/api/sales-reports/${reportId}/${action}`)
    .set(authHeader(token))
    .send({ revision: 1, cashierName: "Rina", cashierPhotoFileId: photo.id, ...body });
};

describe("Sales reports (JUL-01, JUL-03, JUL-04)", () => {
  it("counts a sale only after the cashier approves it, then locks the report", async () => {
    const submitted = await submitReport([
      { productId: madu.id, qty: 3 },
      { productId: teh.id, qty: 1 },
    ]).expect(201);
    const report = submitted.body.report;
    expect(report).toMatchObject({ status: "SUBMITTED", reportDate: today, totalAmount: "240000", revision: 1, code: expect.stringMatching(/^LAP-\d{6}$/) });
    expect(await prisma.notification.count({ where: { userId: users.kasir.id, title: "Laporan penjualan menunggu persetujuan" } })).toBe(1);
    // Belum disetujui: stok belum berkurang dan belum jadi omzet.
    expect(await fieldQty(madu.id)).toBe(10);

    const approved = await kasirDecision(report.id, "approve");
    expect(approved.status).toBe(200);
    expect(approved.body.report).toMatchObject({
      status: "APPROVED",
      approvals: [{ step: "KASIR", decision: "APPROVED", cashierName: "Rina", approver: { id: users.kasir.id } }],
    });
    expect(await fieldQty(madu.id)).toBe(7);
    expect(await fieldQty(teh.id)).toBe(3);
    expect(await prisma.fieldStockMovement.count({ where: { salesReportId: report.id, type: "SALE_APPROVED" } })).toBe(2);
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Laporan penjualan disetujui" } })).toBe(1);

    const month = today.slice(0, 7);
    await prisma.salesTarget.create({ data: { spgId: users.spg.id, month, amount: 1_000_000 } });
    const performance = await request(app).get(`/api/sales-reports/performance?month=${month}`).set(authHeader(spgToken)).expect(200);
    expect(performance.body.rows).toEqual([expect.objectContaining({ approvedAmount: "240000", target: "1000000", percent: 24 })]);
    expect(performance.body.daily).toEqual([{ date: today, amount: "240000" }]);

    // AB-06: tidak bisa diubah SPG, dan database menolak perubahan langsung.
    await request(app).put(`/api/sales-reports/${report.id}`).set(authHeader(spgToken)).send({ items: [{ productId: madu.id, qty: 1 }] }).expect(409);
    await expect(prisma.salesReport.update({ where: { id: report.id }, data: { totalAmount: 1 } })).rejects.toThrow(/AB-06/);
    await expect(prisma.salesReportItem.deleteMany({ where: { reportId: report.id } })).rejects.toThrow(/AB-06/);

    const actions = await prisma.auditLog.findMany({ where: { entity: "SalesReport" }, select: { action: true }, orderBy: { createdAt: "asc" } });
    expect(actions.map((entry) => entry.action)).toEqual(["sales_report.submit", "sales_report.approve"]);
  });

  it("refuses quantities above the available stock, counting pending reports", async () => {
    const tooMany = await submitReport([{ productId: madu.id, qty: 11 }]).expect(409);
    expect(tooMany.body).toMatchObject({ code: "EXCEEDS_STOCK", details: { items: [{ productName: "Madu", requested: 11, available: 10 }] } });

    await submitReport([{ productId: madu.id, qty: 6 }]).expect(201);
    // Laporan kemarin: 6 yang menunggu kasir ikut mengurangi stok tersedia.
    const yesterday = await submitReport([{ productId: madu.id, qty: 5 }], { reportDate: addBusinessDays(today, -1) }).expect(409);
    expect(yesterday.body.details.items[0].available).toBe(4);
    await submitReport([{ productId: madu.id, qty: 4 }], { reportDate: addBusinessDays(today, -1) }).expect(201);

    const available = await request(app).get(`/api/field-stock/available?pharmacyId=${pharmacy.id}`).set(authHeader(spgToken)).expect(200);
    expect(available.body.stock.find((row: { product: { id: string } }) => row.product.id === madu.id)).toMatchObject({
      onHand: 10,
      pendingSales: 10,
      available: 0,
    });
  });

  it("keeps one report per pharmacy per day, for today or yesterday only", async () => {
    await submitReport([{ productId: madu.id, qty: 1 }]).expect(201);
    const duplicate = await submitReport([{ productId: teh.id, qty: 1 }]).expect(409);
    expect(duplicate.body.code).toBe("REPORT_EXISTS");

    await submitReport([{ productId: madu.id, qty: 1 }], { reportDate: addBusinessDays(today, -2) }).expect(400);
    await submitReport([{ productId: madu.id, qty: 1 }], { reportDate: addBusinessDays(today, 1) }).expect(400);

    const other = await createPharmacy(superAdminToken, { name: "Apotek Bukan Tugas" });
    await request(app).post("/api/sales-reports").set(authHeader(spgToken)).send({ pharmacyId: other.id, items: [{ productId: madu.id, qty: 1 }] }).expect(403);
  });

  it("sends a rejected report back to the SPG, who fixes and resubmits it", async () => {
    const report = (await submitReport([{ productId: madu.id, qty: 5 }]).expect(201)).body.report;

    await kasirDecision(report.id, "reject").then((response) => expect(response.status).toBe(400));
    await kasirDecision(report.id, "reject", { cashierName: "" }).then((response) => expect(response.status).toBe(400));
    const rejected = await kasirDecision(report.id, "reject", { reason: "Terjual 4, bukan 5" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.report).toMatchObject({ status: "REJECTED", rejectReason: "Terjual 4, bukan 5" });
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Laporan penjualan ditolak" } })).toBe(1);

    const fixed = await request(app)
      .put(`/api/sales-reports/${report.id}`)
      .set(authHeader(spgToken))
      .send({ items: [{ productId: madu.id, qty: 4 }] })
      .expect(200);
    expect(fixed.body.report).toMatchObject({ status: "SUBMITTED", revision: 2, totalAmount: "260000", rejectReason: null });
    expect(await prisma.notification.count({ where: { userId: users.kasir.id, title: "Laporan penjualan dikirim ulang" } })).toBe(1);

    // Kasir yang masih melihat revisi lama tidak bisa menyetujui.
    const stale = await kasirDecision(report.id, "approve", { revision: 1 });
    expect(stale.body.code).toBe("REVISION_MISMATCH");
    const approved = await kasirDecision(report.id, "approve", { revision: 2 });
    expect(approved.status).toBe(200);
    expect(approved.body.report.approvals.map((approval: { decision: string }) => approval.decision)).toEqual(["REJECTED", "APPROVED"]);
    expect(await fieldQty(madu.id)).toBe(6);
  });

  it("re-checks stock when the cashier approves", async () => {
    const report = (await submitReport([{ productId: madu.id, qty: 8 }]).expect(201)).body.report;
    // Stok awal dikoreksi Admin setelah laporan dikirim (masih bisa karena belum ada transaksi).
    await request(app)
      .put("/api/field-stock/opening")
      .set(authHeader(adminToken))
      .send({ spgId: users.spg.id, pharmacyId: pharmacy.id, items: [{ productId: madu.id, qty: 5 }] })
      .expect(200);

    const blocked = await kasirDecision(report.id, "approve");
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("EXCEEDS_STOCK");
    expect(await fieldQty(madu.id)).toBe(5);
    expect(await prisma.approval.count()).toBe(0);
  });

  it("limits cashiers to their own pharmacy and a fresh photo", async () => {
    const report = (await submitReport([{ productId: madu.id, qty: 1 }]).expect(201)).body.report;

    const otherPharmacy = await createPharmacy(superAdminToken, { name: "Apotek Lain" });
    const otherKasir = await createUserDirect("KASIR", "Kasir Lain");
    await prisma.pharmacy.update({ where: { id: otherPharmacy.id }, data: { kasirUserId: otherKasir.id } });
    const other = await login(otherKasir.loginPhone);
    expect((await request(app).get("/api/sales-reports").set(authHeader(other.accessToken)).expect(200)).body.reports).toHaveLength(0);
    const foreign = await kasirDecision(report.id, "approve", { cashierPhotoFileId: (await cashierPhoto(otherKasir.id)).id }, other.accessToken);
    expect(foreign.status).toBe(404);

    expect((await request(app).get("/api/sales-reports?status=SUBMITTED").set(authHeader(kasirToken)).expect(200)).body.reports).toHaveLength(1);
    await request(app)
      .post(`/api/sales-reports/${report.id}/approve`)
      .set(authHeader(spgToken))
      .send({ revision: 1, cashierName: "Rina", cashierPhotoFileId: (await cashierPhoto()).id })
      .expect(403);

    const spgPhoto = await cashierPhoto(users.spg.id);
    expect((await kasirDecision(report.id, "approve", { cashierPhotoFileId: spgPhoto.id })).status).toBe(400);

    const used = await kasirDecision(report.id, "approve");
    expect(used.status).toBe(200);
    const usedPhotoId = used.body.report.approvals[0].cashierPhotoFileId;
    const second = (await submitReport([{ productId: teh.id, qty: 1 }], { reportDate: addBusinessDays(today, -1) }).expect(201)).body.report;
    expect((await kasirDecision(second.id, "approve", { cashierPhotoFileId: usedPhotoId })).status).toBe(409);
  });

  it("keeps a double tap from approving a report twice", async () => {
    const report = (await submitReport([{ productId: madu.id, qty: 2 }]).expect(201)).body.report;
    const photos = await Promise.all([1, 2, 3, 4, 5].map(() => cashierPhoto()));
    const results = await Promise.all(
      photos.map((photo) =>
        request(app)
          .post(`/api/sales-reports/${report.id}/approve`)
          .set(authHeader(kasirToken))
          .send({ revision: 1, cashierName: "Rina", cashierPhotoFileId: photo.id }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409, 409, 409]);
    expect(await fieldQty(madu.id)).toBe(8);
    expect(await prisma.approval.count()).toBe(1);
  });

  it("lists reports still waiting for the cashier after a day (JUL-05)", async () => {
    const old = (await submitReport([{ productId: madu.id, qty: 1 }], { reportDate: addBusinessDays(today, -1) }).expect(201)).body.report;
    await prisma.salesReport.update({ where: { id: old.id }, data: { submittedAt: new Date(Date.now() - 30 * 60 * 60 * 1000) } });
    await submitReport([{ productId: teh.id, qty: 1 }]).expect(201);

    const pending = await request(app).get("/api/sales-reports/pending?olderThanDays=1").set(authHeader(adminToken)).expect(200);
    expect(pending.body.reports).toEqual([expect.objectContaining({ id: old.id, hoursWaiting: 30, pharmacy: expect.objectContaining({ kasir: expect.objectContaining({ phone: "6281100000005" }) }) })]);
    await request(app).get("/api/sales-reports/pending").set(authHeader(spgToken)).expect(403);

    const overview = await request(app).get("/api/dashboard/overview").set(authHeader(superAdminToken)).expect(200);
    expect(overview.body.overview.sales).toMatchObject({ pendingReports: 2, overdueReports: 1 });
  });

  it("shows Team Leaders their team's performance only", async () => {
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    const leader = await login("081100000003");
    const month = today.slice(0, 7);
    expect((await request(app).get(`/api/sales-reports/performance?month=${month}`).set(authHeader(leader.accessToken)).expect(200)).body.rows).toHaveLength(0);

    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);
    const report = (await submitReport([{ productId: madu.id, qty: 2 }]).expect(201)).body.report;
    const rows = (await request(app).get(`/api/sales-reports/performance?month=${month}`).set(authHeader(leader.accessToken)).expect(200)).body.rows;
    expect(rows).toEqual([expect.objectContaining({ approvedAmount: "0", pendingAmount: "130000", target: null, percent: null })]);
    await request(app).get(`/api/sales-reports/${report.id}`).set(authHeader(leader.accessToken)).expect(200);
    await request(app).get(`/api/sales-reports/performance?month=${month}`).set(authHeader(kasirToken)).expect(403);
  });
});

describe("Returns (RTR-01…04)", () => {
  const submitReturn = (items: Array<{ productId: string; qty: number }>, extra: Record<string, unknown> = {}) =>
    request(app).post("/api/returns").set(authHeader(spgToken)).send({ pharmacyId: pharmacy.id, reason: "Kemasan rusak", items, ...extra });

  const kasirReturn = async (returnId: string, action: "kasir-approve" | "kasir-reject", body: Record<string, unknown> = {}) => {
    const photo = await cashierPhoto();
    return request(app)
      .post(`/api/returns/${returnId}/${action}`)
      .set(authHeader(kasirToken))
      .send({ cashierName: "Rina", cashierPhotoFileId: photo.id, ...body });
  };

  it("moves goods from the SPG back to the central warehouse after every approval", async () => {
    const goodsPhoto = await prisma.fileObject.create({
      data: { key: "return_photo/test/rusak.jpg", purpose: "RETURN_PHOTO", mimeType: "image/jpeg", size: 90_000, status: "UPLOADED", uploadedAt: new Date(), uploadedById: users.spg.id },
    });
    const created = await submitReturn([{ productId: madu.id, qty: 3 }], { photoFileId: goodsPhoto.id }).expect(201);
    const returned = created.body.return;
    expect(returned).toMatchObject({ status: "SUBMITTED", code: expect.stringMatching(/^RTR-\d{6}$/) });
    expect(await prisma.notification.count({ where: { userId: users.kasir.id, title: "Retur menunggu persetujuan" } })).toBe(1);
    // Kasir boleh melihat foto barang dari apoteknya.
    await request(app).get(`/api/files/${goodsPhoto.id}`).set(authHeader(kasirToken)).expect(200);

    // Super Admin belum bisa memutuskan sebelum kasir.
    await request(app).post(`/api/returns/${returned.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(409);

    expect((await kasirReturn(returned.id, "kasir-approve")).body.return.status).toBe("KASIR_APPROVED");
    expect(await prisma.notification.count({ where: { userId: users.superAdmin.id, title: "Retur menunggu persetujuan" } })).toBe(1);

    await request(app).post(`/api/returns/${returned.id}/receive`).set(authHeader(adminToken)).send({}).expect(409);
    const saApproved = await request(app).post(`/api/returns/${returned.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);
    expect(saApproved.body.return).toMatchObject({ status: "SA_APPROVED", approvals: [{ step: "KASIR" }, { step: "SUPER_ADMIN", decision: "APPROVED" }] });
    expect(await prisma.notification.count({ where: { userId: users.admin.id, title: "Retur siap diterima gudang" } })).toBe(1);

    // Selama retur berjalan, 3 botol tidak bisa dilaporkan terjual.
    const sale = await submitReport([{ productId: madu.id, qty: 8 }]).expect(409);
    expect(sale.body.details.items[0].available).toBe(7);

    const receive = (body: object) => request(app).post(`/api/returns/${returned.id}/receive`).set(authHeader(adminToken)).send(body);
    await receive({ items: [{ itemId: returned.items[0].id, qty: 2 }] }).expect(400);
    const received = await receive({ items: [{ itemId: returned.items[0].id, qty: 2 }], note: "Satu botol tidak ada di kardus" }).expect(200);
    expect(received.body.return).toMatchObject({ status: "RECEIVED", hasDiscrepancy: true, receivedBy: { name: "Test Admin" } });
    // Stok SPG berkurang sejumlah yang disetujui; stok pusat bertambah sejumlah yang diterima.
    expect(await fieldQty(madu.id)).toBe(7);
    expect(await warehouseQty(madu.id)).toBe(2);
    expect(await prisma.notification.count({ where: { userId: users.superAdmin.id, title: "Selisih retur" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Retur diterima gudang" } })).toBe(1);

    const actions = await prisma.auditLog.findMany({ where: { entity: "Return" }, select: { action: true }, orderBy: { createdAt: "asc" } });
    expect(actions.map((entry) => entry.action)).toEqual(["return.submit", "return.kasir_approve", "return.sa_approve", "return.receive"]);
  });

  it("requires reasons to reject and never returns more than is available", async () => {
    await submitReturn([{ productId: teh.id, qty: 5 }]).expect(409);
    await submitReturn([{ productId: teh.id, qty: 1 }], { reason: "rusak" }).expect(201);

    const first = (await submitReturn([{ productId: teh.id, qty: 2 }]).expect(201)).body.return;
    expect((await kasirReturn(first.id, "kasir-reject")).status).toBe(400);
    const kasirRejected = await kasirReturn(first.id, "kasir-reject", { reason: "Barang masih bagus" });
    expect(kasirRejected.body.return).toMatchObject({ status: "REJECTED", rejectedStep: "KASIR", rejectReason: "Barang masih bagus" });
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Retur ditolak kasir" } })).toBe(1);

    const second = (await submitReturn([{ productId: teh.id, qty: 2 }]).expect(201)).body.return;
    await kasirReturn(second.id, "kasir-approve");
    const reject = (body: object) => request(app).post(`/api/returns/${second.id}/reject`).set(authHeader(superAdminToken)).send(body);
    await reject({}).expect(400);
    const saRejected = await reject({ reason: "Jual dulu di apotek" }).expect(200);
    expect(saRejected.body.return).toMatchObject({ status: "REJECTED", rejectedStep: "SUPER_ADMIN" });
    expect(await fieldQty(teh.id)).toBe(4);

    await request(app).post(`/api/returns/${second.id}/approve`).set(authHeader(adminToken)).send({}).expect(403);
  });

  it("keeps a double tap from receiving a return twice", async () => {
    const returned = (await submitReturn([{ productId: madu.id, qty: 2 }]).expect(201)).body.return;
    await kasirReturn(returned.id, "kasir-approve");
    await request(app).post(`/api/returns/${returned.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => request(app).post(`/api/returns/${returned.id}/receive`).set(authHeader(adminToken)).send({})),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409, 409, 409]);
    expect(await fieldQty(madu.id)).toBe(8);
    expect(await warehouseQty(madu.id)).toBe(2);
  });

  it("keeps a placement from ending while documents are still open", async () => {
    const placement = await prisma.placement.findFirstOrThrow({ where: { spgId: users.spg.id, endedAt: null } });
    await submitReport([{ productId: madu.id, qty: 1 }]).expect(201);
    const blocked = await request(app).post(`/api/placements/${placement.id}/end`).set(authHeader(superAdminToken)).send({ reason: "Pindah" }).expect(409);
    expect(blocked.body.code).toBe("OPEN_DOCUMENTS");
  });
});
