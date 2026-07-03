import { cleanup, render, screen } from '@testing-library/react';
import type { CreateMemberData } from '@/types/member';
import AccountSection from './AccountSection';

jest.mock('@/lib/api/referralsApi', () => ({
  getActiveReferrals: jest.fn().mockResolvedValue({ data: { data: [] } }),
}));

jest.mock('@/lib/logger', () => ({
  devError: jest.fn(),
}));

afterEach(cleanup);

describe('AccountSection', () => {
  it('renders a username login field instead of an email input', async () => {
    const formData = {
      memberUsername: 'member.test',
      memberPassword: 'password123',
      isConsentToPhoto: true,
    } as CreateMemberData;

    render(<AccountSection formData={formData} onChange={jest.fn()} />);

    const usernameInput = await screen.findByRole('textbox', { name: /Username Login/i });
    expect(usernameInput).toHaveAttribute('name', 'memberUsername');
    expect(usernameInput).toHaveAttribute('type', 'text');
    expect(usernameInput).toHaveAttribute('pattern', '[A-Za-z0-9._-]+');
    expect(screen.queryByText('Email Login')).not.toBeInTheDocument();
  });
});
