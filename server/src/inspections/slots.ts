import { z } from 'zod';

/** The times a lister is available (decision 45): weekly windows in the country's time zone, cut into equal slots. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times are written as HH:MM');
export const availabilitySchema = z
  .object({
    slotMinutes: z.number().int().min(15).max(120).default(30),
    weekly: z
      .array(
        z
          .object({ weekday: z.number().int().min(1).max(7), from: hhmm, to: hhmm })
          .strict()
          .refine((w) => w.from < w.to, { message: 'from must be before to' }),
      )
      .max(28),
    blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates are written as YYYY-MM-DD')).max(366).default([]),
  })
  .strict();
export type Availability = z.infer<typeof availabilitySchema>;

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

/** Minutes the time zone is ahead of UTC at a moment. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The moment a local date and time happen in a time zone. */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60_000);
  // Checked a second time, for days when the clocks change.
  return new Date(guess - offsetMinutes(first, timeZone) * 60_000);
}

/** The local date (YYYY-MM-DD) of a moment in a time zone. */
export function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 1 for Monday to 7 for Sunday. */
function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/**
 * The free slots between two local dates (both included): every slot of the weekly windows that is not on a blocked
 * date, starts after `notBefore`, and is not already taken.
 */
export function freeSlots(a: Availability, from: string, to: string, timeZone: string, notBefore: Date, taken: Date[]): Slot[] {
  const blocked = new Set(a.blockedDates);
  const busy = new Set(taken.map((t) => t.getTime()));
  const seen = new Set<number>();
  const slots: Slot[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (blocked.has(date)) continue;
    for (const w of a.weekly.filter((x) => x.weekday === weekday(date))) {
      const end = zonedTime(date, w.to, timeZone).getTime();
      for (let t = zonedTime(date, w.from, timeZone).getTime(); t + a.slotMinutes * 60_000 <= end; t += a.slotMinutes * 60_000) {
        if (t < notBefore.getTime() || busy.has(t) || seen.has(t)) continue;
        seen.add(t);
        slots.push({ startsAt: new Date(t), endsAt: new Date(t + a.slotMinutes * 60_000) });
      }
    }
  }
  return slots.sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
}
