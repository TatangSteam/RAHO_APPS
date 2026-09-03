import { assignPackageSchema, editPackageSchema } from '../packages.schema';

describe('editPackageSchema', () => {
  it('normalizes nullable legacy package selectors', () => {
    const result = editPackageSchema.parse({
      packages: [
        {
          pricingId: 'pricing-basic-15',
          quantity: 1,
          boosterType: null,
          serviceType: 'PM',
        },
      ],
    });

    expect(result.packages).toEqual([
      {
        pricingId: 'pricing-basic-15',
        quantity: 1,
        boosterType: undefined,
        serviceType: 'PM',
      },
    ]);
  });

  it('accepts legacy and custom catalog codes during edit', () => {
    const result = editPackageSchema.parse({
      packages: [
        {
          pricingId: 'pricing-legacy',
          quantity: 1,
          boosterType: 'CUSTOM_BOOSTER',
          serviceType: 'HC',
        },
      ],
    });

    expect(result.packages[0]).toMatchObject({
      boosterType: 'CUSTOM_BOOSTER',
      serviceType: 'HC',
    });
  });
});

describe('assignPackageSchema service type master support', () => {
  it('accepts a custom service-type code from the master', () => {
    const result = assignPackageSchema.parse({
      packages: [{
        pricingId: 'pricing-custom',
        quantity: 1,
        boosterType: 'NO',
        serviceType: 'CUSTOM-HC',
      }],
      addOns: [],
    });

    expect(result.packages[0].serviceType).toBe('CUSTOM-HC');
  });

  it('rejects an empty service-type code', () => {
    expect(() => assignPackageSchema.parse({
      packages: [{ pricingId: 'pricing-custom', quantity: 1, serviceType: ' ' }],
      addOns: [],
    })).toThrow();
  });
});

describe('assignPackageSchema standalone add-on attribution', () => {
  const addOn = {
    type: 'AIR_NANO' as const,
    code: 'PRD-ANN-KNG-001',
    name: 'Air Nano Kuning 600ml 1 Botol',
    price: 15_000,
    quantity: 1,
  };

  it('requires transaction date and seller MSO for a standalone add-on', () => {
    const result = assignPackageSchema.safeParse({
      packages: [],
      addOns: [addOn],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['transactionDate'] }),
      expect.objectContaining({ path: ['sellerMsoId'] }),
    ]));
  });

  it('accepts complete attribution for a standalone add-on', () => {
    const result = assignPackageSchema.parse({
      packages: [],
      addOns: [addOn],
      transactionDate: '2026-09-03',
      sellerMsoId: 'mso-1',
    });

    expect(result).toMatchObject({
      transactionDate: '2026-09-03',
      sellerMsoId: 'mso-1',
    });
  });
});
