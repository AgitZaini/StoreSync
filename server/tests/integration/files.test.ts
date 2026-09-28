import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { storage } from "../../src/utils/storage";
import { authHeader, login } from "../helpers/auth.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";

const photo = { purpose: "ATTENDANCE_PHOTO", mimeType: "image/jpeg", size: 180_000 };

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const presign = async (token: string, body: object = photo) =>
  request(app).post("/api/files/presign").set(authHeader(token)).send(body);

describe("Files API", () => {
  it("issues a presigned upload URL and registers a pending file", async () => {
    const spg = await login("081100000004");

    const response = await presign(spg.accessToken);
    expect(response.status).toBe(201);

    const { file, upload } = response.body;
    expect(file).toMatchObject({ purpose: "ATTENDANCE_PHOTO", status: "PENDING", size: photo.size });
    expect(file.key).toMatch(/^attendance_photo\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/);
    expect(upload).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/jpeg" } });
    expect(upload.url).toContain(`/storesync-test/${file.key}`);
    expect(upload.url).toContain("X-Amz-Signature=");
    // Checksum bawaan SDK membuat upload dari browser gagal; pastikan tidak ikut ditandatangani.
    expect(upload.url).not.toMatch(/checksum/i);
  });

  it("validates purpose, type, and size", async () => {
    const spg = await login("081100000004");

    await request(app).post("/api/files/presign").send(photo).expect(401);
    expect((await presign(spg.accessToken, { ...photo, mimeType: "application/pdf" })).status).toBe(400);
    expect((await presign(spg.accessToken, { ...photo, mimeType: "image/gif" })).status).toBe(400);
    expect((await presign(spg.accessToken, { ...photo, size: 6 * 1024 * 1024 })).status).toBe(400);
    expect(
      (await presign(spg.accessToken, { purpose: "DOCTOR_NOTE", mimeType: "application/pdf", size: 900_000 })).status,
    ).toBe(201);
  });

  it("marks a file uploaded only after the object exists with the declared size", async () => {
    const spg = await login("081100000004");
    const { file } = (await presign(spg.accessToken)).body;
    const complete = () => request(app).post(`/api/files/${file.id}/complete`).set(authHeader(spg.accessToken));
    const headObject = jest.spyOn(storage, "headObject");

    headObject.mockResolvedValueOnce(null);
    expect((await complete()).status).toBe(400);

    headObject.mockResolvedValueOnce({ size: 999, contentType: "image/jpeg" });
    expect((await complete()).status).toBe(400);

    headObject.mockResolvedValueOnce({ size: photo.size, contentType: "image/jpeg" });
    const completed = await complete().expect(200);
    expect(completed.body.file.status).toBe("UPLOADED");
    expect(headObject).toHaveBeenCalledWith(file.key);
  });

  it("only lets the uploader, Admin, and Super Admin read a file", async () => {
    const spg = await login("081100000004");
    const otherSpg = await login("081100000006");
    const { file } = (await presign(spg.accessToken)).body;

    await request(app).get(`/api/files/${file.id}`).set(authHeader(spg.accessToken)).expect(409);
    await request(app).post(`/api/files/${file.id}/complete`).set(authHeader((await login("081100000002")).accessToken)).expect(404);

    await prisma.fileObject.update({ where: { id: file.id }, data: { status: "UPLOADED" } });

    const own = await request(app).get(`/api/files/${file.id}`).set(authHeader(spg.accessToken)).expect(200);
    expect(own.body.downloadUrl).toContain("X-Amz-Signature=");

    // Pengguna yang belum ganti sandi pun tidak boleh; SPG lain tidak melihat berkas orang lain.
    await request(app).get(`/api/files/${file.id}`).set(authHeader(otherSpg.accessToken)).expect(403);
    await prisma.user.update({ where: { phone: "6281100000006" }, data: { mustChangePassword: false } });
    await request(app).get(`/api/files/${file.id}`).set(authHeader((await login("081100000006")).accessToken)).expect(404);
    await request(app).get(`/api/files/${file.id}`).set(authHeader((await login("081100000003")).accessToken)).expect(404);

    await request(app).get(`/api/files/${file.id}`).set(authHeader((await login("081100000002")).accessToken)).expect(200);
    await request(app).get(`/api/files/${file.id}`).set(authHeader((await login("081100000001")).accessToken)).expect(200);
  });
});
