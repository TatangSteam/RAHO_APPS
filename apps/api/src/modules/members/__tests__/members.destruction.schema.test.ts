import { destroyMemberSchema } from '../members.schema';

describe('Destruction Member confirmation schema', () => {
  it('requires the exact destructive phrase and a member number', () => {
    expect(destroyMemberSchema.parse({
      confirmation: 'DESTRUCTION MEMBER',
      memberNo: 'RAHO-0001',
    })).toEqual({ confirmation: 'DESTRUCTION MEMBER', memberNo: 'RAHO-0001' });

    expect(() => destroyMemberSchema.parse({
      confirmation: 'DELETE',
      memberNo: 'RAHO-0001',
    })).toThrow();
  });
});
