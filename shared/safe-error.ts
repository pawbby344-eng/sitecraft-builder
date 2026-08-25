const SAFE_ERROR_MESSAGE = "Something went wrong. Please reload the page and try again.";

/**
 * Converts an internal render error into a stable, user-safe message.
 * The original error remains available to the boundary instance for internal diagnostics only.
 */
export function getSafeErrorMessage(_error: unknown): string {
  return SAFE_ERROR_MESSAGE;
}

export { SAFE_ERROR_MESSAGE };
