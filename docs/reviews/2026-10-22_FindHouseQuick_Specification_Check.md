**FindHouseQuick**

Specification Check

Projectiles Tech Hub Limited

Emmanuel Chukwuka Oraegbu, Managing Director

22 October 2026. Decisions recorded 23 October 2026.

# **1. About This Check**

On 22 October 2026 we found that the Product Specification requires an email address at registration, but the API design made it optional and the server was built that way. That gap was settled by decisions 35 to 38. This check looks for any other place where what is built or designed differs from what the documents say.

Each finding shows what the specification says, what was built or designed, why it matters, and a suggestion. Emmanuel decided all 21 findings on 23 October 2026: each yellow row records the decision, the date and the number it was recorded under in the Decisions Log (finding n is decision 38 + n).

## **What was compared**

- Product Specification, version 1.3 (all 21 sections).

- Technical Architecture and Execution Plan, version 1.0, including the release plan (Section 2.2), team (Section 3) and Release 0 tasks (Section 15).

- Decisions Log, decisions 1 to 38 and open points 1 to 15.

- The agreed API design (docs/api/openapi.yaml), the database design, the feature switches, the country settings and the starter data.

- The code merged into the main branch up to pull request \#7 (accounts, staff accounts and feature controls).

## **How the decisions are recorded**

- Each decision is in the Decisions Log (decisions 39 to 59), in both the Word and text copies.

- The API design, the status note and the deployment guide were updated to match before any code depends on them.

- Where a decision differs from the suggestion, the yellow row says so.

# **2. Summary**

21 findings, all decided on 23 October 2026: 12 accepted as suggested, 5 accepted with specifics, 2 decided where the suggestion asked for a decision, and 2 decided differently from the suggestion (5 and 6).

| **No.** | **Finding**                                                       | **Priority**                                | **Decision**                            | **Decisions Log** |
|---------|-------------------------------------------------------------------|---------------------------------------------|-----------------------------------------|-------------------|
| 1       | Browsing without an account                                       | High                                        | Accepted, with these specifics          | 39                |
| 2       | Languages at launch                                               | Medium                                      | Accepted, with these specifics          | 40                |
| 3       | Customer support at launch                                        | Medium                                      | Accepted, with these specifics          | 41                |
| 4       | Release 0 is marked complete, but three of its tasks are not done | High                                        | Decided as follows                      | 42                |
| 5       | Field team capturing properties for landlords                     | High                                        | Decided differently from the suggestion | 43                |
| 6       | Calling inside the app                                            | Medium                                      | Decided differently from the suggestion | 44                |
| 7       | Inspection time slots                                             | Low                                         | Accepted as suggested                   | 45                |
| 8       | Notifications                                                     | High                                        | Accepted as suggested                   | 46                |
| 9       | Live updates for chat                                             | Medium                                      | Accepted as suggested                   | 47                |
| 10      | Saved places and travel distance                                  | Low                                         | Accepted as suggested                   | 48                |
| 11      | Identity document at level 2                                      | Medium                                      | Decided as follows                      | 49                |
| 12      | Agent company details                                             | Low                                         | Accepted as suggested                   | 50                |
| 13      | Removing a verified badge, and bans                               | Low                                         | Accepted as suggested                   | 51                |
| 14      | Protection against copying listings in bulk                       | Medium                                      | Accepted as suggested                   | 52                |
| 15      | Maintenance mode and switch warnings                              | Low                                         | Accepted as suggested                   | 53                |
| 16      | Restricted countries                                              | Low                                         | Accepted as suggested                   | 54                |
| 17      | Country settings not yet covered                                  | Medium for data retention; Low for the rest | Accepted, with these specifics          | 55                |
| 18      | Property details and photo checklist                              | Low                                         | Accepted as suggested                   | 56                |
| 19      | Ratings and reviews                                               | Medium for planning                         | Accepted, with these specifics          | 57                |
| 20      | Which automatic checks are in Release 1                           | Medium                                      | Accepted as suggested                   | 58                |
| 21      | Technical points                                                  | Low                                         | Accepted as suggested                   | 59                |

