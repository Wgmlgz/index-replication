export const getApiErrorMessage = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return null;
  }

  const error = (value as { error?: unknown }).error;
  if (typeof error !== "string" || error.length === 0) {
    return null;
  }

  return error;
};
