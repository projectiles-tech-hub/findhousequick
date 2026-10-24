**FindHouseQuick**

Rental Platform Product Specification

Projectiles Tech Hub Limited

Emmanuel Chukwuka Oraegbu, Managing Director

Version 1.6 \| 24 October 2026

# Contents

1\. Product Overview

2\. User Types

3\. Registration and Verification

4\. Property Search

5\. Property Categories and Presentation

6\. Property Listing and Verification

7\. Contact, Inspections and Trust

8\. Fees and Charges

9\. Escrow

10\. Short Lets

11\. Property Management

12\. Rent Financing

13\. Market Information

14\. Preventing Transactions Outside the Platform

15\. Data Protection and Media Protection

16\. Global Operation and Country Controls

17\. Feature Controls

18\. Customer Support and Languages

19\. Platform Administration and Reports

20\. Launch Plan

21\. Explanation of Terms

22\. Version History

# 1. Product Overview

## 1.1 Purpose

The platform is a rental property marketplace and property management system. It allows tenants to find available rental properties by location, including properties around their current position, and gives them direct access to the landlords and authorised agents responsible for those properties.

FindHouseQuick is built to operate anywhere in the world. Each country is switched on and configured by the platform team through the country controls set out in Section 16, and every feature can be switched on or off through the feature controls set out in Section 17.

The central promise of the platform is trust: verified users, verified properties, listings that are actually available, and fees that are shown upfront.

## 1.2 Problems Addressed

- Fake, stale or duplicated listings.

- Fraud, including people collecting money for properties they do not own or control.

- Multiple layers of middlemen, each adding fees.

- Hidden charges and inspection fees demanded from tenants.

- Poor record keeping between landlords and tenants.

## 1.3 Scope

- **Rentals only:** long-term residential tenancies, commercial tenancies and short lets.

- Sales and land transactions are outside the scope of this version.

- **Coverage:** worldwide, country by country, as each country is enabled through the country controls.

## 1.4 Platforms

The platform is delivered on three platforms sharing one central system, so that any change made on one platform appears on the others immediately.

| **Platform**     | **Main users**                                                   | **Main purpose**                                                            |
|------------------|------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Mobile app       | Tenants, agents and landlords in the field                       | "Around me" search, inspections, adding properties on site with GPS, chat   |
| Web app          | All users                                                        | Searching, managing listings, payments, property management                 |
| Desktop software | Landlords and agents with many properties; the verification team | Heavy property management work, reports, document review and administration |

# 2. User Types

| **User type** | **Description**                                                                                                                                                                                                          |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tenant        | A person searching for a property to rent, whether long-term or short let.                                                                                                                                               |
| Landlord      | The owner of a property, or a person with legal ownership rights over it.                                                                                                                                                |
| Agent         | A person or firm authorised by a landlord to let and manage a specific property.                                                                                                                                         |
| Scout         | A verified user who reports a vacant property and invites its landlord onto the app, for a referral reward paid by Projectiles. A scout is not an agent and never lists, manages or speaks for a property (Section 3.6). |
| Caretaker     | A person added by a landlord with limited access, for example handling repairs but not payments.                                                                                                                         |
| Platform team | Projectiles staff who review documents, handle disputes, carry out site visits and manage the platform.                                                                                                                  |

# 3. Registration and Verification

## 3.1 General Rules

- Every user must register to use the platform; visitors without an account see only a summary of each listing: cover photo, rent, area, number of rooms and badges (decision 39). Registration is free of charge.

- Registration needs both a phone number and an email address. The user signs up with either one: a code sent to it confirms it at once, and the other is confirmed afterwards with a code sent to it (decision 35).

- Until both the phone number and the email address are confirmed, the user can only browse. Level 1 is reached once both are confirmed, and any action or progress needs level 1 (decisions 35, 37 and 64).

- Users sign in with their phone number or email address, by password or by a code sent to it. Password reset codes go by SMS or email, as the user chooses (decisions 35 and 36).

- Verification is enforced by limiting what a user can do until each level of verification is completed.

- In this document, "NIN" means the National Identification Number in Nigeria, or the equivalent national identity number or document in any other country.

- Identity checks (NIN, selfie and liveness) are automated through a licensed identity verification provider for each country and should complete within minutes, so that users are not lost to delays.

- A photo of an identity document is asked for only when the NIN check fails or the details do not match. Accepted in Nigeria: driver's licence, international passport and NIN slip (decision 49).

- The name on the NIN, the bank account and any ownership documents must match. Any mismatch sends the case to the platform team for review.

- Each automated identity check carries a cost charged by the provider. As registration is free, this cost is borne by Projectiles and must be planned for until transaction income covers it.

- Users must give clear consent to the collection and storage of identity documents. All such data must be stored securely in line with Nigerian data protection law and the data protection law of each country where the platform operates.

- Because every account is tied to a verified NIN, a suspended or banned user cannot simply open a new account under another name.

## 3.2 Tenant Verification Levels

| **Level**         | **Requirements**                                                                                                  | **What it unlocks**                                                  |
|-------------------|-------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| 1\. Basic         | Name, phone number confirmed by SMS code, email address confirmed by email code (decisions 35 and 37)             | Browse listings, use the map, save favourites, set saved area alerts |
| 2\. Verified      | NIN, selfie with liveness check; an identity document only if the NIN check fails or does not match (decision 49) | Contact landlords and agents, chat, book inspections                 |
| 3\. Payment ready | Bank account confirmed in the tenant's own name                                                                   | Pay through escrow, sign tenancy agreements, book short lets         |

## 3.3 Landlord Verification Levels

| **Level**          | **Requirements**                                                                                                  | **What it unlocks**                                |
|--------------------|-------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| 1\. Basic          | Phone number confirmed by SMS code, email address confirmed by email code (decisions 35 and 37)                   | Browse and explore the platform                    |
| 2\. Verified       | NIN, selfie with liveness check; an identity document only if the NIN check fails or does not match (decision 49) | Add properties as drafts, approve or reject agents |
| 3\. Owner verified | Proof of ownership for each property, verified as set out in Section 6                                            | Listings go live; property management features     |
| 4\. Payout ready   | Bank account in the landlord's own name                                                                           | Receive escrow payments and rent                   |

## 3.4 Agent Verification Levels

| **Level**        | **Requirements**                                                                                                                                    | **What it unlocks**                       |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| 1\. Basic        | Phone number confirmed by SMS code, email address confirmed by email code (decisions 35 and 37)                                                     | Browse and explore the platform           |
| 2\. Verified     | NIN, selfie with liveness check; an identity document only if the NIN check fails or does not match (decision 49), company details where applicable | Request authority over properties         |
| 3\. Authorised   | Proof of the landlord's authority for each property, verified by the platform team                                                                  | List and manage that specific property    |
| 4\. Payout ready | Bank account in the agent's own name                                                                                                                | Receive agreed agency fees through escrow |

