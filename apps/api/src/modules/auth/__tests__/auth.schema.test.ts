import { loginSchema } from '../auth.schema';

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
