import { approximateLocation, roundedDistance } from './approximate.js';

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

describe('approximate location', () => {
  const home = { lat: 6.3912, lng: 5.6198 };

  it('moves the pin by 40% to 100% of the distance, the same way every time', () => {
    for (const id of ['a', 'b', 'c', 'd', '0199a5e2-0000-7000-8000-000000000001']) {
      const p = approximateLocation(id, home, 300);
      const d = metresBetween(home, p);
      expect(d).toBeGreaterThanOrEqual(119);
      expect(d).toBeLessThanOrEqual(301);
      expect(approximateLocation(id, home, 300)).toEqual(p);
    }
  });

  it('gives different listings different directions', () => {
    const a = approximateLocation('listing-1', home, 300);
    const b = approximateLocation('listing-2', home, 300);
    expect(a).not.toEqual(b);
  });

  it('rounds distances to 100 metres, never below 100', () => {
    expect(roundedDistance(12)).toBe(100);
    expect(roundedDistance(1249)).toBe(1200);
    expect(roundedDistance(1251)).toBe(1300);
  });
});
