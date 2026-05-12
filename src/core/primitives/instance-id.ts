const counters: Record<string, number> = {};

export function nextInstanceId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}-${counters[prefix]}`;
}
