import { describe, expect, it } from 'vitest';
import { availabilitySchema, freeSlots, localDate, zonedTime } from './slots.js';

const lagos = 'Africa/Lagos';

describe('inspection slots', () => {
  const a = availabilitySchema.parse({ slotMinutes: 30, weekly: [{ weekday: 1, from: '10:00', to: '12:00' }, { weekday: 3, from: '15:00', to: '16:00' }], blockedDates: ['2026-11-18'] });

  it('turns local times into the right moment, also where clocks change', () => {
    expect(zonedTime('2026-11-16', '10:00', lagos).toISOString()).toBe('2026-11-16T09:00:00.000Z');
    expect(zonedTime('2026-07-01', '10:00', 'Europe/London').toISOString()).toBe('2026-07-01T09:00:00.000Z');
    expect(zonedTime('2026-12-01', '10:00', 'Europe/London').toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(localDate(new Date('2026-11-16T23:30:00Z'), lagos)).toBe('2026-11-17');
  });

  it('cuts the weekly windows into slots, leaving out blocked dates, past times and taken slots', () => {
    // 16 November 2026 is a Monday.
    const slots = freeSlots(a, '2026-11-16', '2026-11-22', lagos, new Date('2026-11-16T09:20:00Z'), [new Date('2026-11-16T10:00:00Z')]);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-11-16T09:30:00.000Z', '2026-11-16T10:30:00.000Z']);
    expect(slots[0]!.endsAt.toISOString()).toBe('2026-11-16T10:00:00.000Z');
  });

  it('refuses windows that end before they start, and unknown fields', () => {
    expect(availabilitySchema.safeParse({ weekly: [{ weekday: 1, from: '12:00', to: '10:00' }] }).success).toBe(false);
    expect(availabilitySchema.safeParse({ weekly: [{ weekday: 8, from: '10:00', to: '12:00' }] }).success).toBe(false);
    expect(availabilitySchema.safeParse({ weekly: [], extra: 1 }).success).toBe(false);
  });
});
