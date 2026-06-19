export interface WilayahItem {
  code: string;
  name: string;
}

interface WilayahResponse {
  data: WilayahItem[];
}

async function getWilayahData(path: string): Promise<WilayahItem[]> {
  const response = await fetch(`/wilayah-api/${path}`);

  if (!response.ok) {
    throw new Error('Gagal memuat data wilayah');
  }

  const payload = (await response.json()) as WilayahResponse;
  return (payload.data || []).map((item) => ({
    code: item.code,
    name: item.name.trim(),
  }));
}

export const wilayahApi = {
  getProvinces: () => getWilayahData('provinces'),
  getRegencies: (provinceCode: string) => getWilayahData(`regencies/${provinceCode}`),
};
