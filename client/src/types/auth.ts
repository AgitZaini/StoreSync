export type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEAM_LEADER" | "SPG" | "KASIR";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type MeResponse = {
  user: AuthUser;
};
