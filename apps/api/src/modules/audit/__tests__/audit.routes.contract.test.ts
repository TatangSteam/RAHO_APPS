import auditRouter from '../audit.routes';

describe('audit log API immutability contract', () => {
  it('exposes read/export endpoints only', () => {
    const routes = auditRouter.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods).sort(),
      }));

    expect(routes).toEqual([
      { path: '/', methods: ['get'] },
      { path: '/export', methods: ['get'] },
      { path: '/stats', methods: ['get'] },
      { path: '/:id', methods: ['get'] },
    ]);
  });
});