# **3. Where the Documents Disagree**

In these, two of the documents (or a document and the build) say different things, so one of them has to give way.

## **1. Browsing without an account**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>High. Affects search and the property page (Release 1 step 5) and the public website.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 3.1: every user must register to use the platform. Section 3.2: browsing listings and using the map are unlocked at level 1, after registering. Decision 5: everyone registers.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The Technical Architecture (Section 8) plans a public website so that search engines can find and show listing summaries. The API design lets signed-out visitors search and open a property page; only the photo gallery, walkthrough and exact location need sign-in.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Requiring an account before anyone can see a single listing protects the listings and photos best, but people and search engines cannot discover the platform. Public summaries bring visitors but show some information without an account.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Allow signed-out visitors a summary only (cover photo, rent, area, number of rooms and badges) for discovery and search engines. Everything else (gallery, walkthrough, details, contact, saving, alerts) needs an account, as the specification says. If you prefer everything behind registration, the public website shows only the platform's own pages, and the API design is changed to require sign-in for search.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted, with these specifics.</p>
<p>Agreed: Signed-out visitors see a summary of each listing only: cover photo, rent, area, number of rooms and badges. Everything else (photo gallery, walkthrough, details, map position, contact, saving and alerts) needs an account.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 39.</p></td>
</tr>
</tbody>
</table>

## **2. Languages at launch**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Affects the launch date and translation costs.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 18.2 and decision 21: English, Nigerian Pidgin, Yoruba, Igbo, Hausa and French at launch.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The Technical Architecture release plan puts English and Pidgin in Release 1 and the remaining languages in Release 3. The build follows it: Nigeria lists all six languages, but only English and Pidgin are switched on.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Six languages at launch means every screen, message and help page translated and checked four more times before launch.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Launch with English and Pidgin, and switch each other language on as soon as its translation is ready and checked (no new release needed). Or keep six at launch and plan the translation work and budget now.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted, with these specifics.</p>
<p>Agreed: English and Pidgin are switched on at launch. Each user chooses their language in their settings, from the languages switched on for their country. Other languages (Yoruba, Igbo, Hausa, French) are added to that list when their translations are ready and checked.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 40.</p></td>
</tr>
</tbody>
</table>

## **3. Customer support at launch**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Needed before the Release 1 launch.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 18.1: help centre, in-app support chat, a WhatsApp line and a phone line, with every enquiry a ticket with a reference number. The Technical Architecture (Section 3) says the customer support team is needed at the Release 1 launch.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The release plan puts customer support tools in Release 2. Nothing for support is in the Release 1 design.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Users of the Release 1 pilot will need help from the first day, especially with verification.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>At the Release 1 launch: a help page in the app and website, and the WhatsApp and phone lines run by the support team outside the app. In-app support chat and tickets come in Release 2 as planned.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted, with these specifics.</p>
<p>Agreed: At launch: a help page in the app and website, plus WhatsApp and phone lines run by the support team. In-app support chat and tickets come in Release 2.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 41.</p></td>
</tr>
</tbody>
</table>

## **4. Release 0 is marked complete, but three of its tasks are not done**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>High. The records are not accurate.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Technical Architecture, Section 15 (Release 0 tasks) includes: screen designs for tenants, landlords, agents and staff; the test system on the cloud host; and the code structure for the public website.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The status note says Release 0 is complete. None of those three tasks has been done: there are no screen designs, no hosting account (so no test system), and the public website has not been started.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>The app screens cannot be built well without designs, and nothing can be shown on real phones without a test system. The status note should not say these are done.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Correct the status note now (no decision needed; included in this update). Decide when the screen designs are made and by whom (the plan says a part-time designer), and open the hosting account so the test system can be set up.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Decided as follows.</p>
<p>Agreed: There will be no human designer. The screen designs are produced in the build sessions using the Figma connector, as a separate step, for Emmanuel's review and approval before the app screens are built. The hosting account (and so the test system) follows once the company has a dollar card.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 42.</p>
<p>Changed in part on 23 October 2026 by decision 67: the designs are made in Penpot through its connector instead of Figma (Figma needs a paid seat), with Claude's Design artifact type as the fallback.</p></td>
</tr>
</tbody>
</table>

