import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarCell } from './DataTable';

describe('AvatarCell', () => {
  it('falls back to the member initial when a profile photo cannot be displayed', () => {
    render(<AvatarCell name="Maria Damara" avatarUrl="data:image/png;base64,invalid" />);

    fireEvent.error(screen.getByRole('img', { name: 'Maria Damara' }));

    expect(screen.queryByRole('img', { name: 'Maria Damara' })).not.toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });
});
