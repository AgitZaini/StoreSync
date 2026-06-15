import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://storesync:storesync_dev@localhost:5432/storesync_test?schema=public";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "storesync-test-access-secret-please-change";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "storesync-test-refresh-secret-please-change";
process.env.CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";

jest.setTimeout(30000);
