# ADR 0011: Messaging, calls inside the app and notifications (Release 1 step 5, part 3)

Status: accepted. Merged in pull request #49 on 10 November 2026.

## Context

Part 3 of step 5 (ADR 0009) lets a tenant and a lister talk. It follows:
- Product Specification Sections 4.2 (alerts for saved areas) and 6.1 (contact);
- decision 44 (voice calls inside the app, phone numbers hidden), decision 46 (notifications by push, email and
  SMS, chosen per kind) and decision 47 (the live connection).

## Decisions on how it is built

### Chat

- **Who talks to whom.** A conversation is between a tenant and the person who created the listing (the landlord,
  or the agent with authority). There is one conversation per tenant per listing; starting it again reopens it.
- **Who may start.** Starting needs verification level 2 and a live listing, and nobody can message their own
  listing. An existing conversation stays usable after the listing is rented or closed.
- **Unread counts** are worked out from when each side last opened the conversation. Opening the newest page of
  messages marks it read, and the other side is told through the live connection.
- **Automatic monitoring** (switch `trust.chat_monitoring`). Each message is checked for phone numbers (also
  spelt out in words), bank details, email addresses and wording that moves the deal off the platform. The message
  is still sent. The sender sees a warning, the finding is stored with the message and written to the audit log
  (`chat.flagged`) for the trust team. Nothing is blocked automatically.
- **Sharing phone numbers** (switch `contact.phone_reveal`). Allowed once the tenant has an inspection of the
  listing that is requested, confirmed or completed. Each side agrees separately; the numbers appear only when both
  have agreed, and that moment is written to the audit log.
- **Blocking** (decision 88; switch `contact.blocking`). Either person in a conversation can block the other
  (`POST /conversations/{id}/block`). Blocks are kept in their own table (`UserBlock`) with when they were made and
  undone, so the history is never lost. While a block stands, neither can message, call or book an inspection with
  the other (403 `BLOCKED`), whichever side blocked; inspections booked between them are cancelled with the reason
  `BLOCKED` and both are told the inspection was cancelled. The person who blocked sees `block: BLOCKED_BY_YOU`;
  the blocked person sees only `CANNOT_REPLY` and is never told why. Ticking "Also report" opens a report task for
  the trust team in the same step. When `verification.blocksForReview` different people have blocked the same
  person, a review task is opened (one at a time). Every block and unblock is written to the audit log.
- **Deleted accounts** (decision 87). The other person's conversations stay readable, shown as "Deleted account",
  with no name or phone and `canSend` false.

### Calls inside the app (decision 44)

- **The calling service is behind an adapter** (`server/src/integrations/calls`). The server only sets a call up,
  hands each app the short-lived values it needs to join, and closes the call. The voice runs between the apps and
  the calling service, so no phone number is involved. Development uses a test adapter that carries no voice; the
  real service is chosen when its account is opened (`CALL_PROVIDER`).
- **Rules.** Calls are between the two sides of a conversation, need level 2 and the switch
  `contact.in_app_call`. One call at a time per conversation. Only the person being called can answer or decline.
- **Ringing.** The other side is told through the live connection and by an urgent push notification, so the
  phone rings when the app is closed. If the call rings on two devices, only the first answer counts.
- **Missed calls.** A job runs every minute and marks calls that rang for more than 60 seconds as missed.
- **Every call leaves a line in the chat** (answered with its length, missed or declined), as in the approved
  designs.

### The live connection (decision 47)

- **A WebSocket at `/v1/live`.** (Side note: a WebSocket is a connection the app keeps open so the server can send
  to it at any moment.) The app sends its access token as the first message; a connection that does not sign in
  within 10 seconds is closed.
- **Several servers.** An event is published on Redis and every server passes it to the connections it holds. If
  Redis cannot be reached, a server still delivers to its own connections, and the push notification covers the rest.
- **Signing out.** Every 30 seconds each server checks, in one query, that the devices connected to it are still
  signed in and their accounts active, and closes the others.
- **Events:** `message.created`, `conversation.read`, `call.ringing`, `call.answered`, `call.ended` and
  `notification`. `inspection.updated` comes with part 4.

### Notifications (decision 46)

- **Kinds:** new message, incoming call, inspection update, saved search alert, listing update, verification
  update and reminder. Security messages (codes and sign-in alerts) are separate and cannot be switched off.
- **Channels per kind,** chosen by the user: push, email and SMS. The defaults use no SMS, because each SMS costs
  money: messages and calls come by push; the rest by push and email. Incoming calls can only use push.
- **Push goes through an adapter** (`server/src/integrations/push`). Development uses an adapter that writes to the
  server log; Firebase Cloud Messaging gets its own adapter when the Google Cloud account is opened
  (`PUSH_PROVIDER`).
- **Devices.** Each app registers its push address (at most 20 per user). Signing out removes that device's
  address, and addresses the push service reports as dead are removed.
- **Email and SMS go only to confirmed contacts.** A notification that cannot be delivered is logged and never
  fails the action that caused it.
- **Sent so far:** new messages, incoming and missed calls, a listing going live or being sent back by the review
  team, and saved area alerts.

### Alerts for saved areas (Specification 4.2)

When the review team approves a listing, every user with alerts on, whose saved area covers the listing's true
position and whose saved filters match it, is notified. Each user is told once, however many of their saved areas
match. The listing's exact position is used for the match but never sent.

## Not in this part

- Real push and calling adapters: after the accounts are opened.
- Notifications for inspections and verification results: with the parts that produce them.
- Reporting a conversation on its own (without blocking): with the report screens.
