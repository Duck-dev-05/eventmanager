export type ForgotPasswordState =
  | {
      error?: string;
      success?: string;
      /** Only populated outside production when no email transport is configured. */
      devLink?: string;
    }
  | undefined;

export type ResetPasswordState =
  | {
      error?: string;
      success?: string;
    }
  | undefined;
