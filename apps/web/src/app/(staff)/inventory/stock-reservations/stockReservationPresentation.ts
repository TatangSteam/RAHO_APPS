type CollectionEnvelope<T> = {
  data?: T[] | CollectionEnvelope<T>;
};

/**
 * Inventory list endpoints are not all shaped identically yet. Some return
 * `data: []`, while paginated endpoints return `data: { data: [], meta: {} }`.
 * Keep that API inconsistency from leaking into the page render.
 */
export function extractCollectionRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];

  const envelope = payload as CollectionEnvelope<T>;
  if (Array.isArray(envelope.data)) return envelope.data;

  if (envelope.data && typeof envelope.data === 'object') {
    return extractCollectionRows<T>(envelope.data);
  }

  return [];
}