## **5. Field team capturing properties for landlords**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>High. Listings must exist before tenants are invited.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 20 and the Technical Architecture (Sections 3 and 5): before tenants are invited, the field team visits landlords and agents, registers them, and captures their properties on site through the app.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>In the API design, only the landlord or an authorised agent can register a building and create a listing. There is a field officer staff role, but it has no power to capture a property for someone else.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Without this, the field team can only help a landlord use the landlord's own phone, which is slow and depends on the landlord's phone and data.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Let a field officer register the building, add units and take the photos and video on behalf of a landlord who is present. The landlord then confirms it in their own app before it is submitted, and the ownership documents remain the landlord's. Everything the field officer does is recorded.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Decided differently from the suggestion.</p>
<p>Agreed: Landlords do all of their own building registration; the platform does not register properties for them. Field officers only carry out verification checks, because the manpower needed for the platform to register properties itself is not realistic. This replaces field-team property capture in Specification Section 20 and Technical Architecture Sections 3 and 5.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 43.</p></td>
</tr>
</tbody>
</table>

# **4. In the Specification, Missing From the Release 1 Design**

The specification asks for these, but the agreed API design for Release 1 does not include them yet.

## **6. Calling inside the app**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Release 1 messaging (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 7.1: verified tenants can chat with and call landlords and authorised agents within the app; phone numbers stay hidden until an inspection is booked and both sides agree.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The design has chat, and phone numbers shared once an inspection is booked and both sides agree. There is no calling inside the app.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Calls inside the app without showing numbers need a calling service, which costs money per minute.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>For Release 1, read "call" as an ordinary phone call once numbers are shared (no extra cost). Calls inside the app without numbers can be added later if wanted.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Decided differently from the suggestion.</p>
<p>Agreed: Calling inside the app (voice calls over the internet, with phone numbers kept hidden) is part of Release 1.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 44.</p></td>
</tr>
</tbody>
</table>

## **7. Inspection time slots**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. Release 1 inspections (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 7.2: tenants book inspections by choosing a time slot; the landlord or agent confirms.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The design lets the tenant propose any date and time, which the landlord or agent confirms, cancels or moves.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>With published slots, tenants only see times the lister can do. With free proposals, there is more back and forth.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Let landlords and agents set their available times, from which tenants pick a slot, as the specification says. The confirm and reschedule steps stay as designed.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Landlords and agents set the times they are available for inspections; tenants book by choosing one of the free time slots. The lister then confirms or reschedules as designed.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 45.</p></td>
</tr>
</tbody>
</table>

## **8. Notifications**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>High. Needed by chat, inspections, alerts and email (decisions 35 to 38).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 4.2: alerts when a matching property is listed. Sections 7 and 11: messages, inspection confirmations and rent reminders. The Technical Architecture (Sections 8 and 9.2) plans push notifications through Firebase, SMS, and notification settings.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The design has no way for the app to register a phone for push notifications, no notification settings, and no choice of channel (push, SMS or email).</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Without notifications, users only see messages, confirmations and alerts if they open the app and look.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add to the Release 1 design: registering a phone for push notifications, and settings for which notifications each user receives and by which channel (push, email, SMS). Security messages (codes, sign-in alerts) cannot be switched off.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Release 1 includes push notifications (each phone registered for them) and notification settings for each user: which notifications they receive and by which channel (push, email or SMS). Security messages (codes and sign-in alerts) cannot be switched off.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 46.</p></td>
</tr>
</tbody>
</table>

