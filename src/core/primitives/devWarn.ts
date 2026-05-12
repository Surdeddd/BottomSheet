export function devWarn(...args: unknown[]): void {
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV !== "production" &&
    typeof console !== "undefined"
  ) {
    console.warn(...args);
  }
}
