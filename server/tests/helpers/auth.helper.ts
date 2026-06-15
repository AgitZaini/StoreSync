import request from "supertest";
import { app } from "../../src/app";

export const login = async (email: string, password = "Password123!") => {
  const response = await request(app).post("/api/auth/login").send({ email, password }).expect(200);

  return response.body as {
    user: { id: string; email: string; role: "OWNER" | "SUPERVISOR" | "SALES" };
    accessToken: string;
    refreshToken: string;
  };
};

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});
