import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('preserves domain styling without shared visual classes in unstyled mode', () => {
    render(
      <Button unstyled className="package-action-button">
        Simpan
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Simpan' });
    expect(button).toHaveClass('package-action-button');
    expect(button).not.toHaveClass('inline-flex');
    expect(button).not.toHaveClass('rounded-xl');
  });

  it('keeps loading buttons disabled and exposes loading text', () => {
    render(
      <Button loading loadingText="Menyimpan">
        Simpan
      </Button>,
    );

    expect(screen.getByRole('button', { name: /Menyimpan/i })).toBeDisabled();
  });
});
