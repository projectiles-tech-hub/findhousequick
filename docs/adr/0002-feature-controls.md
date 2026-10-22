# ADR 0002: How feature controls decide

- Status: Proposed for Emmanuel's confirmation
- Context: Product Specification, Section 17 (Feature Controls).

## Decision

A feature's state for a request is decided in this order:

1. Only **active** rules inside their **scheduled window** count.
2. Only rules that **match** the request count: its country, region, city, the user's types, or the user.
3. **Emergency rules beat everything.** Used for instant pauses (for example, stopping payments during a fraud attack).
4. Otherwise the **most specific** rule wins: user, then city, then region, then country, then user type, then
   the whole platform. Between equally specific rules, the newest wins.
5. **Gradual release**: if the winning rule switches the feature on for a percentage, each signed-in user gets
   a stable bucket from 0 to 99 (a hash of feature and user), so their result does not change between visits.
   Signed-out users only get the feature at 100%.
6. With no matching rule, the feature's **default** (set in code in `feature-catalogue.ts`) applies.
   Features not yet built default to off.

## Approvals

- **Critical features** (payments, escrow, verification checks, platform-wide registration and listing switches)
  are marked in the catalogue.
- Switching a critical feature **on** creates a rule that waits for approval by a **different** staff member;
  one of the two must be a super admin (the Managing Director or a person he appoints).
- Switching **off** applies at once, so an emergency pause is never delayed by an approval step.
- Withdrawing an "off" rule on a critical feature would switch it back on, so it is not allowed. Staff create an
  "on" rule instead, which goes through approval.
- Country managers can only change rules for their own countries; whole-platform and user-type rules are
  super admin only.
- Every change is written to `ControlChange` with the person, time and reason.

## Enforcement

- The server enforces switches with the `@RequireFeature(...)` guard; a refused request gets
  `403 FEATURE_UNAVAILABLE` with a plain message.
- The apps read all switches from `GET /v1/controls` on start and every few minutes, and hide what is off.
  Hiding in the apps is a convenience only; the server is the authority.
- Switch values are cached in the server for up to 30 seconds, so a change takes effect within half a minute
  (immediately on the server instance where it was made).

## Points for confirmation

- The 30-second delay before a change reaches every server.
- That country managers may switch non-critical features on and off in their countries without a second approval.
