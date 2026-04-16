const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://34.47.173.239';

export async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getDistricts = () => fetchAPI<{ districts: string[] }>('/districts');
export const getTehsils = (district: string) => fetchAPI<{ tehsils: string[] }>(`/tehsils?district=${encodeURIComponent(district)}`);
export const getVillages = (district: string, tehsil: string) => fetchAPI<{ villages: string[] }>(`/villages?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`);
export const getPolygons = (village: string, district?: string, tehsil?: string) => fetchAPI<any>(`/map/polygons?village=${encodeURIComponent(village)}${district ? '&district=' + encodeURIComponent(district) : ''}${tehsil ? '&tehsil=' + encodeURIComponent(tehsil) : ''}`);
export const lookupKhasra = (khasraNo: string, tehsil: string, village?: string, murabba?: string) => fetchAPI<any>(`/map/lookup?khasra_no=${encodeURIComponent(khasraNo)}&tehsil=${encodeURIComponent(tehsil)}${village ? '&village=' + encodeURIComponent(village) : ''}${murabba ? '&murabba=' + encodeURIComponent(murabba) : ''}`);
export const searchOwner = (name: string) => fetchAPI<any>(`/search/owner?name=${encodeURIComponent(name)}&page_size=20`);
export const getStats = () => fetchAPI<{ counts: Record<string, number> }>('/stats');
