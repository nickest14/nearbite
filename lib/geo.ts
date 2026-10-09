// 距離計算與顯示格式。資料量每次最多 20 筆，在應用層算就夠，不用 PostGIS（design D4）。

export type LatLng = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Haversine 公式：兩點間的大圓距離（公尺）。在幾公里的尺度下誤差遠小於 1%
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// 1 公里內以公尺顯示（350 m），以上以公里顯示到小數一位（1.2 km）
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

// 依與中心的距離由近到遠排序；距離相同時維持原本順序（Array.prototype.sort 是穩定的）
export function sortByDistance<T extends LatLng>(
  items: readonly T[],
  center: LatLng,
): Array<T & { distanceMeters: number }> {
  return items
    .map((item) => ({ ...item, distanceMeters: haversineMeters(center, item) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
