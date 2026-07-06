import { createMemberSchema, memberUsernameSchema } from '../members.schema';

describe('member username validation', () => {
  it('normalizes usernames to lowercase during member creation', () => {
    const input = createMemberSchema.parse({
      fullName: 'Member Test',
      birthDate: '1990-01-15',
      phone: '081234567890',
      memberUsername: ' Member.Test_01 ',
      memberPassword: 'password123',
    });

    expect(input.memberUsername).toBe('member.test_01');
  });

  it('rejects email addresses and whitespace as usernames', () => {
    expect(memberUsernameSchema.safeParse('member@example.com').success).toBe(false);
    expect(memberUsernameSchema.safeParse('member test').success).toBe(false);
  });

  it('requires a birth date when creating a member', () => {
    const result = createMemberSchema.safeParse({
      fullName: 'Member Test',
      phone: '081234567890',
      memberUsername: 'member.test',
      memberPassword: 'password123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['birthDate'] }),
        ]),
      );
    }
  });
});
