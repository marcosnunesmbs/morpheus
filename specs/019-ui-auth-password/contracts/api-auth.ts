export interface AuthErrorResponse {
  error: "Unauthorized";
  message: "Invalid or missing X-Architect-Pass header.";
}

export const AUTH_HEADER = "X-Architect-Pass";