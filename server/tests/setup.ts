import { jest } from "@jest/globals";

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
