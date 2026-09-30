import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, jest } from "@jest/globals";

process.env.NODE_ENV = "test";
// Selalu memakai database test, walaupun DATABASE_URL di shell menunjuk ke database lain.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://storesync:storesync_dev@localhost:5432/storesync_test?schema=public";
process.env.JWT_ACCESS_SECRET = "storesync-test-access-secret-please-change";
process.env.JWT_REFRESH_SECRET = "storesync-test-refresh-secret-please-change";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.SESSION_IDLE_MINUTES = "45";
// Presign dihitung offline; test yang butuh isi bucket me-mock `storage.headObject`.
process.env.S3_ENDPOINT = "http://localhost:9100";
process.env.S3_BUCKET = "storesync-test";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_FORCE_PATH_STYLE = "true";

jest.setTimeout(30000);

// Supertest bawaan membuka server per request dengan `listen(0)` (semua antarmuka, "::") lalu menghubungi
// 127.0.0.1:<port>. Di macOS port acak itu bisa sudah dipegang aplikasi lain di 127.0.0.1 (VS Code, Postman,
// dsb.) sehingga request sesekali nyasar ke aplikasi tersebut (404/login gagal acak). Karena itu setiap file
// test memakai satu server yang di-bind langsung ke 127.0.0.1, dan supertest diarahkan ke sana.
let testServer: http.Server | null = null;

beforeAll(async () => {
  // Dimuat setelah env di atas terpasang, dari registry modul yang sama dengan file test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require("../src/app") as typeof import("../src/app");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  testServer = server;
});

afterAll(async () => {
  const server = testServer;
  testServer = null;
  if (server) await new Promise((resolve) => server.close(resolve));
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SupertestTest = require("supertest/lib/test") as { prototype: { serverAddress: (app: unknown, path: string) => string } };
SupertestTest.prototype.serverAddress = function serverAddress(_app: unknown, path: string) {
  if (!testServer) throw new Error("Server test belum siap");
  return `http://127.0.0.1:${(testServer.address() as AddressInfo).port}${path}`;
};
