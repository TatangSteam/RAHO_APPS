export type MappingReviewContinuation = 'BLOCK' | 'CREATE' | 'SEARCH';

/**
 * A rejected candidate is an explicit human decision that the remote entity is
 * different. Re-running candidate discovery would recreate the same review and
 * make the Reject action impossible to complete.
 */
export function mappingReviewContinuation(
  status: string | null | undefined,
): MappingReviewContinuation {
  if (status === 'PENDING') return 'BLOCK';
  if (status === 'REJECTED') return 'CREATE';
  return 'SEARCH';
}
