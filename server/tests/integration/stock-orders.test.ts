import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { businessDate } from "../../src/utils/time";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, createTeam, createUserDirect, place, setTeam } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;
let superAdminToken: string;
let adminToken: string;
let spgToken: string;
let pharmacy: { id: string; name: string };
let madu: { id: string };
let teh: { id: string };

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
  adminToken = (await login("081100000002")).accessToken;
  spgToken = (await login("081100000004")).accessToken;
  pharmacy = await createPharmacy(superAdminToken, { name: "Apotek Stok" });
  await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
  madu = await prisma.product.create({ data: { code: "MADU", name: "Madu", unit: "botol", price: 65000 } });
  teh = await prisma.product.create({ data: { code: "TEH", name: "Teh Herbal", unit: "kotak", price: 45000 } });
});

afterAll(async () => {
  await closeDatabase();
});

const inbound = (items: Array<{ productId: string; qty: number }>, token = adminToken, extra: Record<string, unknown> = {}) =>
  request(app)
    .post("/api/warehouse/inbound")
    .set(authHeader(token))
    .send({ date: businessDate(), items, ...extra });

const warehouseQty = async (productId: string) => (await prisma.warehouseStock.findUnique({ where: { productId } }))?.qty ?? 0;
const fieldQty = async (holderId: string, productId: string, pharmacyId = pharmacy.id) =>
  (await prisma.fieldStock.findUnique({ where: { holderId_pharmacyId_productId: { holderId, pharmacyId, productId } } }))?.qty ?? 0;

const submitOrder = (items: Array<{ productId: string; qty: number }>, token = spgToken, pharmacyId = pharmacy.id) =>
  request(app).post("/api/orders").set(authHeader(token)).send({ pharmacyId, items });

const itemOf = (order: { items: Array<{ id: string; product: { id: string } }> }, productId: string) =>
  order.items.find((item) => item.product.id === productId)!;

describe("Warehouse stock (STK-01)", () => {
  it("records inbound goods with a PO number and keeps a movement history", async () => {
    const created = await inbound(
      [
        { productId: madu.id, qty: 20 },
        { productId: teh.id, qty: 5 },
      ],
      adminToken,
      { poNumber: "PO-001", note: "Kiriman pabrik" },
    ).expect(201);
    expect(created.body.movements.map((movement: { balanceAfter: number }) => movement.balanceAfter)).toEqual([20, 5]);

    await inbound([{ productId: madu.id, qty: 3 }]).expect(201);
    expect(await warehouseQty(madu.id)).toBe(23);

    const movements = await request(app).get(`/api/warehouse/movements?productId=${madu.id}`).set(authHeader(superAdminToken)).expect(200);
    expect(movements.body.movements.map((movement: { qty: number; balanceAfter: number }) => [movement.qty, movement.balanceAfter])).toEqual([
      [3, 23],
      [20, 20],
    ]);
    expect(movements.body.movements[1]).toMatchObject({ type: "INBOUND", poNumber: "PO-001", createdBy: { name: "Test Admin" } });
    expect(await prisma.auditLog.count({ where: { action: "warehouse.inbound" } })).toBe(2);

    const stock = await request(app).get("/api/warehouse/stock").set(authHeader(spgToken)).expect(200);
    expect(stock.body.stock.find((row: { product: { id: string } }) => row.product.id === madu.id).qty).toBe(23);
  });

  it("validates inbound goods and limits them to Admin", async () => {
    await inbound([{ productId: madu.id, qty: 1 }], superAdminToken).expect(403);
    await inbound([{ productId: madu.id, qty: 1 }], spgToken).expect(403);
    await inbound([{ productId: madu.id, qty: 0 }]).expect(400);
    await inbound([
      { productId: madu.id, qty: 1 },
      { productId: madu.id, qty: 2 },
    ]).expect(400);
    await inbound([{ productId: madu.id, qty: 1 }], adminToken, { date: "2999-01-01" }).expect(400);
    await prisma.product.update({ where: { id: teh.id }, data: { isActive: false } });
    await inbound([{ productId: teh.id, qty: 1 }]).expect(400);
    await request(app).get("/api/warehouse/movements").set(authHeader(spgToken)).expect(403);
  });

  it("requires a reason for adjustments and never goes below zero", async () => {
    await inbound([{ productId: madu.id, qty: 4 }]).expect(201);
    const adjust = (body: object) => request(app).post("/api/warehouse/adjustments").set(authHeader(adminToken)).send(body);

    await adjust({ productId: madu.id, qty: -1 }).expect(400);
    const tooMuch = await adjust({ productId: madu.id, qty: -5, reason: "Rusak saat bongkar" }).expect(409);
    expect(tooMuch.body).toMatchObject({ code: "INSUFFICIENT_STOCK", details: { available: 4, needed: 5 } });

    const adjusted = await adjust({ productId: madu.id, qty: -1, reason: "Botol pecah di gudang" }).expect(201);
    expect(adjusted.body.movement).toMatchObject({ qty: -1, balanceAfter: 3 });
    expect(await prisma.auditLog.count({ where: { action: "warehouse.adjust" } })).toBe(1);

    const movement = await prisma.warehouseMovement.findFirstOrThrow({ where: { type: "ADJUSTMENT" } });
    await expect(prisma.warehouseMovement.update({ where: { id: movement.id }, data: { qty: 0 } })).rejects.toThrow(/append-only/);
    await expect(prisma.warehouseStock.update({ where: { productId: madu.id }, data: { qty: -1 } })).rejects.toThrow(/nonnegative/);
  });
});

