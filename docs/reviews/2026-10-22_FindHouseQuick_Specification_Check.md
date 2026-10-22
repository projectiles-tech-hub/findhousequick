**FindHouseQuick**

Specification Check

Projectiles Tech Hub Limited

Emmanuel Chukwuka Oraegbu, Managing Director

22 October 2026

# **1. About This Check**

On 22 October 2026 we found that the Product Specification requires an email address at registration, but the API design made it optional and the server was built that way. That gap was settled by decisions 35 to 38. This check looks for any other place where what is built or designed differs from what the documents say.

Each finding below shows what the specification says, what is built or designed now, why it matters, and a suggestion. Nothing has been changed because of these findings. Each one waits for your decision.

## **What was compared**

- Product Specification, version 1.3 (all 21 sections).

- Technical Architecture and Execution Plan, version 1.0, including the release plan (Section 2.2), team (Section 3) and Release 0 tasks (Section 15).

- Decisions Log, decisions 1 to 38 and open points 1 to 15.

- The agreed API design (docs/api/openapi.yaml), the database design, the feature switches, the country settings and the starter data.

- The code merged into the main branch up to pull request \#7 (accounts, staff accounts and feature controls).

## **How to use this document**

- High priority: affects what is being built in Release 1 now, or what the records say. Medium: needed in a later Release 1 step. Low: small, or for a later release.

- Write your decision in the yellow row of each finding, or simply reply in chat with the finding number and your answer.

- Each decision will be recorded in the Decisions Log, and the API design and status note updated, before any code that depends on it.

# **2. Summary**

21 findings. Four are high priority: 1, 4, 5 and 8. Section 7 lists points that differ from the specification but were already settled, for completeness.

| **No.** | **Finding**                                                       | **Section**              | **Priority**                                |
|---------|-------------------------------------------------------------------|--------------------------|---------------------------------------------|
| 1       | Browsing without an account                                       | 3.1, 3.2                 | High                                        |
| 2       | Languages at launch                                               | 18.2                     | Medium                                      |
| 3       | Customer support at launch                                        | 18.1                     | Medium                                      |
| 4       | Release 0 is marked complete, but three of its tasks are not done | Tech. Arch. 15           | High                                        |
| 5       | Field team capturing properties for landlords                     | 20; Tech. Arch. 3        | High                                        |
| 6       | Calling inside the app                                            | 7.1                      | Medium                                      |
| 7       | Inspection time slots                                             | 7.2                      | Low                                         |
| 8       | Notifications                                                     | 4.2, 7, 11               | High                                        |
| 9       | Live updates for chat                                             | 1.4; Tech. Arch. 9.1     | Medium                                      |
| 10      | Saved places and travel distance                                  | 5.4, 15.2                | Low                                         |
| 11      | Identity document at level 2                                      | 3.2 to 3.4               | Medium                                      |
| 12      | Agent company details                                             | 3.4                      | Low                                         |
| 13      | Removing a verified badge, and bans                               | 6.5, 7.2, 19.1           | Low                                         |
| 14      | Protection against copying listings in bulk                       | 15.3                     | Medium                                      |
| 15      | Maintenance mode and switch warnings                              | 17.3                     | Low                                         |
| 16      | Restricted countries                                              | 16.2                     | Low                                         |
| 17      | Country settings not yet covered                                  | 16.1                     | Medium for data retention; Low for the rest |
| 18      | Property details and photo checklist                              | 5.2, 5.3                 | Low                                         |
| 19      | Ratings and reviews                                               | 5.4, 7.3                 | Medium for planning                         |
| 20      | Which automatic checks are in Release 1                           | 6.3                      | Medium                                      |
| 21      | Technical points                                                  | Tech. Arch. 8, 9.1; 15.2 | Low                                         |

# **3. Where the Documents Disagree**

In these, two of the documents (or a document and the build) say different things, so one of them has to give way.

## **1. Browsing without an account**

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                           |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | High. Affects search and the property page (Release 1 step 5) and the public website.                                                                                                                                                                                                                                                                                                                                     |
| **The specification says** | Section 3.1: every user must register to use the platform. Section 3.2: browsing listings and using the map are unlocked at level 1, after registering. Decision 5: everyone registers.                                                                                                                                                                                                                                   |
| **Built or designed now**  | The Technical Architecture (Section 8) plans a public website so that search engines can find and show listing summaries. The API design lets signed-out visitors search and open a property page; only the photo gallery, walkthrough and exact location need sign-in.                                                                                                                                                   |
| **Why it matters**         | Requiring an account before anyone can see a single listing protects the listings and photos best, but people and search engines cannot discover the platform. Public summaries bring visitors but show some information without an account.                                                                                                                                                                              |
| **Suggestion**             | Allow signed-out visitors a summary only (cover photo, rent, area, number of rooms and badges) for discovery and search engines. Everything else (gallery, walkthrough, details, contact, saving, alerts) needs an account, as the specification says. If you prefer everything behind registration, the public website shows only the platform's own pages, and the API design is changed to require sign-in for search. |
| **Your decision**          |                                                                                                                                                                                                                                                                                                                                                                                                                           |