## 3.5 Agent Authority Process

An agent can only list a property after providing documentary evidence that the landlord has authorised them. This is confirmed through one of two routes:

- **Landlord is registered on the platform:** the landlord receives the agent's request in the app and taps "Approve". The approval is recorded digitally with the date.

- **Landlord is not registered:** the agent uploads a signed letter of authority, using the standard template provided in the app, together with the landlord's identity document. A team member calls the landlord to confirm before approving.

Further rules:

- Authority may carry an end date.

- The landlord may withdraw an agent's authority at any time, which removes the agent from the listing immediately.

- A landlord may authorise more than one agent. All authorised agents are attached to the single listing for that property; the property is never listed more than once.

- Once verified, the landlord has the final say over who may list the property.

## 3.6 Scouts and Referral Rewards

Since decision 43, the platform has no field team capturing properties. Scouts fill that gap: they are ordinary users who spot vacant properties and bring the landlords onto the app. This brings in listings and gives people a reason to talk about FindHouseQuick (decision 70).

- **Who can be a scout:** any user can opt in. As with every action beyond browsing, the scout must be verified first; verification is unchanged.

- **A scout is not an agent:** a scout never lists, manages or speaks for a property.

- **Reporting and inviting:** the scout reports a vacant property in the app and invites the landlord, either by sending an invitation link or by helping the landlord sign up on the landlord's own phone.

- **The landlord acts for himself:** he enters his own details, accepts the terms himself, gets verified and lists the property himself (decision 43). If an agent is involved, the agent goes through the authority process in Section 3.5.

- **Record:** the app records which scout brought in which landlord and property.

Referral reward:

- Projectiles pays the scout a fixed amount from its own money, into the scout's verified bank account in their own name. It is never an extra charge on the tenant or the landlord.

- It is paid once, for the first rental of that property only, and only when that rental is completed through the completed rental fee (Section 8.3) and Projectiles has received the fee. A rental paid through escrow earns no referral reward.

Checks:

- One scout per property; the first valid invitation wins.

- No reward for a landlord or property already on the app.

- Invitations expire after a set period.

- No reward where the scout is the landlord, the agent or the tenant of that property, or shares a phone number, bank account or device with any of them.

Scouts and the referral reward are switched off by default (Section 17.1). The reward amount and the invitation expiry are country settings (Section 16.1). The reward amount, the release it goes in, and the legal and tax questions are open points in the Decisions Log.

# 4. Property Search

## 4.1 Search Methods

- **Around me:** shows available properties within a chosen distance of the tenant's current location, adjustable by slider (for example 500m, 1km, 3km).

- **Map search:** browse properties on an interactive map.

- **Area and landmark search:** search by area name or by distance from a landmark, as many addresses are not precise.

- **Filters:** price, number of rooms, property type, long-term or short let, verification level.

- **Sorting:** by distance, price or newest.

## 4.2 Saved Area Alerts

A tenant can mark an area on the map, set a budget and preferences, and receive a notification whenever a matching property is listed there.

## 4.3 Location Privacy

- Before an inspection is booked, only the approximate location of a property is shown.

- The exact location and directions (through Google Maps) are released once an inspection is confirmed.

- Phone numbers remain hidden until an inspection is booked.

# 5. Property Categories and Presentation

## 5.1 Property Categories

Every property is placed in a category and a type when it is created. Categories drive the search filters, the list of parts that must be photographed, and how the property page is laid out.

| **Category**          | **Property types**                                                                                                                                                                                                      |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Long-term residential | Room in a shared house; self-contain (studio); mini flat (one bedroom); flat or apartment (two bedrooms or more); bungalow; duplex (detached, semi-detached or terrace); penthouse; boys' quarters; student hostel room |
| Commercial            | Shop; office space; plaza unit; warehouse                                                                                                                                                                               |
| Short let             | Entire serviced apartment; entire house; private room                                                                                                                                                                   |

Category and type names are set per country in the country controls, so local terms (for example "self-contain" in Nigeria) can be used in each market.

## 5.2 Property Details

Each property records structured details that tenants can filter and compare:

| **Group**          | **Details recorded**                                                                                           |
|--------------------|----------------------------------------------------------------------------------------------------------------|
| Size and layout    | Bedrooms, bathrooms, toilets, floor level, floor area, number of units in the building                         |
| Finishing          | Furnished, semi-furnished or unfurnished; floor finish; ceiling; kitchen fittings; wardrobes; air conditioning |
| Power              | Public supply, prepaid or shared meter, generator, inverter or solar                                           |
| Water              | Borehole, public supply, water treatment                                                                       |
| Security           | Fenced and gated, security guard, CCTV, estate security                                                        |
| Access and parking | Road condition, parking spaces, distance to main road                                                          |
| Occupancy rules    | Who may rent (singles, families, students, corporate), pets, maximum occupants                                 |
| Availability       | Date available, minimum and maximum tenancy period                                                             |
| Costs              | Rent, agency fee, legal or agreement fee, caution deposit, service charge and what it covers                   |

Nearby amenities (schools, hospitals, markets, bus stops, banks, places of worship) are added automatically from map data.

## 5.3 Property Parts and Media Capture

When a property is created, the app builds a checklist of the parts that must be photographed, based on the property type and the number of rooms entered. For example, a three-bedroom flat produces "Bedroom 1", "Bedroom 2" and "Bedroom 3" as separate items.

| **Part**                               | **Required media**                                                        |
|----------------------------------------|---------------------------------------------------------------------------|
| Front of building and street           | Photos of the frontage and the access road                                |
| Compound and parking                   | Photos                                                                    |
| Entrance and living room               | Photos from at least two corners                                          |
| Each bedroom                           | Photos from at least two corners, including wardrobes                     |
| Each bathroom and toilet               | Photos showing fittings                                                   |
| Kitchen                                | Photos showing fittings and storage                                       |
| Dining, balcony, store, boys' quarters | Photos, where the property has them                                       |
| Utilities                              | Photos of the electricity meter, water source and generator area          |
| Commercial spaces                      | Frontage and signage position, interior, toilets, loading or storage area |
| Whole property                         | A walkthrough video recorded in one continuous take                       |

Rules for capture:

- Photos and videos are taken through the app's camera on site, not uploaded from the phone gallery. Each carries its GPS location and the time it was taken.

- Each part needs a minimum number of photos, and may also have a short video and a note (for example "built-in wardrobe" or "newly tiled").

- Optional extras: 360-degree photos of rooms and a simple floor plan.

- The app checks each photo for blur, darkness and low resolution, and asks for a retake where needed.

- A listing cannot be submitted until every required part has been captured.