describe("Orders (ORD-01…04)", () => {
  it("runs submit → approve → ship → receive, moving stock from warehouse to the SPG", async () => {
    await inbound([{ productId: madu.id, qty: 10 }]).expect(201);

    const submitted = await submitOrder([
      { productId: madu.id, qty: 5 },
      { productId: teh.id, qty: 4 },
    ]).expect(201);
    const order = submitted.body.order;
    expect(order).toMatchObject({ status: "SUBMITTED", code: expect.stringMatching(/^ORD-\d{6}$/) });
    // ORD-01: stok pusat Teh 0 tetap tercatat sebagai permintaan belum terpenuhi.
    expect(itemOf(order, teh.id)).toMatchObject({ requestedQty: 4, stockAtSubmit: 0, unfulfilledAtSubmit: true });
    expect(itemOf(order, madu.id)).toMatchObject({ stockAtSubmit: 10, unfulfilledAtSubmit: false });
    expect(await prisma.notification.count({ where: { userId: users.superAdmin.id, title: "Order baru" } })).toBe(1);

    const approve = (body: object) => request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(superAdminToken)).send(body);
    await approve({ items: [{ itemId: itemOf(order, madu.id).id, qty: 6 }] }).expect(400);
    await approve({ items: [{ itemId: itemOf(order, madu.id).id, qty: 0 }, { itemId: itemOf(order, teh.id).id, qty: 0 }] }).expect(400);
    await request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(adminToken)).send({}).expect(403);

    const approved = await approve({ items: [{ itemId: itemOf(order, madu.id).id, qty: 3 }, { itemId: itemOf(order, teh.id).id, qty: 0 }] }).expect(200);
    expect(approved.body.order).toMatchObject({ status: "APPROVED", approvals: [{ decision: "APPROVED", approver: { name: "Test Super Admin" } }] });
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Order disetujui" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: users.admin.id, title: "Order siap dikirim" } })).toBe(1);
    await approve({}).expect(409);

    // SPG belum bisa menerima sebelum dikirim.
    await request(app).post(`/api/orders/${order.id}/receive`).set(authHeader(spgToken)).send({}).expect(409);

    const shipped = await request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({ note: "Kurir pagi" }).expect(200);
    expect(itemOf(shipped.body.order, madu.id)).toMatchObject({ approvedQty: 3, shippedQty: 3 });
    expect(itemOf(shipped.body.order, teh.id)).toMatchObject({ approvedQty: 0, shippedQty: 0 });
    expect(await warehouseQty(madu.id)).toBe(7);
    expect(await prisma.warehouseMovement.count({ where: { type: "ORDER_SHIPPED", orderId: order.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Order dikirim" } })).toBe(1);

    const received = await request(app).post(`/api/orders/${order.id}/receive`).set(authHeader(spgToken)).send({}).expect(200);
    expect(received.body.order).toMatchObject({ status: "RECEIVED", hasDiscrepancy: false });
    expect(await fieldQty(users.spg.id, madu.id)).toBe(3);
    expect(await prisma.notification.count({ where: { title: "Selisih penerimaan order" } })).toBe(0);

    const actions = await prisma.auditLog.findMany({ where: { entity: "Order" }, select: { action: true }, orderBy: { createdAt: "asc" } });
    expect(actions.map((entry) => entry.action)).toEqual(["order.submit", "order.approve", "order.ship", "order.receive"]);
  });

  it("flags received quantities that differ from what was shipped", async () => {
    await inbound([{ productId: madu.id, qty: 10 }]).expect(201);
    const order = (await submitOrder([{ productId: madu.id, qty: 6 }]).expect(201)).body.order;
    await request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);
    await request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({}).expect(200);

    const receive = (body: object) => request(app).post(`/api/orders/${order.id}/receive`).set(authHeader(spgToken)).send(body);
    const lines = [{ itemId: order.items[0].id, qty: 5 }];
    const noNote = await receive({ items: lines }).expect(400);
    expect(noNote.body.message).toMatch(/Jelaskan selisihnya/);

    const received = await receive({ items: lines, note: "Satu botol pecah di jalan" }).expect(200);
    expect(received.body.order).toMatchObject({ hasDiscrepancy: true, receiveNote: "Satu botol pecah di jalan" });
    expect(await fieldQty(users.spg.id, madu.id)).toBe(5);
    const alert = await prisma.notification.findFirstOrThrow({ where: { userId: users.admin.id, title: "Selisih penerimaan order" } });
    expect(alert.message).toMatch(/Madu dikirim 6, diterima 5/);

    const open = await request(app).get("/api/orders?openDiscrepancy=true").set(authHeader(adminToken)).expect(200);
    expect(open.body.orders).toHaveLength(1);

    const resolve = (body: object, token = adminToken) =>
      request(app).post(`/api/orders/${order.id}/resolve-discrepancy`).set(authHeader(token)).send(body);
    await resolve({ note: "Cek kurir" }, spgToken).expect(403);
    await resolve({}).expect(400);
    const resolved = await resolve({ note: "Sudah dicek dengan kurir" }).expect(200);
    expect(resolved.body.order).toMatchObject({ discrepancyNote: "Sudah dicek dengan kurir", discrepancyResolvedBy: { name: "Test Admin" } });
    await resolve({ note: "Lagi" }).expect(409);
    expect((await request(app).get("/api/orders?openDiscrepancy=true").set(authHeader(adminToken)).expect(200)).body.orders).toHaveLength(0);
  });

  it("requires a reason to reject, visible to the SPG", async () => {
    const order = (await submitOrder([{ productId: madu.id, qty: 2 }]).expect(201)).body.order;
    const reject = (body: object) => request(app).post(`/api/orders/${order.id}/reject`).set(authHeader(superAdminToken)).send(body);

    await reject({}).expect(400);
    const rejected = await reject({ reason: "Stok apotek masih banyak" }).expect(200);
    expect(rejected.body.order).toMatchObject({ status: "REJECTED", rejectReason: "Stok apotek masih banyak", approvals: [{ decision: "REJECTED" }] });

    const own = await request(app).get(`/api/orders/${order.id}`).set(authHeader(spgToken)).expect(200);
    expect(own.body.order.rejectReason).toBe("Stok apotek masih banyak");
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Order ditolak" } })).toBe(1);

    await request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({}).expect(409);
    const approval = await prisma.approval.findFirstOrThrow();
    await expect(prisma.approval.delete({ where: { id: approval.id } })).rejects.toThrow(/append-only/);
  });

  it("lets SPG order only for their own pharmacies and shows orders by scope", async () => {
    const other = await createPharmacy(superAdminToken, { name: "Apotek Lain" });
    const denied = await submitOrder([{ productId: madu.id, qty: 1 }], spgToken, other.id).expect(403);
    expect(denied.body.message).toMatch(/tidak ditugaskan/);

    await prisma.product.update({ where: { id: teh.id }, data: { isActive: false } });
    await submitOrder([{ productId: teh.id, qty: 1 }]).expect(400);
    await submitOrder([{ productId: madu.id, qty: 1 }], adminToken).expect(403);

    const order = (await submitOrder([{ productId: madu.id, qty: 1 }]).expect(201)).body.order;

    const otherSpg = await createUserDirect("SPG", "SPG Lain");
    const otherSession = await login(otherSpg.loginPhone);
    await request(app).get(`/api/orders/${order.id}`).set(authHeader(otherSession.accessToken)).expect(404);
    expect((await request(app).get("/api/orders").set(authHeader(otherSession.accessToken)).expect(200)).body.orders).toHaveLength(0);

    const leader = await login("081100000003");
    expect((await request(app).get("/api/orders").set(authHeader(leader.accessToken)).expect(200)).body.orders).toHaveLength(0);
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);
    expect((await request(app).get("/api/orders").set(authHeader(leader.accessToken)).expect(200)).body.orders).toHaveLength(1);

    const kasir = await login("081100000005");
    await request(app).get("/api/orders").set(authHeader(kasir.accessToken)).expect(403);
  });

  it("never ships more than the warehouse holds, even when two orders ship at once", async () => {
    await inbound([{ productId: madu.id, qty: 10 }]).expect(201);
    const orders = [];
    for (let index = 0; index < 2; index += 1) {
      const order = (await submitOrder([{ productId: madu.id, qty: 8 }]).expect(201)).body.order;
      await request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);
      orders.push(order);
    }

    const results = await Promise.all(
      orders.map((order) => request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({})),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(results.find((result) => result.status === 409)!.body.code).toBe("INSUFFICIENT_STOCK");
    expect(await warehouseQty(madu.id)).toBe(2);

    // Order yang gagal tetap disetujui dan bisa dikirim sebagian.
    const pending = orders.find((_order, index) => results[index].status === 409)!;
    const partial = await request(app)
      .post(`/api/orders/${pending.id}/ship`)
      .set(authHeader(adminToken))
      .send({ items: [{ itemId: pending.items[0].id, qty: 2 }] })
      .expect(200);
    expect(partial.body.order.items[0]).toMatchObject({ approvedQty: 8, shippedQty: 2 });
    expect(await warehouseQty(madu.id)).toBe(0);
  });

  it("keeps a double tap from shipping the same order twice", async () => {
    await inbound([{ productId: madu.id, qty: 50 }]).expect(201);
    const order = (await submitOrder([{ productId: madu.id, qty: 5 }]).expect(201)).body.order;
    await request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({})),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409, 409, 409]);
    expect(await warehouseQty(madu.id)).toBe(45);
    expect(await prisma.warehouseMovement.count({ where: { orderId: order.id } })).toBe(1);
  });
});

