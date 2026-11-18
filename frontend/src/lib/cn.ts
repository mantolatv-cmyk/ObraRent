type ClassValue = string | false | null | undefined | 0;

/** Tiny className joiner (no runtime deps). */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
