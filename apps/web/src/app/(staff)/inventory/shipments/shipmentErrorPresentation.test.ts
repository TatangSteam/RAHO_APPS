import { getShipmentApiErrorMessage } from './shipmentErrorPresentation';

describe('getShipmentApiErrorMessage', () => {
  it('shows the nested backend error used by the common API error envelope', () => {
    expect(getShipmentApiErrorMessage({
      response: {
        data: {
          error: {
            message: 'Branch tujuan belum memiliki stock location aktif.',
          },
        },
      },
    }, 'Gagal menerima pengiriman')).toBe(
      'Branch tujuan belum memiliki stock location aktif.',
    );
  });

  it('supports a direct response message', () => {
    expect(getShipmentApiErrorMessage({
      response: { data: { message: 'Tidak ada periode akuntansi.' } },
    }, 'Fallback')).toBe('Tidak ada periode akuntansi.');
  });

  it('uses the fallback for an unknown error', () => {
    expect(getShipmentApiErrorMessage(new Error('network'), 'Fallback')).toBe('Fallback');
  });
});
