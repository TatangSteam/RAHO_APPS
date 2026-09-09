import { loginSchema, updateOwnFullNameSchema, updateOwnUsernameSchema } from '../auth.schema';

describe('loginSchema', () => {
  it('accepts and normalizes a member username', () => {
    expect(
      loginSchema.parse({ identifier: ' Member.Test ', password: 'secret123' })
    ).toEqual({ identifier: 'member.test', password: 'secret123' });
  });

  it('keeps backward compatibility with the legacy email field', () => {
    expect(
      loginSchema.parse({ email: 'STAFF@RAHO.ID', password: 'secret123' })
    ).toEqual({ identifier: 'STAFF@RAHO.ID', password: 'secret123' });
  });

  it('requires a username or email', () => {
    expect(loginSchema.safeParse({ password: 'secret123' }).success).toBe(false);
  });
});

describe('updateOwnUsernameSchema', () => {
  it('normalizes an email or username to lowercase', () => {
    expect(updateOwnUsernameSchema.parse({ username: ' Afianadaaa18@GMAIL.COM ' })).toEqual({
      username: 'afianadaaa18@gmail.com',
    });
    expect(updateOwnUsernameSchema.parse({ username: ' Jovan.Admin ' })).toEqual({
      username: 'jovan.admin',
    });
  });

  it('rejects spaces and invalid username characters', () => {
    expect(updateOwnUsernameSchema.safeParse({ username: 'nama user' }).success).toBe(false);
    expect(updateOwnUsernameSchema.safeParse({ username: 'ab' }).success).toBe(false);
  });
});

describe('updateOwnFullNameSchema', () => {
  it('trims and accepts a valid full name', () => {
    expect(updateOwnFullNameSchema.parse({ fullName: '  Jovan Prabowo Kuncoro  ' })).toEqual({
      fullName: 'Jovan Prabowo Kuncoro',
    });
  });

  it('rejects names outside the allowed length', () => {
    expect(updateOwnFullNameSchema.safeParse({ fullName: 'J' }).success).toBe(false);
    expect(updateOwnFullNameSchema.safeParse({ fullName: 'A'.repeat(101) }).success).toBe(false);
  });
});
