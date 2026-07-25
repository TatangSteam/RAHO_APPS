import { extractCollectionRows } from './stockReservationPresentation';

describe('extractCollectionRows', () => {
  const rows = [{ id: 'REQ-1' }];

  it('accepts a direct array', () => {
    expect(extractCollectionRows(rows)).toEqual(rows);
  });

  it('accepts a standard API envelope', () => {
    expect(extractCollectionRows({ data: rows })).toEqual(rows);
  });

  it('accepts a paginated API envelope', () => {
    expect(extractCollectionRows({ data: { data: rows, meta: { total: 1 } } })).toEqual(rows);
  });

  it.each([undefined, null, {}, { data: {} }])(
    'returns an empty array for an invalid collection (%p)',
    (payload) => {
      expect(extractCollectionRows(payload)).toEqual([]);
    }
  );
});