describe("Unfulfilled recap (ORD-05)", () => {
  it("shows open demand, what to buy, and shortfalls per product", async () => {
    await inbound([{ productId: madu.id, qty: 4 }]).expect(201);

    // Order 1: Madu 6 (stok 4 → kurang 2), Teh 3 (stok 0). Disetujui penuh, Madu dikirim 4.
    const first = (await submitOrder([
      { productId: madu.id, qty: 6 },
      { productId: teh.id, qty: 3 },
    ]).expect(201)).body.order;
    await request(app).post(`/api/orders/${first.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);
    await request(app)
      .post(`/api/orders/${first.id}/ship`)
      .set(authHeader(adminToken))
      .send({ items: [{ itemId: itemOf(first, madu.id).id, qty: 4 }, { itemId: itemOf(first, teh.id).id, qty: 0 }] })
      .expect(200);

    // Order 2: Teh 5, masih menunggu. Order 3 ditolak: tidak dihitung.
    await submitOrder([{ productId: teh.id, qty: 5 }]).expect(201);
    const rejected = (await submitOrder([{ productId: teh.id, qty: 9 }]).expect(201)).body.order;
    await request(app).post(`/api/orders/${rejected.id}/reject`).set(authHeader(superAdminToken)).send({ reason: "Dobel" }).expect(200);

    const recap = await request(app).get("/api/orders/unfulfilled-recap").set(authHeader(adminToken)).expect(200);
    const rowOf = (id: string) => recap.body.rows.find((row: { product: { id: string } }) => row.product.id === id);

    expect(rowOf(teh.id)).toMatchObject({ warehouseQty: 0, openQty: 5, toPurchase: 5, unfulfilledAtSubmitQty: 8, shortShippedQty: 3 });
    expect(rowOf(madu.id)).toMatchObject({ warehouseQty: 0, openQty: 0, toPurchase: 0, unfulfilledAtSubmitQty: 2, shortShippedQty: 2 });
    expect(recap.body.rows[0].product.id).toBe(teh.id);

    await request(app).get("/api/orders/unfulfilled-recap").set(authHeader(spgToken)).expect(403);
  });
});

describe("Field stock and opening balances (AB-05)", () => {
  const setOpening = (items: Array<{ productId: string; qty: number }>, token = adminToken, spgId = users.spg.id) =>
    request(app).put("/api/field-stock/opening").set(authHeader(token)).send({ spgId, pharmacyId: pharmacy.id, items });

  it("lets Admin set opening stock until other stock activity starts", async () => {
    await setOpening([{ productId: madu.id, qty: 10 }], superAdminToken).expect(403);

    const first = await setOpening([
      { productId: madu.id, qty: 10 },
      { productId: teh.id, qty: 5 },
    ]).expect(200);
    expect(first.body.stock).toMatchObject({ totalQty: 15, hasOpening: true, openingLocked: false });
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Stok awal diisi" } })).toBe(1);

    await setOpening([{ productId: madu.id, qty: 8 }]).expect(200);
    expect(await fieldQty(users.spg.id, madu.id)).toBe(8);
    const openingMoves = await prisma.fieldStockMovement.findMany({ where: { productId: madu.id }, orderBy: { createdAt: "asc" } });
    expect(openingMoves.map((move) => [move.type, move.qty, move.balanceAfter])).toEqual([
      ["OPENING", 10, 10],
      ["OPENING", -2, 8],
    ]);
    expect(await prisma.auditLog.count({ where: { action: "field_stock.opening" } })).toBe(2);

    const stranger = await createUserDirect("SPG", "SPG Tanpa Penempatan");
    await setOpening([{ productId: madu.id, qty: 1 }], adminToken, stranger.id).expect(400);

    // Setelah ada order diterima, stok awal terkunci.
    await inbound([{ productId: teh.id, qty: 5 }]).expect(201);
    const order = (await submitOrder([{ productId: teh.id, qty: 2 }]).expect(201)).body.order;
    await request(app).post(`/api/orders/${order.id}/approve`).set(authHeader(superAdminToken)).send({}).expect(200);
    await request(app).post(`/api/orders/${order.id}/ship`).set(authHeader(adminToken)).send({}).expect(200);
    await request(app).post(`/api/orders/${order.id}/receive`).set(authHeader(spgToken)).send({}).expect(200);
    expect(await fieldQty(users.spg.id, teh.id)).toBe(7);

    const locked = await setOpening([{ productId: madu.id, qty: 1 }]).expect(409);
    expect(locked.body.code).toBe("OPENING_LOCKED");
  });

  it("shows stock by scope with its ledger", async () => {
    await setOpening([{ productId: madu.id, qty: 4 }]).expect(200);

    const own = await request(app).get("/api/field-stock").set(authHeader(spgToken)).expect(200);
    expect(own.body.groups).toEqual([
      expect.objectContaining({ holder: expect.objectContaining({ id: users.spg.id }), totalQty: 4, placementId: expect.any(String) }),
    ]);

    const movements = await request(app)
      .get(`/api/field-stock/movements?holderId=${users.spg.id}&pharmacyId=${pharmacy.id}`)
      .set(authHeader(spgToken))
      .expect(200);
    expect(movements.body.movements[0]).toMatchObject({ type: "OPENING", qty: 4, balanceAfter: 4, createdBy: { name: "Test Admin" } });

    const leader = await login("081100000003");
    expect((await request(app).get("/api/field-stock").set(authHeader(leader.accessToken)).expect(200)).body.groups).toHaveLength(0);
    await request(app)
      .get(`/api/field-stock/movements?holderId=${users.spg.id}&pharmacyId=${pharmacy.id}`)
      .set(authHeader(leader.accessToken))
      .expect(404);

    // Admin juga melihat penempatan yang belum punya stok, supaya bisa mengisi stok awal.
    const newcomer = await createUserDirect("SPG", "SPG Kosong");
    await place(superAdminToken, newcomer.id, pharmacy.id).expect(201);
    const all = await request(app).get("/api/field-stock").set(authHeader(adminToken)).expect(200);
    expect(all.body.groups.find((group: { holder: { id: string } }) => group.holder.id === newcomer.id)).toMatchObject({ totalQty: 0, items: [] });

    const movement = await prisma.fieldStockMovement.findFirstOrThrow();
    await expect(prisma.fieldStockMovement.delete({ where: { id: movement.id } })).rejects.toThrow(/append-only/);
  });

  it("keeps a placement from ending while the SPG still holds stock or has open orders", async () => {
    const placement = await prisma.placement.findFirstOrThrow({ where: { spgId: users.spg.id, endedAt: null } });
    const end = () => request(app).post(`/api/placements/${placement.id}/end`).set(authHeader(superAdminToken)).send({ reason: "Pindah apotek" });

    const order = (await submitOrder([{ productId: madu.id, qty: 1 }]).expect(201)).body.order;
    const blockedByOrder = await end().expect(409);
    expect(blockedByOrder.body.code).toBe("OPEN_ORDERS");
    await request(app).post(`/api/orders/${order.id}/reject`).set(authHeader(superAdminToken)).send({ reason: "Batal" }).expect(200);

    await setOpening([{ productId: madu.id, qty: 3 }]).expect(200);
    const blockedByStock = await end().expect(409);
    expect(blockedByStock.body).toMatchObject({ code: "FIELD_STOCK_REMAINING" });
    expect(blockedByStock.body.message).toMatch(/3 barang/);

    await setOpening([{ productId: madu.id, qty: 0 }]).expect(200);
    await end().expect(200);
  });

  it("summarises orders and warehouse stock on the dashboard", async () => {
    await inbound([{ productId: madu.id, qty: 3 }]).expect(201);
    await submitOrder([{ productId: madu.id, qty: 1 }]).expect(201);
    const overview = await request(app).get("/api/dashboard/overview").set(authHeader(adminToken)).expect(200);
    expect(overview.body.overview.orders).toMatchObject({ submitted: 1, approved: 0 });
    expect(overview.body.overview.warehouse).toMatchObject({ products: 2, totalQty: 3, outOfStock: [{ name: "Teh Herbal" }] });
  });
});