## **2. Languages at launch**

|                            |                                                                                                                                                                                                                            |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Affects the launch date and translation costs.                                                                                                                                                                     |
| **The specification says** | Section 18.2 and decision 21: English, Nigerian Pidgin, Yoruba, Igbo, Hausa and French at launch.                                                                                                                          |
| **Built or designed now**  | The Technical Architecture release plan puts English and Pidgin in Release 1 and the remaining languages in Release 3. The build follows it: Nigeria lists all six languages, but only English and Pidgin are switched on. |
| **Why it matters**         | Six languages at launch means every screen, message and help page translated and checked four more times before launch.                                                                                                    |
| **Suggestion**             | Launch with English and Pidgin, and switch each other language on as soon as its translation is ready and checked (no new release needed). Or keep six at launch and plan the translation work and budget now.             |
| **Your decision**          |                                                                                                                                                                                                                            |

## **3. Customer support at launch**

|                            |                                                                                                                                                                                                                                                 |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Needed before the Release 1 launch.                                                                                                                                                                                                     |
| **The specification says** | Section 18.1: help centre, in-app support chat, a WhatsApp line and a phone line, with every enquiry a ticket with a reference number. The Technical Architecture (Section 3) says the customer support team is needed at the Release 1 launch. |
| **Built or designed now**  | The release plan puts customer support tools in Release 2. Nothing for support is in the Release 1 design.                                                                                                                                      |
| **Why it matters**         | Users of the Release 1 pilot will need help from the first day, especially with verification.                                                                                                                                                   |
| **Suggestion**             | At the Release 1 launch: a help page in the app and website, and the WhatsApp and phone lines run by the support team outside the app. In-app support chat and tickets come in Release 2 as planned.                                            |
| **Your decision**          |                                                                                                                                                                                                                                                 |

## **4. Release 0 is marked complete, but three of its tasks are not done**

|                            |                                                                                                                                                                                                                                     |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | High. The records are not accurate.                                                                                                                                                                                                 |
| **The specification says** | Technical Architecture, Section 15 (Release 0 tasks) includes: screen designs for tenants, landlords, agents and staff; the test system on the cloud host; and the code structure for the public website.                           |
| **Built or designed now**  | The status note says Release 0 is complete. None of those three tasks has been done: there are no screen designs, no hosting account (so no test system), and the public website has not been started.                              |
| **Why it matters**         | The app screens cannot be built well without designs, and nothing can be shown on real phones without a test system. The status note should not say these are done.                                                                 |
| **Suggestion**             | Correct the status note now (no decision needed; included in this update). Decide when the screen designs are made and by whom (the plan says a part-time designer), and open the hosting account so the test system can be set up. |
| **Your decision**          |                                                                                                                                                                                                                                     |

## **5. Field team capturing properties for landlords**

|                            |                                                                                                                                                                                                                                                                                                     |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | High. Listings must exist before tenants are invited.                                                                                                                                                                                                                                               |
| **The specification says** | Section 20 and the Technical Architecture (Sections 3 and 5): before tenants are invited, the field team visits landlords and agents, registers them, and captures their properties on site through the app.                                                                                        |
| **Built or designed now**  | In the API design, only the landlord or an authorised agent can register a building and create a listing. There is a field officer staff role, but it has no power to capture a property for someone else.                                                                                          |
| **Why it matters**         | Without this, the field team can only help a landlord use the landlord's own phone, which is slow and depends on the landlord's phone and data.                                                                                                                                                     |
| **Suggestion**             | Let a field officer register the building, add units and take the photos and video on behalf of a landlord who is present. The landlord then confirms it in their own app before it is submitted, and the ownership documents remain the landlord's. Everything the field officer does is recorded. |
| **Your decision**          |                                                                                                                                                                                                                                                                                                     |

# **4. In the Specification, Missing From the Release 1 Design**

The specification asks for these, but the agreed API design for Release 1 does not include them yet.

## **6. Calling inside the app**

