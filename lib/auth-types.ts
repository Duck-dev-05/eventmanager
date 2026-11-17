export type AuthState =
  | {
      error?: string;
      values?: { name?: string; email?: string };
    }
  | undefined;
