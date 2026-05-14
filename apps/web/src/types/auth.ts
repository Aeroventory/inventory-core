export type UserRole = "admin" | "planner" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface AuthToken {
  access_token: string;
  token_type: "bearer";
}