## **9. Live updates for chat**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Release 1 chat (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 1.4: a change made on one platform appears on the others immediately. The Technical Architecture (Section 9.1) plans a live connection (WebSockets) for chat and status updates.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The design has only ordinary requests, so the app would have to keep asking the server for new messages.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Without a live connection, chat feels slow and the app uses more data and battery.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add the live connection to the Release 1 design, for chat messages and inspection status, with push notifications (finding 8) when the app is closed.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Release 1 includes a live connection for chat messages and inspection status, with push notifications when the app is closed.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 47.</p></td>
</tr>
</tbody>
</table>

## **10. Saved places and travel distance**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 5.4: the property page shows the travel distance to places the tenant has saved, such as an office or school. Section 15.2: a tenant's location is not stored unless they choose to save a place.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Saved places are not in the design.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Travel distance to work or school is one of the first things tenants ask about.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add saved places (name and location, chosen by the tenant) and travel distance on the property page, in Release 1 step 5 or later in Release 1.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Tenants can save places of their choosing (a name and a location, such as an office or school), and the property page shows the travel distance to them. Built in Release 1 step 5 or later in Release 1.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 48.</p></td>
</tr>
</tbody>
</table>

## **11. Identity document at level 2**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Release 1 step 3 (identity checks).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Sections 3.2 to 3.4: level 2 needs the NIN, a selfie with a liveness check, and an identity document.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The identity check design takes the ID type and number (for example the NIN), with the provider's selfie and liveness check. It does not take a photo of an identity document.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Identity providers can check a NIN against the government record without a document photo. Asking for a document as well is stronger but adds a step and cost.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Decide whether level 2 needs a document photo in addition to the NIN check. This goes with open point 14 (which documents are accepted besides NIN).</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Decided as follows.</p>
<p>Agreed: No document photo is asked for by default at level 2. A document photo is asked for only when the NIN check fails or the details do not match. Accepted documents: driver's licence, international passport and NIN slip. (Settles open point 14.)</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 49.</p></td>
</tr>
</tbody>
</table>

## **12. Agent company details**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. Release 1 step 3.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 3.4: level 2 for agents includes company details where applicable.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The database has a place for an agent's business name and registration number, but the design has no way to submit them.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Agencies (firms rather than individuals) should be shown and checked as firms.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add company details to the agent's profile in step 3, checked by the verification team.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Agents can add their company details (business name and registration number) to their profile in Release 1 step 3, checked by the verification team.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 50.</p></td>
</tr>
</tbody>
</table>

## **13. Removing a verified badge, and bans**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. Release 1 review tasks (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 7.2: a confirmed report of an inspection fee leads to a warning, then loss of the verified badge, then suspension. Section 6.5: listing without authority leads to a warning or a ban. Section 19.1: staff apply warnings, badge removal and suspensions.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Staff review decisions in the design can warn or suspend a user, but cannot remove a badge or ban.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Without these steps, staff must jump from a warning straight to suspension.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add badge removal and banning to the review decisions, each recorded against the user's verified identity.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Staff review decisions can also remove a verified badge and ban a user, each recorded against the user's verified identity.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 51.</p></td>
</tr>
</tbody>
</table>

## **14. Protection against copying listings in bulk**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Release 1 search and property page (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 15.3: unusual viewing, such as one account opening hundreds of listings in minutes, is blocked. The Technical Architecture (Section 9.1) plans limits per account.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The server limits requests per internet address, not per account, and keeps the count on each server separately.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Someone copying listings can spread requests across addresses; limits per account, shared by all servers, stop that.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add limits per account on viewing listings and photos, counted in Redis so every server shares them, when search and the property page are built.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Limits per account on viewing listings and photos, counted in Redis so every server shares them, are built with search and the property page.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 52.</p></td>
</tr>
</tbody>
</table>

