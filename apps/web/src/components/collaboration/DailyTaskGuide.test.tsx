import { fireEvent, render, screen, within } from '@testing-library/react';
import DailyTaskGuide from './DailyTaskGuide';
import { taskGuideTopics } from './taskGuideContent';

describe('DailyTaskGuide', () => {
  it('starts collapsed and opens the first topic without a selected team', () => {
    render(<DailyTaskGuide />);
    const trigger = screen.getByRole('button', { name: 'Panduan Daily Task' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: taskGuideTopics[0].title })).toBeVisible();
    expect(screen.getByText(/Belum memilih tim/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bagian sebelumnya' })).toBeDisabled();
  });

  it('lets beginners read all ten topics in order and finish reading', () => {
    render(<DailyTaskGuide teamRole="STAFF" />);
    fireEvent.click(screen.getByRole('button', { name: 'Panduan Daily Task' }));
    expect(screen.getByText(/Anda sebagai Staff/)).toBeVisible();
    taskGuideTopics.forEach((topic, index) => {
      expect(screen.getByRole('heading', { name: topic.title })).toBeVisible();
      expect(screen.getByText(`Bagian ${index + 1} dari 10`)).toBeVisible();
      expect(within(screen.getByRole('article')).getAllByRole('listitem')).toHaveLength(topic.steps.length);
      if (index < taskGuideTopics.length - 1) fireEvent.click(screen.getByRole('button', { name: 'Bagian berikutnya' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Selesai membaca' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Panduan Daily Task' })).toHaveFocus();
  });

  it('explains that dashboard totals include subtasks and are not a today-only report', () => {
    render(<DailyTaskGuide teamRole="OWNER" />);
    fireEvent.click(screen.getByRole('button', { name: 'Panduan Daily Task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arti angka dashboard' }));
    expect(screen.getByText(/Saat ini tidak ada filter khusus tanggal hari ini/)).toBeVisible();
    expect(screen.getByText(/Satu tugas utama dengan dua subtask/)).toBeVisible();
    expect(screen.getByText(/Kartu angka bukan tombol filter/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Arti angka dashboard' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: taskGuideTopics[1].title })).toHaveFocus();
  });

  it.each(['OWNER', 'LEADER'] as const)('shows appropriate guidance for %s without changing permissions', (role) => {
    render(<DailyTaskGuide teamRole={role} />);
    fireEvent.click(screen.getByRole('button', { name: 'Panduan Daily Task' }));
    expect(screen.getByText(/bagian 5 membantu membagikan tugas/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa hasil tugas' }));
    expect(screen.getByText(/Form alasan muncul/)).toBeVisible();
    expect(screen.getByText(/Review tidak selalu berhenti menghitung keterlambatan/)).toBeVisible();
  });

  it('supports backward navigation and closes from either close control', () => {
    render(<DailyTaskGuide />);
    fireEvent.click(screen.getByRole('button', { name: 'Panduan Daily Task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bagian berikutnya' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bagian sebelumnya' }));
    expect(screen.getByRole('heading', { name: taskGuideTopics[0].title })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tutup panduan penggunaan' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Panduan Daily Task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tutup panduan' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
