import { cookies } from "next/headers";

const messages: Record<string, string> = {
  google: "Google sign-in did not complete. Please try again.",
  server_oauth_config_missing: "Google sign-in is not configured correctly on the website.",
  google_callback_missing_code_or_state: "Google did not return a complete sign-in response. Please try again.",
  oauth_cookie_missing: "Your sign-in session was lost. Allow cookies for this site and try again.",
  oauth_cookie_invalid: "Your sign-in session was invalid. Please try again.",
  oauth_state_mismatch: "Your sign-in session did not match. Allow cookies for this site and try again.",
  google_token_endpoint_unreachable: "The website could not contact Google to finish sign-in. Please try again later.",
  google_code_exchange_rejected: "Google rejected the sign-in request. Check the website OAuth client settings.",
  google_id_token_verification_unavailable: "The website could not verify your Google sign-in. Please try again later.",
  google_id_token_invalid_or_client_id_mismatch: "Google sign-in could not be verified. Check that the website uses the matching OAuth client ID.",
  google_sign_in_cancelled_or_rejected: "Google sign-in was cancelled or rejected. Please try again.",
  mobile_pair_session_expired_or_claimed: "The mobile connection request expired. Start connecting again from the app.",
  mobile_pair_result_save_failed: "Google sign-in succeeded, but the mobile connection could not be saved. Try connecting again.",
  mobile_pair_device_creation_failed: "Google sign-in succeeded, but the mobile device could not be connected. Please try again.",
};

export async function AuthNotice() {
  const code = (await cookies()).get("auth_notice")?.value;
  const message = code ? messages[code] : undefined;

  if (!message) return null;

  return (
    <p
      role="alert"
      className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600"
    >
      {message}
    </p>
  );
}
