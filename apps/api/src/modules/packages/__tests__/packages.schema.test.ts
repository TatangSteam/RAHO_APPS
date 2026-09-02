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