- The date the photos were taken is shown on the listing. Photos must be retaken when a property is relisted after a set period, so that tenants always see its current condition.

- Where a property is still occupied, the current occupant's consent is recorded before interior photos are taken.

## 5.4 Property Page

Each property has a page that shows every part of it clearly, laid out in this order:

1.  **Summary:** title, type, rent, total move-in cost, availability date, verification badges and "Escrow protected" badge.

2.  **Gallery by part:** photos grouped under each part ("Living room", "Bedroom 1", "Kitchen" and so on), with full-screen viewing and zoom. The tenant can move part by part, so nothing is hidden.

3.  **Walkthrough video** and 360-degree views, where available.

4.  **Key details:** size and layout, finishing, power, water, security, parking and occupancy rules.

5.  **Costs:** the full move-in cost breakdown.

6.  **Location:** approximate area on the map, nearby amenities, and travel distance to places the tenant has saved, such as an office or school.

7.  **Lister:** verified landlord or agent, rating and typical response time.

8.  **Actions:** book an inspection, chat, save, compare, share and report.

Further presentation features:

- **Compare:** up to three properties side by side, part by part and detail by detail.

- **Data saver:** smaller images load first on slow connections, with full quality on request.

- **Search results:** each result shows a cover photo, rent, key details, badges and distance. On the map, pins are grouped when zoomed out and show the rent when tapped.

# 6. Property Listing and Verification

## 6.1 Property Structure

Properties are recorded as a building containing one or more units, for example "Block A, Flat 3". This allows several flats in one compound to be listed correctly without being mistaken for duplicates.

## 6.2 Listing Requirements

- The property must be added while the lister is physically at the property, so the app records its GPS location.

- Ownership documents (Certificate of Occupancy, deed of assignment, survey plan, purchase receipt or similar) for landlords, or proof of authority for agents.

- Photos and videos of every part of the property, captured as set out in Section 5.3.

- Full fee breakdown as set out in Section 8.

## 6.3 Automatic Verification Checks

Properties are verified automatically wherever possible, so that site visits are only needed where something looks wrong.

| **Check**                | **What it does**                                                                                                                                                                                                      |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Live photo check         | Confirms photos were taken on site through the app, at the recorded location and time.                                                                                                                                |
| Video walkthrough        | Confirms the property interior and exterior match the listing, with GPS path recorded.                                                                                                                                |
| Satellite check          | Compares the GPS pin with satellite maps to confirm a building exists at that spot.                                                                                                                                   |
| Survey plan match        | Reads the boundary beacon coordinates on the survey plan, converts them from the local mapping system of that country to the GPS coordinate system, and confirms the property pin falls within the surveyed boundary. |
| Document reading         | Reads ownership documents automatically and extracts names, numbers and dates.                                                                                                                                        |
| Name match               | Compares the owner's name on the documents with the landlord's verified NIN name.                                                                                                                                     |
| Duplicate document check | Flags any Certificate of Occupancy or survey plan number already used elsewhere on the platform.                                                                                                                      |
| Stolen photo check       | Compares listing photos against images already published online.                                                                                                                                                      |
| Registry check           | Confirms title details against the land registry of the relevant state or country (for example, Edo State land records), electronically or through a search requested by the platform team, where available.          |

## 6.4 Risk Score

All automatic checks combine into a single risk score for each property:

| **Score** | **Action**                                                         |
|-----------|--------------------------------------------------------------------|
| Green     | Approved automatically and listed.                                 |
| Amber     | Documents reviewed by a team member from the office (desk review). |
| Red       | Site visit by the platform team required before listing.           |

In addition:

- **Random audits:** a small percentage of green listings are visited anyway.

- **Complaint visits:** any reported listing may be visited.

- **Tenant feedback:** after each inspection, the tenant is asked whether the property matched the listing. A "No" lowers the score and may trigger review.

- The platform team may visit any property at its discretion.

Automatic checks are strong at proving that a property exists, is where the lister says it is, and that photos and documents are consistent. They are weaker at detecting a well-forged title document, which is why the registry check and desk review remain part of the process.

## 6.5 Duplicate Listing Prevention

Several checks work together to stop the same property being listed more than once:

1.  **Location check:** a new listing within a few metres of an existing one is flagged.

2.  **Photo check:** each photo is given a digital fingerprint and compared against every photo on the platform.

3.  **Document check:** a Certificate of Occupancy or survey plan number already on the platform is flagged.

4.  **Address check:** addresses are standardised (street, area, landmark) and compared.

5.  **Building and unit structure:** prevents different units in the same building being wrongly flagged.

When a duplicate is flagged:

- The new listing is held, not published, and goes to the platform team.

- If it is the same property and the new lister is genuinely authorised, they are attached to the existing listing as an additional agent.

- Anyone who listed a property without authority receives a warning or a ban, recorded against their verified identity.

## 6.6 Keeping Listings Current

- Listings expire automatically unless the lister confirms "still available" every 7 to 14 days.

- A "Rented" button allows the lister to close the listing.

- Tenants can report a listing as fake or already taken.

# 7. Contact, Inspections and Trust

## 7.1 Direct Contact

- Verified tenants can chat with and call landlords and authorised agents within the app. Calls are voice calls over the internet inside the app, so phone numbers stay hidden; calling is part of Release 1 (decision 44).

- Phone numbers stay hidden until an inspection is booked and both sides agree to share them.

## 7.2 Inspections

- Tenants book inspections by choosing a time slot; the landlord or agent confirms.

- **No inspection fees.** Inspection booking is free, and this is stated clearly on every listing.

- Tenants can report any demand for an inspection fee in one tap. A confirmed report leads to a warning, then loss of verified badge, then suspension.

