import { conversionPreviewSchema, createUomSchema } from '../../inventory-master.schema';
import { UnitConversionService } from '../unit-conversion.service';

describe('UOM precision and conversion preview', () => {
  it('accepts the UAT VIAL and BOX precision configuration', () => {
    expect(createUomSchema.parse({
      code: 'VIAL',
      name: 'Vial',
      category: 'PACKAGING',
      precision: 4,
    }).precision).toBe(4);

    expect(createUomSchema.parse({
      code: 'BOX',
      name: 'Box',
      category: 'PACKAGING',
      precision: 0,
    }).precision).toBe(0);
  });

  it('previews 2 BOX as 20 VIAL without floating-point conversion', () => {
    const input = conversionPreviewSchema.parse({
      quantity: '2',
      factor: '10',
      direction: 'BASE_TO_USAGE',
    });

    expect(UnitConversionService.preview(input)).toEqual({
      quantity: '2',
      factor: '10',
      direction: 'BASE_TO_USAGE',
      result: '20',
    });
  });

  it('previews 15 VIAL as 1.5 BOX', () => {
    const input = conversionPreviewSchema.parse({
      quantity: '15',
      factor: '10',
      direction: 'USAGE_TO_BASE',
    });

    expect(UnitConversionService.preview(input).result).toBe('1.5');
  });

  it.each(['0', '-1', '0.0000001'])('rejects invalid factor %s', (factor) => {
    expect(() => conversionPreviewSchema.parse({
      quantity: '2',
      factor,
      direction: 'BASE_TO_USAGE',
    })).toThrow('Nilai harus lebih besar dari nol, maksimal 12 digit utuh dan 6 angka desimal');
  });

  it('rejects a factor that exceeds Decimal(18,6) storage capacity', () => {
    expect(() => conversionPreviewSchema.parse({
      quantity: '2',
      factor: '1234567890123',
      direction: 'BASE_TO_USAGE',
    })).toThrow('maksimal 12 digit utuh');
  });

  it.each([-1, 7, 1.5])('rejects invalid UOM precision %s', (precision) => {
    expect(() => createUomSchema.parse({
      code: 'TEST',
      name: 'Test',
      precision,
    })).toThrow();
  });
});
