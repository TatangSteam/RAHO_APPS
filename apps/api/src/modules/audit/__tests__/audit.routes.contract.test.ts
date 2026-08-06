import auditRouter from '../audit.routes';

describe('audit log API immutability contract', () => {
  it('exposes read/export endpoints only', () => {
    const routes = auditRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const route = layer.route as unknown as {
          path: string;
          methods: Record<string, boolean>;
        };
        return {
          path: route.path,
          methods: Object.keys(route.methods).sort(),
        };
      });

    expect(routes).toEqual([
      { path: '/', methods: ['get'] },
      { path: '/export', methods: ['get'] },
      { path: '/stats', methods: ['get'] },
      { path: '/:id', methods: ['get'] },
    ]);
  });
});
