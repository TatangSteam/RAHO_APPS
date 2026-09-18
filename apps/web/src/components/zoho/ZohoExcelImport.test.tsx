import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { ZohoExcelImport, suggestImportMapping } from './ZohoExcelImport';

jest.mock('@/lib/api', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
const post = api.post as jest.Mock;
const columns = [{ id: '1', label: 'Nama' }, { id: '2', label: 'Email' }];
const preview = {
  rows: [{ rowNumber: 2, data: { name: 'Budi', email: 'budi@example.test' }, errors: [] as string[] }],
  normalizedRows: [{ rowNumber: 2, name: 'Budi', email: 'budi@example.test' }],
  validCount: 1, errorCount: 0, proof: 'signed-preview',
  organization: { id: 'org-1', name: 'Botanica' }, mode: 'LIVE', readyToQueue: true, message: 'Data siap masuk antrean.',
};
beforeEach(() => jest.resetAllMocks());

async function openPreview(response = preview) {
  post.mockResolvedValueOnce({ data: { data: { sheets: [{ id: 1, name: 'Pelanggan', columns }, { id: 2, name: 'Vendor', columns }] } } });
  fireEvent.change(screen.getByLabelText('File Excel'), { target: { files: [new File(['test'], 'contacts.xlsx')] } });
  fireEvent.click(screen.getByRole('button', { name: 'Baca sheet' }));
  await screen.findByLabelText('Sheet yang akan diimpor');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lihat pratinjau' })).toBeEnabled());
  post.mockResolvedValueOnce({ data: { data: response } });
  fireEvent.click(screen.getByRole('button', { name: 'Lihat pratinjau' }));
  await screen.findByText(/1 baris valid/);
}

describe('Zoho Excel import UI', () => {
  it('restricts import UI to connection managers and never sends requests on render', () => {
    render(<ZohoExcelImport canManage={false} onViewQueue={jest.fn()} />);
    expect(screen.getByText(/hanya dapat dilakukan oleh Super Admin/)).toBeVisible();
    expect(screen.queryByLabelText('File Excel')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('maps recognized Indonesian and English columns without guessing unfamiliar ones', () => {
    expect(suggestImportMapping('customer', { id: 1, name: 'Data', columns })).toEqual({ name: '1', email: '2' });
    expect(suggestImportMapping('item', { id: 1, name: 'Data', columns: [{ id: '1', label: 'Saldo' }] })).toEqual({});
  });

  it('requires preview and explicit confirmation, then reports queued rather than saved', async () => {
    const onViewQueue = jest.fn();
    render(<ZohoExcelImport canManage onViewQueue={onViewQueue} />);
    await openPreview();
    expect(post).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Botanica \(org-1\)/)).toBeVisible();
    const send = screen.getByRole('button', { name: 'Kirim ke antrean Zoho' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    post.mockResolvedValueOnce({ data: { data: { queued: 1, alreadyQueued: 0, events: [] } } });
    fireEvent.click(send);
    await screen.findByText(/1 baris baru masuk antrean/);
    expect(post).toHaveBeenLastCalledWith('/integrations/zoho/excel-import/commit', {
      type: 'customer', rows: preview.normalizedRows, proof: 'signed-preview', confirmed: true,
    });
    expect(screen.getByText(/belum berarti data sudah tersimpan di Zoho/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Kirim ke antrean Zoho' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat antrean impor' }));
    expect(onViewQueue).toHaveBeenCalledTimes(1);
  });

  it('allows inspection in OFF mode but never offers real sending', async () => {
    render(<ZohoExcelImport canManage onViewQueue={jest.fn()} />);
    await openPreview({ ...preview, mode: 'OFF', readyToQueue: false });
    expect(screen.getByText(/Mode OFF/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Kirim ke antrean Zoho' })).not.toBeInTheDocument();
  });

  it('does not offer sending when any row has a validation error', async () => {
    render(<ZohoExcelImport canManage onViewQueue={jest.fn()} />);
    await openPreview({ ...preview, errorCount: 1, rows: [{ ...preview.rows[0], errors: ['Email tidak valid'] }] });
    expect(screen.getByText('Email tidak valid')).toBeVisible();
    expect(screen.getByText(/Tidak ada data yang dikirim/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Kirim ke antrean Zoho' })).not.toBeInTheDocument();
  });

  it('invalidates the preview when sheet, import type or header row changes', async () => {
    render(<ZohoExcelImport canManage onViewQueue={jest.fn()} />);
    await openPreview();
    fireEvent.change(screen.getByLabelText('Sheet yang akan diimpor'), { target: { value: '2' } });
    expect(screen.queryByText(/1 baris valid/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Jenis data'), { target: { value: 'item' } });
    expect(screen.getByLabelText('SKU / kode produk')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lihat pratinjau' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nomor baris judul kolom'), { target: { value: '5' } });
    expect(screen.queryByLabelText('Sheet yang akan diimpor')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });
});
