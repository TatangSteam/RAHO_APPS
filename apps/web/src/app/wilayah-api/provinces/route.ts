import { fetchWilayah } from '../_utils';

// Province data has a checked-in fallback and a revalidated upstream cache.
// Resolve it at request time so production builds never depend on wilayah.id.
export const dynamic = 'force-dynamic';

export async function GET() {
  return fetchWilayah('provinces.json');
}