## **15. Maintenance mode and switch warnings**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. With the admin screens.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 17.3: the platform or one feature can be closed temporarily with a message saying when it will return, and the admin panel warns when switching off a feature that others depend on.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Features can be switched off, and users then see a general "not available at the moment" message. There is no return time or custom message, and no warning about dependent features.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Users are more patient when told when something will be back, and staff avoid switching off something another feature needs.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add an optional message and return time to switch rules, and dependency warnings, when the admin screens are built.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: A switch rule can carry an optional message and return time shown to users, and the admin panel warns when switching off a feature that others depend on. Built with the admin screens.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 53.</p></td>
</tr>
</tbody>
</table>

## **16. Restricted countries**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. Before a second country.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 16.2: countries where the platform must not operate, for legal or sanctions reasons, can be blocked.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Not designed.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Only matters once the platform operates beyond Nigeria.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add before a second country is opened (Release 3).</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Blocking restricted countries is added before a second country is opened (Release 3).</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 54.</p></td>
</tr>
</tbody>
</table>

## **17. Country settings not yet covered**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium for data retention; Low for the rest.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 16.1 lists settings per country, including: fee types shown on listings, address format, data retention periods, where data is stored, legal templates, land registry and survey coordinate system.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>The country settings do not have these yet, and the listing design has fixed fee fields (rent, agency fee, legal fee, caution deposit, service charge).</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Data retention is needed for identity checks in step 3 (open point 15). The others matter when their features are built or a second country is opened.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Add each setting with the feature that needs it: data retention in step 3; fee types shown on listings in step 5; the rest in Releases 2 and 3. The fixed fee fields suit Nigeria for Release 1.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted, with these specifics.</p>
<p>Agreed: Data retention becomes a country setting in Release 1 step 3, with the period set after legal advice (open point 15). Other country settings are added with the features that need them: fee types shown on listings in step 5, the rest in Releases 2 and 3. The fixed fee fields remain for Release 1 in Nigeria.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 55.</p></td>
</tr>
</tbody>
</table>

## **18. Property details and photo checklist**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low. Release 1 step 4 (buildings and units).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 5.2: distance to the main road. Section 5.3: photos of each bathroom and toilet, and a note for each part (for example "newly tiled").</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Distance to the main road is not recorded. The residential checklist asks for each bathroom but not separate toilets. A note per part can be stored in the database but cannot be entered through the API.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Small gaps, but the specification promises tenants every part, part by part.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Fix all three in step 4.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: In Release 1 step 4: the distance to the main road is recorded; the residential photo checklist asks for separate toilets; and each part can carry a note.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 56.</p></td>
</tr>
</tbody>
</table>

# **5. Not Placed in Any Release**

The specification asks for these, but the release plan in the Technical Architecture does not say when they are built.

## **19. Ratings and reviews**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium for planning.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 7.3: ratings and reviews after a tenancy or short let completed through the platform, for both sides. Section 5.4: the lister's rating on the property page.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>No release in the Technical Architecture includes ratings and reviews. The property page design shows the lister's typical response time but no rating.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Ratings depend on completed tenancies, which are only recorded once escrow and property management exist.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Place ratings and reviews in Release 2, with escrow and short lets.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted, with these specifics.</p>
<p>Agreed: Ratings and reviews come in Release 2, with escrow and short lets.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 57.</p></td>
</tr>
</tbody>
</table>

## **20. Which automatic checks are in Release 1**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Medium. Release 1 listings (step 5).</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>Section 6.3 lists nine automatic checks. The release plan says Release 1 has duplicate checks and a basic risk score, and Release 3 has survey plan matching, document reading and registry checks.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Six checks are not placed: live photo check, walkthrough video GPS path, satellite check, stolen photo check, name match, and duplicate document numbers.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>The basic risk score in Release 1 is only as good as the checks that feed it.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Release 1: live photo check, walkthrough GPS path, all duplicate checks (location, photo fingerprint, document numbers, address), and name match by the verification team. Satellite and stolen photo checks in Release 2, as they need outside services.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Release 1: live photo check, walkthrough video GPS path, all duplicate checks (location, photo fingerprint, document numbers and address), and name match by the verification team. Release 2: satellite check and stolen photo check.</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 58.</p></td>
</tr>
</tbody>
</table>

