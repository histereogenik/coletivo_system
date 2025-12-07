export const extractErrorMessage = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: unknown } })?.response?.data;

  // Top-level string or array of strings
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.filter((v): v is string => typeof v === "string");
    if (msgs.length) return msgs.join(" ");
  }

  if (detail && typeof detail === "object") {
    // DRF-style {"detail": "..."}
    if ("detail" in detail && typeof (detail as { detail?: unknown }).detail === "string") {
      return (detail as { detail: string }).detail;
    }

    // Collect field-level errors (strings or arrays of strings)
    const parts: string[] = [];
    Object.values(detail as Record<string, unknown>).forEach((val) => {
      if (typeof val === "string") parts.push(val);
      else if (Array.isArray(val)) {
        const inner = val.filter((v): v is string => typeof v === "string");
        if (inner.length) parts.push(inner.join(" "));
      }
    });
    if (parts.length) return parts.join(" ");

    try {
      return JSON.stringify(detail);
    } catch {
      /* ignore */
    }
  }

  return fallback;
};
