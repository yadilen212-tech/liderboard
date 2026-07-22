export type ClassValue = string | false | null | undefined;

/** Joins truthy class names with a single space. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