# **6. Technical Points**

These need no decision from you. They are recorded so they are not forgotten, and will be handled in the steps named.

## **21. Technical points**

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Priority</strong></td>
<td>Low.</td>
</tr>
<tr class="even">
<td><strong>The specification says</strong></td>
<td>The Technical Architecture plans Redis for rate limits and BullMQ for background jobs, and an API gateway in front of the server. Section 15.2: a tenant's live location is not stored.</td>
</tr>
<tr class="odd">
<td><strong>Built or designed now</strong></td>
<td>Rate limits are held in each server's memory, background jobs are not used yet, and the server itself does the gateway's checks. Request logs are not yet configured.</td>
</tr>
<tr class="even">
<td><strong>Why it matters</strong></td>
<td>Shared limits matter once there is more than one server. Request logs must not keep the "around me" location, or Section 15.2 would be broken.</td>
</tr>
<tr class="odd">
<td><strong>Suggestion</strong></td>
<td>Move limits to Redis and start BullMQ with the first background job (account deletion or media processing); make sure logs never record search locations when search is built. Recorded in the status note.</td>
</tr>
<tr class="even">
<td><strong>Your decision</strong></td>
<td><p>Accepted as suggested.</p>
<p>Agreed: Rate limits move to Redis and BullMQ starts with the first background job. Request logs never record search locations (Specification Section 15.2).</p>
<p>Decided by Emmanuel on 23 October 2026. Recorded in the Decisions Log as decision 59.</p></td>
</tr>
</tbody>
</table>

# **7. Already Settled**

These differ from the specification's wording, but were already decided, so they need no action.

| **Point**                      | **Where it stands**                                                                                                                                                                                               |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Email at registration          | Required, confirmed, and usable to sign in (decisions 35 to 38). To be built in the next step.                                                                                                                    |
| Landlord and agent levels      | The specification has four levels for landlords and agents. The design uses three levels for everyone, with owner verification and agent authority checked per property. Same effect; recorded in the API design. |
| Approvals for feature switches | Section 17.3 asks for two-person approval for payment, escrow and verification switches. Switching off applies at once, so emergency pauses are never delayed (decisions 28 and 33).                              |
| Staff two-step login           | Section 15.4 asks for two-step login for staff. Built with the details in decisions 29 to 34.                                                                                                                     |

# **8. What Happens Next**

- The email step (decisions 35 to 38) is built next.

- Then the screen designs in Figma for your review and approval (decision 42); no app screen is built until its design is approved.

- The other decisions are built in the Release 1 steps named in each one, as set out in the status note (docs/STATUS.md).

# **9. Explanation of Terms**

| **Term**                     | **Meaning**                                                                                                                     |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| API design                   | The agreed list of requests the apps can make to the server, and what each returns (docs/api/openapi.yaml).                     |
| Push notification            | A message that appears on the phone's screen even when the app is closed.                                                       |
| Live connection (WebSockets) | A connection the server keeps open to the app, so new messages arrive instantly instead of the app asking repeatedly.           |
| Rate limit                   | A cap on how many requests can be made in a period, to stop abuse and copying.                                                  |
| Redis                        | A fast shared store all servers can use, for example to count requests for rate limits.                                         |
| BullMQ                       | A tool for running background jobs, such as processing photos or deleting accounts, outside the user's request.                 |
| Search engines               | Services such as Google that list web pages in their results; public listing summaries let them show FindHouseQuick properties. |
| Liveness check               | The app asks the user to blink or turn their head on camera, proving a real person is present.                                  |
