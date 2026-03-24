export type Bindings = {
  DATABASE_URL: string;
  ADMIN_KEY: string;
  FRONTEND_URL: string;
};

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  token: string;
};

export type Variables = {
  user: AuthUser;
  db: import("./db/client").Database;
};
