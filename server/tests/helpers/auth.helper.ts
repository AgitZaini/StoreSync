import request from "supertest";
import { app } from "../../src/app";
import { TEST_PASSWORD } from "./db.helper";

export type Session = {
  user: { id: string; name: string; phone: string; role: string; mustChangePassword: boolean };
  accessToken: string;
  refreshToken: string;
};

export const login = async (phone: string, password = TEST_PASSWORD) => {
  const response = await request(app).post("/api/auth/login").send({ phone, password }).expect(200);
  return response.body as Session;
};

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});
