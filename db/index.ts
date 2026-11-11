// In-memory mock or Cloudflare D1 integration if available
let db: any;

const noOp: any = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
  select: () => ({
    from: () => ({
      orderBy: () => ({
        limit: async () => [],
      }),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: async () => [{}],
    }),
  }),
};

db = new Proxy(noOp, {
  get: (_, prop) =>
    prop === "query"
      ? new Proxy({}, { get: () => noOp })
      : prop in noOp
      ? noOp[prop]
      : async () => [],
});

export function getDb() {
  return db;
}

export { db };
