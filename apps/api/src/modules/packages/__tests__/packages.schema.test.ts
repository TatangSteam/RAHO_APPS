import { editPackageSchema } from '../packages.schema';

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
});
