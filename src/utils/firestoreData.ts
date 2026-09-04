/**
 * Remove valores undefined em qualquer nível antes de enviar objetos ao
 * Firestore. Objetos especiais (Timestamp, FieldValue, Date etc.) são
 * preservados sem alteração.
 */
export function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeFirestoreData(item)) as T;
  }

  if (!value || typeof value !== 'object') return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, sanitizeFirestoreData(item)])
  ) as T;
}