|                            |                                                                                                                                                                                    |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Release 1 messaging (step 5).                                                                                                                                              |
| **The specification says** | Section 7.1: verified tenants can chat with and call landlords and authorised agents within the app; phone numbers stay hidden until an inspection is booked and both sides agree. |
| **Built or designed now**  | The design has chat, and phone numbers shared once an inspection is booked and both sides agree. There is no calling inside the app.                                               |
| **Why it matters**         | Calls inside the app without showing numbers need a calling service, which costs money per minute.                                                                                 |
| **Suggestion**             | For Release 1, read "call" as an ordinary phone call once numbers are shared (no extra cost). Calls inside the app without numbers can be added later if wanted.                   |
| **Your decision**          |                                                                                                                                                                                    |

## **7. Inspection time slots**

|                            |                                                                                                                                                                   |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. Release 1 inspections (step 5).                                                                                                                              |
| **The specification says** | Section 7.2: tenants book inspections by choosing a time slot; the landlord or agent confirms.                                                                    |
| **Built or designed now**  | The design lets the tenant propose any date and time, which the landlord or agent confirms, cancels or moves.                                                     |
| **Why it matters**         | With published slots, tenants only see times the lister can do. With free proposals, there is more back and forth.                                                |
| **Suggestion**             | Let landlords and agents set their available times, from which tenants pick a slot, as the specification says. The confirm and reschedule steps stay as designed. |
| **Your decision**          |                                                                                                                                                                   |

## **8. Notifications**

|                            |                                                                                                                                                                                                                                                              |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | High. Needed by chat, inspections, alerts and email (decisions 35 to 38).                                                                                                                                                                                    |
| **The specification says** | Section 4.2: alerts when a matching property is listed. Sections 7 and 11: messages, inspection confirmations and rent reminders. The Technical Architecture (Sections 8 and 9.2) plans push notifications through Firebase, SMS, and notification settings. |
| **Built or designed now**  | The design has no way for the app to register a phone for push notifications, no notification settings, and no choice of channel (push, SMS or email).                                                                                                       |
| **Why it matters**         | Without notifications, users only see messages, confirmations and alerts if they open the app and look.                                                                                                                                                      |
| **Suggestion**             | Add to the Release 1 design: registering a phone for push notifications, and settings for which notifications each user receives and by which channel (push, email, SMS). Security messages (codes, sign-in alerts) cannot be switched off.                  |
| **Your decision**          |                                                                                                                                                                                                                                                              |

## **9. Live updates for chat**

|                            |                                                                                                                                                                                          |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Release 1 chat (step 5).                                                                                                                                                         |
| **The specification says** | Section 1.4: a change made on one platform appears on the others immediately. The Technical Architecture (Section 9.1) plans a live connection (WebSockets) for chat and status updates. |
| **Built or designed now**  | The design has only ordinary requests, so the app would have to keep asking the server for new messages.                                                                                 |
| **Why it matters**         | Without a live connection, chat feels slow and the app uses more data and battery.                                                                                                       |
| **Suggestion**             | Add the live connection to the Release 1 design, for chat messages and inspection status, with push notifications (finding 8) when the app is closed.                                    |
| **Your decision**          |                                                                                                                                                                                          |

## **10. Saved places and travel distance**

|                            |                                                                                                                                                                                                           |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low.                                                                                                                                                                                                      |
| **The specification says** | Section 5.4: the property page shows the travel distance to places the tenant has saved, such as an office or school. Section 15.2: a tenant's location is not stored unless they choose to save a place. |
| **Built or designed now**  | Saved places are not in the design.                                                                                                                                                                       |
| **Why it matters**         | Travel distance to work or school is one of the first things tenants ask about.                                                                                                                           |
| **Suggestion**             | Add saved places (name and location, chosen by the tenant) and travel distance on the property page, in Release 1 step 5 or later in Release 1.                                                           |
| **Your decision**          |                                                                                                                                                                                                           |

## **11. Identity document at level 2**

|                            |                                                                                                                                                                                |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Release 1 step 3 (identity checks).                                                                                                                                    |
| **The specification says** | Sections 3.2 to 3.4: level 2 needs the NIN, a selfie with a liveness check, and an identity document.                                                                          |
| **Built or designed now**  | The identity check design takes the ID type and number (for example the NIN), with the provider's selfie and liveness check. It does not take a photo of an identity document. |
| **Why it matters**         | Identity providers can check a NIN against the government record without a document photo. Asking for a document as well is stronger but adds a step and cost.                 |
| **Suggestion**             | Decide whether level 2 needs a document photo in addition to the NIN check. This goes with open point 14 (which documents are accepted besides NIN).                           |
| **Your decision**          |                                                                                                                                                                                |

