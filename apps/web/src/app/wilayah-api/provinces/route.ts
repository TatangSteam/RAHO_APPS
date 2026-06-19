import { fetchWilayah } from '../_utils';

export async function GET() {
  return fetchWilayah('provinces.json');
}
