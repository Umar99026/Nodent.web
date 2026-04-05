export type Bindings = {
  DATABASE_URL: string;
  ADMIN_KEY: string;
  FRONTEND_URL: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_TAB_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEETS_SUBJECT_FROM_TAB?: string;
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
