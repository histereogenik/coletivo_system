export const extractErrorMessage = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: unknown } })?.response?.data;

  // Top-level string or array of strings
  if (typeof detail === "string") {
    const normalized = detail.trim().toLowerCase();
    if (normalized.startsWith("<!doctype") || normalized.startsWith("<html")) return fallback;
    return detail;
  }
  if (Array.isArray(detail)) {
    const msgs = detail.filter((v): v is string => typeof v === "string");
    if (msgs.length) return msgs.join(" ");
  }

  if (detail && typeof detail === "object") {
    // DRF-style {"detail": "..."}
    if ("detail" in detail && typeof (detail as { detail?: unknown }).detail === "string") {
      return (detail as { detail: string }).detail;
    }

    // Collect field-level and nested serializer errors.
    const parts: string[] = [];
    const collectMessages = (value: unknown) => {
      if (typeof value === "string") {
        parts.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(collectMessages);
      } else if (value && typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(collectMessages);
      }
    };
    Object.values(detail as Record<string, unknown>).forEach(collectMessages);
    if (parts.length) return parts.join(" ");

    try {
      return JSON.stringify(detail);
    } catch {
      /* ignore */
    }
  }

  return fallback;
};