## **12. Agent company details**

|                            |                                                                                                                          |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. Release 1 step 3.                                                                                                   |
| **The specification says** | Section 3.4: level 2 for agents includes company details where applicable.                                               |
| **Built or designed now**  | The database has a place for an agent's business name and registration number, but the design has no way to submit them. |
| **Why it matters**         | Agencies (firms rather than individuals) should be shown and checked as firms.                                           |
| **Suggestion**             | Add company details to the agent's profile in step 3, checked by the verification team.                                  |
| **Your decision**          |                                                                                                                          |

## **13. Removing a verified badge, and bans**

|                            |                                                                                                                                                                                                                                                                   |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. Release 1 review tasks (step 5).                                                                                                                                                                                                                             |
| **The specification says** | Section 7.2: a confirmed report of an inspection fee leads to a warning, then loss of the verified badge, then suspension. Section 6.5: listing without authority leads to a warning or a ban. Section 19.1: staff apply warnings, badge removal and suspensions. |
| **Built or designed now**  | Staff review decisions in the design can warn or suspend a user, but cannot remove a badge or ban.                                                                                                                                                                |
| **Why it matters**         | Without these steps, staff must jump from a warning straight to suspension.                                                                                                                                                                                       |
| **Suggestion**             | Add badge removal and banning to the review decisions, each recorded against the user's verified identity.                                                                                                                                                        |
| **Your decision**          |                                                                                                                                                                                                                                                                   |

## **14. Protection against copying listings in bulk**

|                            |                                                                                                                                                                            |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Release 1 search and property page (step 5).                                                                                                                       |
| **The specification says** | Section 15.3: unusual viewing, such as one account opening hundreds of listings in minutes, is blocked. The Technical Architecture (Section 9.1) plans limits per account. |
| **Built or designed now**  | The server limits requests per internet address, not per account, and keeps the count on each server separately.                                                           |
| **Why it matters**         | Someone copying listings can spread requests across addresses; limits per account, shared by all servers, stop that.                                                       |
| **Suggestion**             | Add limits per account on viewing listings and photos, counted in Redis so every server shares them, when search and the property page are built.                          |
| **Your decision**          |                                                                                                                                                                            |

## **15. Maintenance mode and switch warnings**

|                            |                                                                                                                                                                                              |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. With the admin screens.                                                                                                                                                                 |
| **The specification says** | Section 17.3: the platform or one feature can be closed temporarily with a message saying when it will return, and the admin panel warns when switching off a feature that others depend on. |
| **Built or designed now**  | Features can be switched off, and users then see a general "not available at the moment" message. There is no return time or custom message, and no warning about dependent features.        |
| **Why it matters**         | Users are more patient when told when something will be back, and staff avoid switching off something another feature needs.                                                                 |
| **Suggestion**             | Add an optional message and return time to switch rules, and dependency warnings, when the admin screens are built.                                                                          |
| **Your decision**          |                                                                                                                                                                                              |

## **16. Restricted countries**

|                            |                                                                                                              |
|----------------------------|--------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. Before a second country.                                                                                |
| **The specification says** | Section 16.2: countries where the platform must not operate, for legal or sanctions reasons, can be blocked. |
| **Built or designed now**  | Not designed.                                                                                                |
| **Why it matters**         | Only matters once the platform operates beyond Nigeria.                                                      |
| **Suggestion**             | Add before a second country is opened (Release 3).                                                           |
| **Your decision**          |                                                                                                              |

## **17. Country settings not yet covered**

|                            |                                                                                                                                                                                                             |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium for data retention; Low for the rest.                                                                                                                                                                |
| **The specification says** | Section 16.1 lists settings per country, including: fee types shown on listings, address format, data retention periods, where data is stored, legal templates, land registry and survey coordinate system. |
| **Built or designed now**  | The country settings do not have these yet, and the listing design has fixed fee fields (rent, agency fee, legal fee, caution deposit, service charge).                                                     |
| **Why it matters**         | Data retention is needed for identity checks in step 3 (open point 15). The others matter when their features are built or a second country is opened.                                                      |
| **Suggestion**             | Add each setting with the feature that needs it: data retention in step 3; fee types shown on listings in step 5; the rest in Releases 2 and 3. The fixed fee fields suit Nigeria for Release 1.            |
| **Your decision**          |                                                                                                                                                                                                             |

## **18. Property details and photo checklist**

