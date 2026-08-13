import { mappingReviewContinuation } from '../zoho.review.policy';

describe('Zoho mapping review continuation', () => {
  it('blocks while a human decision is still pending', () => {
    expect(mappingReviewContinuation('PENDING')).toBe('BLOCK');
  });

  it('creates a distinct entity after all candidates are rejected', () => {
    expect(mappingReviewContinuation('REJECTED')).toBe('CREATE');
  });

  it('searches normally when no review decision exists', () => {
    expect(mappingReviewContinuation(null)).toBe('SEARCH');
    expect(mappingReviewContinuation(undefined)).toBe('SEARCH');
    expect(mappingReviewContinuation('APPROVED')).toBe('SEARCH');
  });
});
