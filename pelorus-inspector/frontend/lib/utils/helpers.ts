/**
 * Generic helper utilities.
 */

/**
 * Deep clone an object using JSON serialization.
 * Safe for plain objects without circular references.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a CustomEvent with standard bubbling options.
 * Useful for component-to-parent communication.
 */
export function createEvent<T>(name: string, detail: T): CustomEvent<T> {
  return new CustomEvent(name, {
    detail,
    bubbles: true,
    composed: true,
  });
}