|                            |                                                                                                                                                                                                            |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low. Release 1 step 4 (buildings and units).                                                                                                                                                               |
| **The specification says** | Section 5.2: distance to the main road. Section 5.3: photos of each bathroom and toilet, and a note for each part (for example "newly tiled").                                                             |
| **Built or designed now**  | Distance to the main road is not recorded. The residential checklist asks for each bathroom but not separate toilets. A note per part can be stored in the database but cannot be entered through the API. |
| **Why it matters**         | Small gaps, but the specification promises tenants every part, part by part.                                                                                                                               |
| **Suggestion**             | Fix all three in step 4.                                                                                                                                                                                   |
| **Your decision**          |                                                                                                                                                                                                            |

# **5. Not Placed in Any Release**

The specification asks for these, but the release plan in the Technical Architecture does not say when they are built.

## **19. Ratings and reviews**

|                            |                                                                                                                                                                      |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium for planning.                                                                                                                                                 |
| **The specification says** | Section 7.3: ratings and reviews after a tenancy or short let completed through the platform, for both sides. Section 5.4: the lister's rating on the property page. |
| **Built or designed now**  | No release in the Technical Architecture includes ratings and reviews. The property page design shows the lister's typical response time but no rating.              |
| **Why it matters**         | Ratings depend on completed tenancies, which are only recorded once escrow and property management exist.                                                            |
| **Suggestion**             | Place ratings and reviews in Release 2, with escrow and short lets.                                                                                                  |
| **Your decision**          |                                                                                                                                                                      |

## **20. Which automatic checks are in Release 1**

|                            |                                                                                                                                                                                                                                                           |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Medium. Release 1 listings (step 5).                                                                                                                                                                                                                      |
| **The specification says** | Section 6.3 lists nine automatic checks. The release plan says Release 1 has duplicate checks and a basic risk score, and Release 3 has survey plan matching, document reading and registry checks.                                                       |
| **Built or designed now**  | Six checks are not placed: live photo check, walkthrough video GPS path, satellite check, stolen photo check, name match, and duplicate document numbers.                                                                                                 |
| **Why it matters**         | The basic risk score in Release 1 is only as good as the checks that feed it.                                                                                                                                                                             |
| **Suggestion**             | Release 1: live photo check, walkthrough GPS path, all duplicate checks (location, photo fingerprint, document numbers, address), and name match by the verification team. Satellite and stolen photo checks in Release 2, as they need outside services. |
| **Your decision**          |                                                                                                                                                                                                                                                           |

# **6. Technical Points**

These need no decision from you. They are recorded so they are not forgotten, and will be handled in the steps named.

## **21. Technical points**

|                            |                                                                                                                                                                                                             |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Priority**               | Low.                                                                                                                                                                                                        |
| **The specification says** | The Technical Architecture plans Redis for rate limits and BullMQ for background jobs, and an API gateway in front of the server. Section 15.2: a tenant's live location is not stored.                     |
| **Built or designed now**  | Rate limits are held in each server's memory, background jobs are not used yet, and the server itself does the gateway's checks. Request logs are not yet configured.                                       |
| **Why it matters**         | Shared limits matter once there is more than one server. Request logs must not keep the "around me" location, or Section 15.2 would be broken.                                                              |
| **Suggestion**             | Move limits to Redis and start BullMQ with the first background job (account deletion or media processing); make sure logs never record search locations when search is built. Recorded in the status note. |
| **Your decision**          |                                                                                                                                                                                                             |

# **7. Already Settled**

These differ from the specification's wording, but were already decided, so they need no action.

| **Point**                      | **Where it stands**                                                                                                                                                                                               |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Email at registration          | Required, confirmed, and usable to sign in (decisions 35 to 38). To be built in the next step.                                                                                                                    |
| Landlord and agent levels      | The specification has four levels for landlords and agents. The design uses three levels for everyone, with owner verification and agent authority checked per property. Same effect; recorded in the API design. |
| Approvals for feature switches | Section 17.3 asks for two-person approval for payment, escrow and verification switches. Switching off applies at once, so emergency pauses are never delayed (decisions 28 and 33).                              |
| Staff two-step login           | Section 15.4 asks for two-step login for staff. Built with the details in decisions 29 to 34.                                                                                                                     |

# **8. What Happens Next**

- You decide each finding (in the yellow rows, or by number in chat).

- Each decision is recorded in the Decisions Log and, where needed, the API design and status note are updated, before any code that depends on it.

- Then the email step (decisions 35 to 38), then step 3 (verification ladder and identity checks).

- This document is kept in the code repository (docs/reviews) so the findings are not lost.

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