- **Inspection safety:** tenants can share inspection details (address, time, agent's name) with a family member or friend.

## 7.3 Trust Features

- Verified badges for users and properties, with a clear explanation of what each badge means.

- Ratings and reviews after a tenancy or short let completed through the platform, for both sides.

- "Report this listing" button, with fast removal of fake listings.

## 7.4 Notifications

- Users receive notifications on their phones (push notifications), by email or by SMS, and choose in their settings which notifications they receive and by which channel. Security messages, such as codes and sign-in alerts, cannot be switched off (decision 46).

- Messages, inspection updates and call alerts arrive instantly while the app is open, and as push notifications when it is closed (decision 47).

# 8. Fees and Charges

## 8.1 Free Services

Registration, listing, search, verification and inspection booking are free of charge.

## 8.2 Fees Shown Upfront

Every long-term listing shows a total move-in cost box:

- Rent (per year)

- Agency fee

- Legal or agreement fee

- Caution deposit

- Service charge, where applicable

- **Total to move in**

Agency and agreement fees are set by the landlord or agent in line with prevailing market practice; the platform does not fix them. Two rules apply:

- No fee may be charged that is not shown on the listing.

- All fees pass through the platform, so a record exists of everything paid. A tenant asked for extra money outside the platform can report it.

## 8.3 Platform Fees

| **Fee**              | **Rate** | **Who pays**                            | **When it applies**                                                           |
|----------------------|----------|-----------------------------------------|-------------------------------------------------------------------------------|
| Escrow fee           | 1.5%     | Tenant pays 1.5% and landlord pays 1.5% | When payment is made through escrow                                           |
| Completed rental fee | 2%       | Tenant pays 2% and landlord pays 2%     | When a rental arranged through the platform is completed without using escrow |

- The two fees never stack: a transaction attracts either the escrow fee or the completed rental fee, not both.

- Because the escrow fee is lower, escrow is always the cheaper route for users.

- The landlord's share is deducted from the amount released to him, so he never has to send money separately.

- Referral rewards for scouts (Section 3.6) are paid by Projectiles from its own money; they are never added to any fee.

## 8.4 Worked Example

Annual rent of N1,000,000 (in other countries, the same percentages apply in the local currency):

| **Item**                             | **Escrow route** | **Completed rental route (no escrow)**                |
|--------------------------------------|------------------|-------------------------------------------------------|
| Tenant pays platform fee             | N15,000          | N20,000                                               |
| Landlord pays platform fee           | N15,000          | N20,000                                               |
| Total paid by tenant (rent plus fee) | N1,015,000       | N1,000,000 to landlord plus N20,000 to platform       |
| Amount landlord receives             | N985,000         | N1,000,000 from tenant, less N20,000 paid to platform |
| Platform income                      | N30,000          | N40,000                                               |

# 9. Escrow

## 9.1 Escrow Operator

Projectiles Tech Hub Limited operates the escrow service. Escrow money is kept in dedicated escrow accounts at licensed commercial banks, one or more per country, completely separate from Projectiles' own operating accounts. The legal structure of the escrow service is to be confirmed with legal and regulatory advice before launch.

Holding other people's money is regulated in Nigeria by the Central Bank of Nigeria, and by the equivalent authority in most other countries. The escrow module is built so that the bank account and the payment collection service used in each country can be set and changed from the country controls.

## 9.2 How Money Moves

| **Step**       | **Money movement**                                                                                                                                                                                            |
|----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Payment in | The tenant pays rent, agency fee, legal or agreement fee, caution deposit and service charge, plus the tenant's 1.5% escrow fee, by card or bank transfer. The money goes into the escrow account.            |
| 2\. Holding    | The money stays in the escrow account. The app keeps its own record (ledger) of every naira held for each transaction.                                                                                        |
| 3\. Release    | On release, each party is paid separately: rent and caution deposit to the landlord, less the landlord's 1.5% escrow fee; agency fee to the agent; legal or agreement fee to whoever is named on the listing. |
| 4\. Fee income | Both 1.5% fees move from the escrow account to Projectiles' own account only when the transaction is released.                                                                                                |
| 5\. Refund     | Where a transaction is cancelled or a dispute is decided for the tenant, money returns to the tenant's verified account.                                                                                      |

The escrow fee is calculated on the rent.

## 9.3 Escrow Stages

| **Stage**        | **Meaning**                                                                  | **What happens next**                             |
|------------------|------------------------------------------------------------------------------|---------------------------------------------------|
| Awaiting payment | Terms agreed; tenant has not paid                                            | Payment window expires after a set time if unpaid |
| Funded           | Money received and confirmed in the escrow account                           | Landlord is notified to sign the agreement        |
| Agreement signed | Both parties have signed the digital tenancy agreement                       | Landlord hands over keys                          |
| Keys handed over | Landlord marks keys as handed over                                           | Tenant is asked to confirm move-in                |
| Released         | Tenant confirmed move-in, or the confirmation period ended without complaint | Payouts are made to each party                    |
| Disputed         | Either party raised a dispute                                                | Money is frozen until the platform team decides   |
| Refunded         | Transaction cancelled or dispute decided for the tenant                      | Money returned to the tenant                      |

## 9.4 Release and Refund Rules

- **Confirmed release:** money is released when the tenant confirms move-in.

- **Automatic release:** if the tenant neither confirms nor raises a dispute within a set number of days after keys are marked as handed over, the money is released automatically.

- **Landlord does not hand over:** if keys are not handed over within a set number of days after funding, the tenant may cancel and receive a refund.

- **Landlord cancels:** the tenant receives a full refund.

- **Tenant cancels before keys are handed over:** the refund follows the cancellation terms shown before payment.

- Time periods and refund terms are set in the country controls, so they can be adjusted without changing the software.

The following escrow settings are to be fixed by Projectiles before launch:

| **Setting**                                                             | **Status**    |
|-------------------------------------------------------------------------|---------------|
| Number of days after key handover before automatic release              | To be decided |
| Number of days a landlord has to hand over keys after funding           | To be decided |
| Whether the tenant's 1.5% fee is refunded when the landlord is at fault | To be decided |
| Who keeps any interest earned on money held in escrow accounts          | To be decided |
| Whether yearly rent renewals paid through the platform attract a fee    | To be decided |

## 9.5 Disputes

1.  Either party raises a dispute in the app before release, stating the reason.

2.  The money is frozen immediately.

3.  Both parties upload evidence: photos, videos, documents. The chat history for the transaction is attached automatically.

4.  A member of the platform team reviews the case within a set number of working days and may arrange a site visit.

5.  The decision is one of: full release to the landlord, full refund to the tenant, or a split.

6.  Either party may appeal once, to a senior team member. The decision after appeal is final within the platform.

7.  Every step is recorded.

## 9.6 Short Let Escrow

- Booking payment is held in escrow and released to the host about 24 hours after check-in.

- The caution deposit is held until checkout and refunded automatically unless the host reports damage, with evidence, within the set period (for example 48 hours). A damage claim is handled as a dispute.

## 9.7 Safeguards

- **Daily reconciliation:** the balance in each escrow account is checked every day against the app's ledger. Any difference is flagged to management at once.

- **Separation of money:** escrow money is never used for Projectiles' running costs.

- **Verified payouts only:** money is paid only to bank accounts verified in the recipient's own name.

- **Bank account changes:** changing a payout account requires re-verification and a waiting period before the new account can receive money.

- **Two-person approval:** manual releases, refunds and dispute payouts above a set amount need approval from two authorised staff members.

- **No self-dealing:** no staff member can approve a payment to themselves or a related account.

- **Audit trail:** every payment, release, refund and approval is recorded with the person, date and time, and cannot be edited.

- **Fraud and money laundering checks:** unusual transactions (very large amounts, repeated cancellations, many accounts paying into one) are flagged, and reports are made to the authorities where the law requires.

- **Receipts:** every party receives a receipt for every payment in and out; landlords and agents receive statements.

## 9.8 Encouraging Escrow Use

- Visible protection: tenants paying outside escrow lose fraud protection, automatic receipts and dispute support.

- "Escrow protected" badge on listings.

- Lower fee than the completed rental fee.

# 10. Short Lets

- **Booking calendar:** the host marks available dates; booked dates are blocked automatically to prevent double bookings.

- **Pricing:** nightly or weekly, with optional discounts for longer stays.

- **Caution deposit:** held in escrow and refunded automatically after checkout if the host reports no damage within a set period, for example 48 hours.

- **Escrow release:** money is released to the host about 24 hours after check-in, giving the guest time to report if the place does not match the listing.

- **Cancellation policy:** chosen by the host from standard options (flexible, moderate, strict) and shown before booking.

- **Check-in instructions:** released only after payment is secured.

- **Reviews:** after every stay, for both guest and host.

- **Local rules:** short lets can be switched off, or limited, for any country or city where local law restricts them.

# 11. Property Management

## 11.1 Landlord and Agent Features

- Register buildings and individual units.

- Record tenants in each unit, with tenancy start and end dates.

- Rent tracking: who has paid, who owes, and when rent is due.

- Automatic rent reminders to tenants before rent is due.

- Automatic receipts for every payment.

- Digital tenancy agreements from standard templates, signed in the app.

- Maintenance requests from tenants, with status (reported, in progress, fixed).

- Expense records per property (repairs, service charge, utilities).

- Notices to tenants from templates. Quit notices are legally sensitive; serving them must follow the applicable law.

- Caretaker role with limited access, set by the landlord.

## 11.2 Tenant Features

- Pay rent in the app.

- View receipts and the tenancy agreement at any time.

- Report repairs with photos.

- Receive rent reminders.

# 12. Rent Financing

Many tenants cannot pay a full year of rent at once. Rent financing lets a tenant pay monthly while the landlord still receives the full rent upfront.

1.  The tenant chooses the monthly payment option on a property page and applies in the app.

2.  A licensed lending partner checks the tenant's eligibility using the tenant's verified identity and information the tenant agrees to share.

3.  If approved, the lender pays the full rent and fees into escrow, and the normal escrow process follows.

4.  The tenant repays the lender monthly. Repayment schedules and reminders appear in the tenant's account.

- Lending is provided by licensed lending partners, chosen per country in the country controls. The interest and charges are set by the lender and shown in full before the tenant accepts.

- The escrow fee applies to the transaction in the normal way.

- Landlords can see that a tenancy is financed, but are paid in full on release like any other tenancy.

# 13. Market Information

## 13.1 Fair Rent Indicator

- Each long-term listing shows whether its rent is below average, about average or above average for similar properties (same type and number of bedrooms) in the same area.

- The comparison uses rents of properties on the platform. It is shown only when there are enough similar properties in the area to make the comparison reliable.

- Landlords and agents see the indicator while setting the rent, before the listing goes live.

- Area rent reports (average rents by area and property type) are available to users and can later support Projectiles' valuation services.

## 13.2 Neighbourhood Information

- Tenants who have rented in an area through the platform can rate it on power supply, water, flooding, security, road access and noise.

- Ratings are combined into area scores shown on the map and on each property page.

- Only verified tenants with a recorded tenancy in the area can rate it, which keeps the scores honest.

# 14. Preventing Transactions Outside the Platform

Some users will try to complete rentals outside the platform to avoid fees. The platform is designed to make this more trouble than it is worth, and to still earn the completed rental fee where escrow is bypassed.

## 14.1 Reasons for Bypassing and Responses

| **Reason**                         | **Platform response**                                                                                   |
|------------------------------------|---------------------------------------------------------------------------------------------------------|
| Avoiding fees by paying cash       | Low fees, and visible loss of protection, receipts and dispute support when paying outside the platform |
| Landlord wants to avoid records    | Property management, receipts and rent tracking only work for tenancies recorded on the platform        |
| Agent wants extra cash on the side | All fees shown upfront; tenants can report extra demands; agent loses badge or is banned                |
| Users swap numbers and leave       | Numbers hidden until inspection; chat warns when users try to share contact or account details          |

## 14.2 Detecting Rentals Completed Outside the Platform

- **Follow-up questions:** after an inspection, both tenant and landlord are asked "Did you rent this property?" Honest tenant answers improve the tenant's rating.

- **Listing behaviour:** a listing removed shortly after several inspections by one tenant is flagged.

- **Property management link:** when a landlord adds a tenant to a unit, the tenancy is recorded and the fee applies.

- **Chat monitoring:** the app automatically detects phone numbers, bank account numbers and similar attempts to move outside the platform, warns the users and logs it. Users are informed of this in the terms of use.

## 14.3 Collecting the Completed Rental Fee

- Charged when the rental is confirmed, payable by card or transfer in the app, by both tenant and landlord.

- Until the fee is paid, the landlord or agent cannot list new properties or use property management features.

- Users agree at registration that the fee is due on any tenancy arising from an introduction made through the platform.

## 14.4 Consequences of Repeated Bypassing

- Lower ranking in search results.

- Loss of verified badge.

- Suspension of listing rights.

# 15. Data Protection and Media Protection

## 15.1 Principles

- The platform complies with the Nigeria Data Protection Act 2023 and with the data protection law of every other country where it operates.

- Only the information needed for each purpose is collected, and it is used only for the purpose stated when it was collected.

- Users give clear consent, in plain language, before identity documents, location or media are collected.

- Projectiles appoints a Data Protection Officer, registers with the Nigeria Data Protection Commission, and carries out a data protection impact assessment before launch and an audit every year.

## 15.2 Personal Information

- Identity documents, selfies and bank details are encrypted and visible only to verification staff who need them. Every view is recorded.

- ID numbers and bank account numbers are shown masked (for example, only the last four digits).

- After verification, identity images are kept only for the period required by law, then deleted.

- A tenant's live location is used only to run "around me" searches and is not stored unless the tenant chooses to save a place.

- Phone numbers stay hidden until an inspection is booked.

- Users can see, correct, download and delete their information from their account settings. Records that the law requires to be kept, such as payment records, are retained for the legal period only.

- Any data breach is reported to the regulator and to affected users within the time the law requires (72 hours in Nigeria).

## 15.3 Protection of Property Images and Videos

Photos and videos of properties belong to the landlord or agent who created them. They are used only to show that property on FindHouseQuick, and for no other purpose.

**Rules on use**

- By uploading, the lister grants Projectiles a limited right to display the media on the listing only.

- Media is never sold, never shared with other companies, never used to advertise other properties or the platform itself, and never used to train artificial intelligence, unless the lister gives separate written consent.

- When a listing is closed, its media is removed from public view. It is kept privately only as verification evidence for a set period, then deleted.

- Users agree in the terms of use not to copy, download or reuse property media. Breaking this rule leads to suspension.

**Technical protection**

- **Visible watermark:** every image and video carries the FindHouseQuick name and the listing number.

- **Hidden watermark:** an invisible mark is embedded in each image, so a copy found elsewhere can be traced to the listing and, where possible, to the account that viewed it.

- **No originals released:** the full-quality original is stored privately. Users only receive display-size copies, and there is no download option.

- **Expiring links:** image and video links stop working after a short time, so they cannot be copied and embedded on other websites.

- **Screenshot and recording blocking:** the Android app blocks screenshots and screen recording on property pages; the iPhone app detects screenshots and records them. The web app disables saving and right-click copying.

- **Location data removed:** the hidden GPS details inside photo files are removed from public copies, so the exact location stays private until an inspection is booked.

- **Automatic blurring:** faces, vehicle number plates, documents and family photographs that appear in property photos are blurred automatically.

- **Scraping protection:** galleries are only shown to logged-in users; unusual viewing patterns (for example one account opening hundreds of listings in minutes) are blocked.

- **Web monitoring:** the platform regularly searches the internet for FindHouseQuick images used elsewhere and issues takedown requests.

- **Staff access:** staff cannot download media in bulk, and every access to original files is recorded.

No technical measure can stop someone photographing a screen with a second phone. The watermarks, monitoring and account bans exist to discourage and trace such misuse.

## 15.4 System Security

- All information is encrypted when stored and when sent between the apps and the server.

- Staff accounts require two-step login. The second step never uses the channel used to sign in. After a password it is offered as an authenticator app code (if set up), then an email code, then an SMS code; after an SMS code, an email code or an authenticator app code; after an email code, an SMS code or an authenticator app code (decisions 29, 34 and 36).

- The staff second step lasts 3 hours, a period super admins can change, and then must be done again. After 5 wrong codes the second step pauses for 15 minutes (decisions 31 and 32).

- Ordinary users will be able to turn on two-step login for their own accounts in a later release (decision 31).

- Staff access is limited by role and by country, as set out in Section 16.

- Independent security testing before launch and at least once a year.

- Daily backups stored in a separate location, with a tested recovery plan.

- Data is stored in the locations each country's law requires.

# 16. Global Operation and Country Controls

The platform is built once and runs in any country. Nothing is fixed to Nigeria in the system itself; every country-specific setting is held in country controls managed by the platform team.

## 16.1 Country Controls

| **Control**              | **What it sets**                                                                                                                         |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Country switch           | Turns a country on or off. A country can also be opened state by state or city by city.                                                  |
| Currency                 | The currency used for listings, fees and payments in that country.                                                                       |
| Language                 | The languages offered to users in that country.                                                                                          |
| Platform fee rates       | The escrow fee and completed rental fee. The standard rates are 1.5% and 2%, paid by each party, and apply unless changed for a country. |
| Taxes                    | Any tax charged on platform fees, such as VAT, at the local rate.                                                                        |
| Identity verification    | The national ID accepted and the verification provider used in that country.                                                             |
| Ownership documents      | The list of title and ownership documents accepted in that country or state.                                                             |
| Land registry link       | The registry used for title checks, where one can be searched.                                                                           |
| Survey coordinate system | The local mapping system used to convert survey plan coordinates to GPS.                                                                 |
| Payment provider         | The licensed payment provider used for escrow and payouts in that country.                                                               |
| Legal templates          | Tenancy agreements, letters of authority and notices that follow local law.                                                              |
| Short let rules          | Whether short lets are allowed, and any limits, by country or city.                                                                      |
| Scout referral reward    | The fixed amount paid to a scout for each first rental they bring in (Section 3.6), in the country's currency.                           |
| Scout invitation expiry  | How long a scout's invitation to a landlord stays valid.                                                                                 |
| Fees shown on listings   | The fee types that appear in the total move-in cost box, matching local practice.                                                        |
| Data protection          | Consent wording, data retention periods and where data is stored, as each country's law requires.                                        |
| Units and formats        | Square metres or square feet, address format, date format and time zone.                                                                 |

## 16.2 Global Controls

- **Feature switches:** any feature can be turned on or off, as set out in Section 17.

- **Restricted countries:** countries where the platform must not operate, for legal or sanctions reasons, can be blocked.

- **Team roles by country:** country managers and verification staff only see and act on users and properties in the countries assigned to them.

- **Head office view:** the Managing Director and head office staff can see all countries, with reports per country and combined.

- **Change record:** every change to a control is recorded with the name of the staff member and the date.

## 16.3 Users Across Countries

- A user verifies once with the identity documents of their own country and can search in any enabled country.

- Each property follows the controls of the country where it is located, whatever the country of the landlord or tenant.

- Payments are made in the currency of the property's country.

# 17. Feature Controls

Every feature of the platform can be switched on or off by authorised staff from the administration panel, without building or releasing a new version of the apps. The apps check the switches each time they open, so changes take effect within minutes.

## 17.1 Features That Can Be Switched

| **Area**           | **Features**                                                                                                                                                |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Search             | Around me search; map search; landmark search; saved area alerts; compare                                                                                   |
| Listings           | Long-term residential rentals; commercial rentals; short lets; 360-degree photos; floor plans                                                               |
| Contact            | Chat; phone number reveal; inspection booking; inspection safety sharing                                                                                    |
| Verification       | Each automatic check individually (satellite, survey plan match, document reading, stolen photo check, registry check); random audits; required site visits |
| Money              | Escrow; completed rental fee; card payments; bank transfer payments; rent financing                                                                         |
| Management         | Property management; digital tenancy agreements; rent reminders; maintenance requests; caretaker role                                                       |
| Market information | Fair rent indicator; area rent reports; neighbourhood ratings                                                                                               |
| Trust              | Ratings and reviews; report button; chat monitoring                                                                                                         |
| Media protection   | Screenshot blocking; automatic blurring; web monitoring                                                                                                     |
| Growth             | Scouts and referral rewards (off by default)                                                                                                                |
| Languages          | Each language individually                                                                                                                                  |

## 17.2 Levels of Control

A feature can be switched on or off at any of these levels:

- **Whole platform:** for every user everywhere.

- **Country, state or city:** for example, short lets switched off in one city only.

- **User type:** for example, a feature available to landlords but not yet to tenants.

- **Selected users:** a feature switched on only for chosen test users before general release.

- **Gradual release:** a feature switched on for a percentage of users (for example 10%), then increased step by step.

## 17.3 Rules and Safeguards

- **Scheduled switching:** a feature can be set to switch on or off at a future date and time, for example for a launch.

- **Emergency switch:** authorised staff can instantly pause payments, new listings or new registrations across the platform or in one country, for example during a fraud attack.

- **Maintenance mode:** the platform or one feature can be closed temporarily with a message explaining when it will return.

- **Dependencies:** the panel warns when switching off a feature that others depend on. For example, switching off escrow means rentals fall under the completed rental fee; switching off chat leaves phone number reveal as the only contact method.

- **Transactions in progress:** a transaction already started continues under the rules in force when it began, even if a feature is switched off.

- **User messages:** when a feature is off, users see a clear message rather than an error.

- **Approvals:** switching a feature off applies at once, so an emergency pause is never delayed; this means an off rule with no start time, end time or percentage (decision 33). Country managers may switch features off in their own countries at once; every other change they make (switching on, scheduling, gradual release, withdrawing a rule) needs a super admin's approval. Switching a critical feature on (payments, escrow, verification, and platform-wide registrations and listings) always needs a second person, one of them a super admin: the Managing Director or a person he appoints (decision 28).

- **Timing:** a switch change reaches every part of the platform within 30 seconds (decision 28).

- **Record of changes:** every switch change is recorded with the staff member, date, time and reason.

# 18. Customer Support and Languages

## 18.1 Customer Support

- **Help centre:** answers to common questions inside the apps and on the website.

- **Support chat:** users can chat with the support team inside the app.

- **WhatsApp:** a FindHouseQuick WhatsApp business line for enquiries.

- **Phone line:** a support number for urgent matters such as payment problems or safety concerns.

- Every enquiry becomes a support ticket with a reference number, so it can be tracked until it is resolved. Response times are set per channel and monitored.

- **At launch:** a help page in the apps and on the website, plus the WhatsApp line and the phone line, run by the support team. In-app support chat and support tickets come in Release 2 (decision 41).

## 18.2 Languages

- **At launch:** English and Nigerian Pidgin are switched on. Yoruba, Igbo, Hausa and French are added to a country's list as their translations are ready and checked (decision 40).

- Further languages are added per country through the country controls.

- Users choose their language in their settings, from the languages switched on for their country; legal documents are also provided in English (decision 40).

# 19. Platform Administration and Reports

## 19.1 Administration Panel

The platform team works through an administration panel, available on the desktop software and web app, to:

- Review amber and red risk score properties and verification documents.

- Confirm agent authority with landlords.

- Resolve flagged duplicate listings.

- Schedule and record site visits and random audits.

- Handle reports, disputes and escrow holds.

- Apply warnings, badge removal and suspensions.

- Monitor fees due and collected.

- Manage country controls and feature controls.

- Manage staff accounts: super admins add staff by confirmed phone number or confirmed email address, set their roles and countries, and deactivate them, with every change recorded. The first super admin is created with a one-time server command (decisions 30 and 38).

- Change platform-wide settings, such as how long the staff second step lasts (decision 32).

- Handle customer support tickets.

## 19.2 Management Reports

Head office and country managers see live reports, by city, state, country and combined:

| **Report**     | **What it shows**                                                         |
|----------------|---------------------------------------------------------------------------|
| Listings       | New, live, rented and expired listings; listings by category and area     |
| Users          | Registrations and verification levels reached, by user type               |
| Verification   | Risk scores, desk reviews, site visits, duplicates caught and fraud cases |
| Escrow         | Money held, released, refunded and disputed                               |
| Income         | Escrow fees and completed rental fees earned and outstanding              |
| Rent financing | Applications, approvals and amounts financed                              |
| Support        | Tickets opened and resolved, and response times                           |
| Market         | Average rents by area and property type                                   |

Reports can be exported for board meetings and accounts.

# 20. Launch Plan

Tenants only come to a platform that already has listings, so landlords and agents are brought on before the platform opens to tenants in each new city.

1.  **Choose the launch city** and the areas within it to cover first.

2.  **Field team:** field officers carry out verification checks only, such as site visits and random audits. Landlords register their own buildings and capture their own properties in the app; the platform does not do this for them, because the manpower needed is not realistic (decision 43). Scouts, ordinary verified users, can also bring landlords onto the app for a referral reward (Section 3.6).

3.  **Agent onboarding sessions:** group sessions where agents are trained on registration, authority letters and listing.

4.  **Partnerships:** landlord associations, estate managers and property developers are approached to list their properties.

5.  **Listing target:** the city opens to tenants once an agreed number of verified listings is live.

6.  **Tenant launch:** promotion through social media, the Agent Emma channel, universities and workplaces in the launch areas.

7.  **Review:** after the first months, results are reviewed before the next city is opened.

# 21. Explanation of Terms

| **Term**                          | **Meaning**                                                                                                                                                           |
|-----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| App / platform                    | The full system, including mobile app, web app and desktop software.                                                                                                  |
| Boundary beacons                  | Concrete markers placed at the corners of a surveyed plot, whose coordinates are written on the survey plan.                                                          |
| Coordinate conversion             | Survey plans in Nigeria often use a different mapping system from phone GPS, so coordinates must be converted before comparison.                                      |
| Desk review                       | A team member checks documents from the office without visiting the property.                                                                                         |
| Escrow                            | A neutral holding arrangement in which money is kept safe and only released when agreed conditions are met.                                                           |
| GPS                               | The phone's satellite location feature, which records exactly where the user is standing.                                                                             |
| KYC (Know Your Customer)          | The process of confirming a user's identity with official documents.                                                                                                  |
| Licensed payment provider         | A company approved by the Central Bank of Nigeria, or the equivalent authority in another country, to hold and move money.                                            |
| Liveness check                    | The app asks the user to blink or turn their head on camera, proving a real person is present.                                                                        |
| NIN                               | National Identification Number in Nigeria; in this document, also the equivalent national identity number in other countries.                                         |
| Feature controls                  | Switches managed by authorised staff that turn individual features on or off, for everyone or for selected places or users.                                           |
| Gradual release                   | Switching a feature on for a small share of users first, then increasing it step by step.                                                                             |
| Emergency switch                  | A control that instantly pauses an activity, such as payments, across the platform or a country.                                                                      |
| Fair rent indicator               | A label showing whether a rent is below, about or above the average for similar properties in the area.                                                               |
| Support ticket                    | A record of a user's enquiry, with a reference number, kept until the matter is resolved.                                                                             |
| Country controls                  | Settings managed by the platform team that decide how the platform works in each country.                                                                             |
| Photo fingerprint                 | A short digital code made from an image, allowing the system to spot the same picture even if resized or cropped.                                                     |
| Data Protection Officer           | The person responsible for making sure the company handles personal information lawfully.                                                                             |
| Data protection impact assessment | A written review of the risks to users' personal information, carried out before launching a system.                                                                  |
| Ledger                            | The app's own detailed record of every amount held, paid in and paid out.                                                                                             |
| Reconciliation                    | Checking that the money in the bank account matches the app's ledger exactly.                                                                                         |
| Watermark                         | A mark placed on an image or video to show where it came from; it can be visible or hidden.                                                                           |
| 360-degree photo                  | A photo that lets the viewer look all around a room by dragging or turning the phone.                                                                                 |
| Expiring link                     | A web address for an image or video that stops working after a short time.                                                                                            |
| Risk score                        | A single rating calculated from all verification checks, used to decide whether a listing is approved, reviewed or visited.                                           |
| Authenticator app                 | A phone app, such as Google Authenticator, that shows a new six-digit code every 30 seconds, used as a second step when signing in.                                   |
| Push notification                 | A message that appears on the phone's screen even when the app is closed.                                                                                             |
| Scout                             | A verified user who brings a landlord and a vacant property onto the app. Not an agent.                                                                               |
| Referral reward                   | A fixed amount Projectiles pays a scout from its own money when the first rental of a property they brought in is completed and the completed rental fee is received. |

# 22. Version History

This specification is kept as one document and updated in place; earlier versions remain in the code repository history (decision 60). Every decision recorded in the Decisions Log that changes what the platform does is written into this document, with the decision number.

| Version              | What changed                                                                                                                                     |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| 1.3, 22 October 2026 | The version given at the start of the build. It reflects decisions 1 to 23 of the Decisions Log.                                                 |
| 1.4, 23 October 2026 | Includes decisions 24 to 63, listed below with where each appears.                                                                               |
| 1.5, 23 October 2026 | Includes decision 64: any action beyond browsing needs level 1 (Section 3.1).                                                                    |
| 1.6, 24 October 2026 | Includes decisions 65 to 70: scouts and the referral reward (Sections 2, 3.6, 8.3, 16.1, 17.1, 20 and 21), and decisions 65 to 69, listed below. |

Decisions 24 to 70 in versions 1.4 to 1.6. Some confirm what this specification already said, or only set when something is built; they are listed so that every decision can be traced. Decisions about how the platform is built, rather than what it does, are in the Technical Architecture and the architecture decision records.

| Decision                                                                                        | Where in this specification                                              |
|-------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| 24\. Technology stack                                                                           | How the platform is built (Technical Architecture); not a product change |
| 25\. Old prototype kept for reference                                                           | Not a product change                                                     |
| 26\. Code repository                                                                            | Not a product change                                                     |
| 27\. Release 0 completed                                                                        | Not a product change                                                     |
| 28\. Feature control approvals; changes reach every server within 30 seconds                    | Section 17.3                                                             |
| 29\. Staff two-step login by SMS code or authenticator app                                      | Section 15.4                                                             |
| 30\. Staff accounts managed by super admins; first super admin by one-time command              | Section 19.1                                                             |
| 31\. 15-minute pause after 5 wrong second-step codes; two-step login for ordinary users later   | Section 15.4                                                             |
| 32\. Staff second step lasts 3 hours, changeable by super admins                                | Sections 15.4 and 19.1                                                   |
| 33\. Meaning of "switching off at once"                                                         | Section 17.3                                                             |
| 34\. Second step a different factor from the sign-in                                            | Section 15.4, as refined by decision 36                                  |
| 35\. Email required; sign up and sign in with phone or email; phone confirmed before any action | Section 3.1 and the level tables in Sections 3.2 to 3.4                  |
| 36\. Second step never uses the sign-in channel, in a set order; password reset by SMS or email | Sections 3.1 and 15.4                                                    |
| 37\. Level 1 needs both phone and email confirmed                                               | Section 3.1 and the level tables                                         |
| 38\. Staff added by confirmed email as well as phone                                            | Section 19.1                                                             |
| 39\. Signed-out visitors see a listing summary only                                             | Section 3.1                                                              |
| 40\. English and Pidgin at launch; users choose their language                                  | Section 18.2                                                             |
| 41\. Customer support at launch; in-app support in Release 2                                    | Section 18.1                                                             |
| 42\. Screen designs in Figma; hosting after a company dollar card                               | How the platform is built; not a product change                          |
| 43\. Landlords register their own buildings; field officers only verify                         | Section 20                                                               |
| 44\. Calls inside the app in Release 1                                                          | Section 7.1                                                              |
| 45\. Inspection time slots                                                                      | Section 7.2, already as specified                                        |
| 46\. Notifications and notification settings                                                    | Section 7.4                                                              |
| 47\. Live updates for chat and inspection status                                                | Section 7.4 (and Section 1.4, already as specified)                      |
| 48\. Saved places and travel distance                                                           | Section 5.4, already as specified                                        |
| 49\. Identity document only when the NIN check fails; accepted documents                        | Section 3.1 and the level tables                                         |
| 50\. Agent company details                                                                      | Section 3.4, already as specified                                        |
| 51\. Badge removal and bans                                                                     | Sections 6.5, 7.2 and 19.1, already as specified                         |
| 52\. Viewing limits per account                                                                 | Section 15.3, already as specified                                       |
| 53\. Switch messages, return times and dependency warnings                                      | Section 17.3, already as specified                                       |
| 54\. Blocking restricted countries before a second country                                      | Section 16.2, already as specified; sets the timing                      |
| 55\. Country settings, including data retention                                                 | Section 16.1, already as specified; sets the timing                      |
| 56\. Distance to the main road, toilets in the checklist, a note per part                       | Sections 5.2 and 5.3, already as specified                               |
| 57\. Ratings and reviews in Release 2                                                           | Section 7.3, already as specified; sets the timing                       |
| 58\. Which automatic checks are in Release 1                                                    | Section 6.3, already as specified; sets the timing                       |
| 59\. Technical points                                                                           | Not a product change                                                     |
| 60\. Documents updated in place                                                                 | Not a product change                                                     |
| 61\. Specification file name without version number                                             | The cover shows the version; not a product change                        |
| 62\. Index of documents                                                                         | Not a product change                                                     |
| 63\. Decision procedure                                                                         | Not a product change                                                     |
| 64\. Actions need level 1 (phone and email confirmed)                                           | Section 3.1                                                              |
| 65\. Passwords keep at least 8 characters                                                       | Not a product change (sign-in rules, ADR 0004)                           |
| 66\. Sign in with Google and Apple in a later release                                           | Section 3.1, already as specified; sets the timing                       |
| 67\. Screen designs made in Penpot                                                              | How the platform is built; not a product change                          |
| 68\. The app's own icon set                                                                     | How the platform is built; not a product change                          |
| 69\. Font: Source Sans 3                                                                        | How the platform is built; not a product change                          |
| 70\. Scouts and the referral reward                                                             | Sections 2, 3.6, 8.3, 16.1, 17.1, 20 and 21                              |
