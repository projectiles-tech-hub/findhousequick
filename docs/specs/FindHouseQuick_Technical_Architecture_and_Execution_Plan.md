**FindHouseQuick**

Technical Architecture and Execution Plan

Projectiles Tech Hub Limited

Emmanuel Chukwuka Oraegbu, Managing Director

Version 1.3 \| 29 October 2026

# Contents

1\. About This Document

2\. Delivery Approach

3\. Team and Roles

4\. Way of Working

5\. Workstreams Outside Software

6\. Main Risks

7\. System Architecture

8\. Technology Choices

9\. API Design

10\. Escrow Technical Design

11\. Media Processing

12\. Country and Feature Controls

13\. Data and Security

14\. Design for Local Conditions

15\. Release 0: First Tasks

16\. Explanation of Terms

# 1. About This Document

This document sets out how FindHouseQuick will be built and delivered. It should be read together with the FindHouseQuick Product Specification, which describes what the platform does. Where the two documents differ, the Product Specification decides what is built; this document decides how.

The technology choices in this document are recommendations. They should be reviewed and confirmed by the technical lead once appointed, before Release 1 development starts.

# 2. Delivery Approach

## 2.1 Principle

The platform is built and launched in three releases, rather than all at once. Each release is complete and usable on its own, so the platform can launch, learn from real users and start earning before every feature is finished.

Two foundations are built from the very start, even though only one city will be switched on at launch:

- **Country controls:** so the platform can later open in any country without being rebuilt.

- **Feature controls:** so any feature can be switched on or off without releasing a new version of the apps.

## 2.2 Releases

| **Release**                | **Contents**                                                                                                                                                                                                                                                                                                                                                          | **Goal**                                                                  | **Estimated time**     |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|------------------------|
| 0\. Foundations and design | Screen designs for every user type: 115 screens, on the phone app (87), the website (115) and the desktop software (21, staff screens only), 223 designs in all, listed in docs/designs.md (decisions 73 and 75); database design; API design; code repository, test and live systems; country and feature controls framework                                         | A solid base for everything that follows                                  | 4 to 6 weeks           |
| 1\. Launch version         | Registration and verification ladder; property categories and part-by-part media capture; search, map and "around me"; property page; chat and inspection booking; duplicate checks and basic risk score; media protection; admin panel; English and Pidgin; scouts: opting in, reporting vacant properties, inviting landlords and the referral record (decision 72) | Prove that landlords will list and tenants will search in the launch city | 3 to 4 months          |
| 2\. Money                  | Escrow with full safeguards; completed rental fee, with scout referral reward payouts (decision 72); digital tenancy agreements; short lets; property management; customer support tools; management reports                                                                                                                                                          | Start earning                                                             | 2 to 3 months          |
| 3\. Growth                 | Survey plan matching; document reading; registry checks; rent financing; fair rent indicator; neighbourhood ratings; remaining languages; second city, then other countries                                                                                                                                                                                           | Scale and stand out                                                       | 3 months, then ongoing |

Times are estimates for a small dedicated team as described in Section 3, working full time. They will be firmed up by the technical lead after Release 0.

# 3. Team and Roles

| **Role**                                  | **Responsibility**                                                                                       | **When needed**          |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------|--------------------------|
| Product owner (Emmanuel Chukwuka Oraegbu) | Decides what is built; approves each release; settles open decisions; accepts or rejects finished work   | Throughout               |
| Technical lead                            | Owns the architecture and code quality; reviews all code; runs releases; accountable for the live system | Before Release 0 starts  |
| App developer (Flutter)                   | Mobile, desktop and web app screens                                                                      | Release 0 onwards        |
| Server developers (one or two)            | API, database, background jobs, integrations                                                             | Release 0 onwards        |
| Designer (part-time)                      | Screen designs, branding, usability                                                                      | Release 0 and as needed  |
| Claude (AI assistant)                     | Writes code, documents and tests alongside the team, working from the shared code repository             | Throughout               |
| Verification team                         | Desk reviews, agent authority confirmation, site visits                                                  | Before Release 1 launch  |
| Field team                                | Signs up landlords and agents; captures properties on site                                               | Last months of Release 1 |
| Customer support                          | Help centre, support chat, WhatsApp and phone                                                            | Release 1 launch         |
| Lawyer                                    | Escrow structure, data protection, terms of use, tenancy templates                                       | Now                      |

# 4. Way of Working

## 4.1 Work Cycles

- The Product Specification is broken into small tasks. Each task has a written description of what "done" means.

- Work runs in two-week cycles. At the end of each cycle the team shows working features on real phones, and the product owner accepts or rejects them.

- New ideas raised during a release are recorded and scheduled for a later release, rather than added mid-cycle, unless the product owner decides otherwise.

## 4.2 Systems

| **System**         | **Purpose**                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------|
| Developer machines | Where code is written and first tested                                                                     |
| Test system        | A full copy of the platform with test data, where new work is checked and demonstrated                     |
| Live system        | The platform real users see. Nothing reaches it without passing automated tests and product owner approval |

## 4.3 Ownership and Records

- All code is kept in a GitHub repository owned by Projectiles Tech Hub Limited, so the company owns the code regardless of who writes it.

- All cloud, app store, payment and service accounts are opened in the company name, with the Managing Director holding the master access.

- Every part of the system is documented in the repository, so no single person holds knowledge that others cannot access.

- A decisions log records every product decision and open point. It is read before any new piece of work starts.

# 5. Workstreams Outside Software

| **Workstream**       | **What must happen**                                                                                                                                                 | **Deadline**                                                        |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| Legal and regulatory | Escrow legal structure confirmed; registration with the Nigeria Data Protection Commission; terms of use, privacy policy, escrow terms and tenancy templates drafted | Escrow structure before Release 2; the rest before Release 1 launch |
| Company accounts     | GitHub, cloud hosting, Google Play and Apple developer accounts, domain name, identity provider, payment collection service, escrow bank accounts                    | Release 0                                                           |
| Brand                | Domain name and trademark registration for FindHouseQuick; logo and brand colours                                                                                    | Release 0                                                           |
| Operations           | Hire and train verification, field and support teams; write their procedures                                                                                         | Before Release 1 launch                                             |
| Supply               | Sign up landlords and agents in the launch city until the listing target is reached                                                                                  | Before tenant launch                                                |
| Finance              | Budget for development, running costs and staff for at least 12 to 18 months                                                                                         | Before hiring                                                       |

# 6. Main Risks

| **Risk**                    | **Effect**                               | **How it is managed**                                                                       |
|-----------------------------|------------------------------------------|---------------------------------------------------------------------------------------------|
| Escrow regulation           | Escrow could be stopped or penalised     | Legal clearance before any money moves; escrow can be switched off through feature controls |
| Running out of money        | Project stalls before earning            | Strict release plan; new ideas scheduled for later releases; monthly budget review          |
| Too few listings at launch  | Tenants try the app and leave            | Field team and onboarding before tenant launch; listing target must be met first            |
| Dependence on one developer | Work stops if that person leaves         | Company-owned code, documentation and code reviews                                          |
| Fraud                       | Loss of money and trust                  | Verification ladder, risk score, emergency switch, two-person approvals, audit trail        |
| Data breach                 | Legal penalties and loss of trust        | Encryption, restricted access, security testing, breach response plan                       |
| Third-party service failure | Identity checks or payments stop working | Plug-in design allows switching to another provider; monitoring alerts                      |

# 7. System Architecture

## 7.1 Overview

The system has four layers:

1.  **Apps:** mobile app, web app, desktop software and admin panel. They display information and collect input, but hold no business rules of their own.

2.  **Central server and API:** holds every rule of the platform (verification ladder, fees, escrow, country and feature controls). All apps work only through the API.

3.  **Background workers:** carry out heavy or scheduled work out of sight, such as photo processing, verification checks, notifications and daily escrow reconciliation.

4.  **Storage and outside services:** the database, file storage, and connections to identity, payment, map, SMS and other services.

## 7.2 Modular Monolith

The server is built as a modular monolith: one program divided into clearly separated modules, each responsible for one area. This is simpler and cheaper to build and run than many separate services. Any module can be split into a separate service later if it grows; escrow is the most likely candidate.

| **Module**                 | **Responsibility**                                                                |
|----------------------------|-----------------------------------------------------------------------------------|
| Accounts and identity      | Registration, login, verification levels, identity provider connections           |
| Listings                   | Buildings, units, categories, property details, agent authority, listing status   |
| Media                      | Upload, processing, protection and delivery of photos and videos                  |
| Verification               | Automatic checks, risk score, duplicate detection, review and site visit workflow |
| Search                     | Map, area, landmark and "around me" search; saved area alerts                     |
| Messaging                  | Chat, chat monitoring, notifications, SMS                                         |
| Inspections                | Booking, confirmation, inspection safety sharing, follow-up questions             |
| Escrow and payments        | Payments in and out, ledger, escrow stages, disputes, reconciliation, fees        |
| Short lets                 | Calendar, bookings, cancellation policies, caution deposits                       |
| Property management        | Tenancies, rent tracking, receipts, agreements, maintenance, expenses             |
| Financing                  | Rent financing applications and lender connections                                |
| Market information         | Fair rent indicator, area reports, neighbourhood ratings                          |
| Controls                   | Country controls and feature controls                                             |
| Administration and reports | Admin panel functions, support tickets, management reports                        |

# 8. Technology Choices

| **Part**                              | **Recommended technology**                          | **Reason**                                                                       |
|---------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------|
| Mobile, desktop and logged-in web app | Flutter                                             | One codebase for Android, iPhone, web, Windows and Mac                           |
| Public website                        | Next.js                                             | Lets search engines find and show listing summaries; Flutter web is weak at this |
| Central server and API                | Node.js with NestJS, written in TypeScript          | Well structured for large systems; developers widely available in Nigeria        |
| Main database                         | PostgreSQL with PostGIS                             | Reliable; fast location searches                                                 |
| Fast temporary memory                 | Redis                                               | Speed, rate limits and job queue                                                 |
| Background jobs                       | BullMQ                                              | Runs processing and scheduled tasks reliably                                     |
| File storage and delivery             | Private cloud storage with a CDN and expiring links | Fast delivery worldwide while protecting media                                   |
| Media processing                      | FFmpeg and image processing libraries               | Watermarks, location data removal, blurring, thumbnails, photo fingerprints      |
| Live updates and chat                 | WebSockets                                          | Instant messages and status updates                                              |
| Push notifications                    | Firebase Cloud Messaging                            | Works on Android and iPhone                                                      |
| Feature controls                      | Unleash (open source) or a custom module            | Switching, gradual release, scheduling                                           |
| Document reading                      | Google Document AI or AWS Textract                  | Reads title documents and survey plans                                           |
| Maps                                  | Google Maps, or Mapbox to reduce cost               | Maps, distances, satellite images, directions                                    |
| Hosting                               | AWS or Google Cloud, using containers               | Scales with growth; region chosen to meet each country's data laws               |
| Code, testing and release             | GitHub with automated testing and deployment        | Nothing reaches users without passing tests                                      |
| Monitoring                            | Sentry and Grafana                                  | Alerts the team to problems before users notice                                  |

# 9. API Design

## 9.1 FindHouseQuick API

Every app does everything through the FindHouseQuick API. The verification ladder, fees and feature switches are enforced in the API, so they cannot be bypassed by tampering with an app.

- **Style:** REST API using JSON for most actions; WebSockets for chat and live updates.

- **Versions:** the API carries a version number (v1, v2) so older copies of the apps keep working when the API is improved.

- **Security:** each request carries a login token showing who the user is and what their verification level allows.

- **API gateway:** a single front door that checks tokens, applies rate limits and records every request.

- **Rate limits:** caps on requests per account to block scraping and attacks.

- **Documentation:** written in the OpenAPI standard and kept in the code repository.

## 9.2 Main API Areas

| **Area**            | **Examples of what it handles**                                                    |
|---------------------|------------------------------------------------------------------------------------|
| Accounts            | Register, log in, submit identity documents, verification status                   |
| Listings            | Create buildings and units, enter details, request agent authority, publish, close |
| Media               | Start an upload, resume an interrupted upload, fetch display copies                |
| Search              | Search by map area, distance, landmark and filters; saved alerts                   |
| Messaging           | Send and receive chat messages; notification settings                              |
| Inspections         | Book, confirm, cancel, share safety details                                        |
| Escrow              | Start a transaction, pay, confirm keys and move-in, raise disputes, view receipts  |
| Short lets          | Check availability, book, cancel, check in and out                                 |
| Property management | Tenancies, rent records, agreements, maintenance requests, expenses                |
| Controls            | Read the country settings and feature switches that apply to the user              |
| Administration      | Reviews, site visits, disputes, controls, reports (staff only)                     |

## 9.3 Outside Services

| **Service**                                                 | **Purpose**                                                  |
|-------------------------------------------------------------|--------------------------------------------------------------|
| Identity providers (for example Smile ID, Dojah or Prembly) | NIN, selfie and liveness checks                              |
| Paystack or Flutterwave                                     | Collecting payments and making payouts                       |
| Bank APIs                                                   | Escrow account statements for daily reconciliation           |
| Google Maps or Mapbox                                       | Maps, distances, satellite images, directions                |
| Google Document AI or AWS Textract                          | Reading title documents and survey plans                     |
| Reverse image search                                        | Stolen photo checks and monitoring of platform images online |
| Termii or Twilio                                            | SMS codes                                                    |
| Firebase                                                    | Push notifications                                           |
| WhatsApp Business API                                       | Customer support                                             |
| Lending partners                                            | Rent financing                                               |
| Land registries                                             | Title checks, where electronic access exists                 |

Each outside service connects through its own plug-in (adapter). The rest of the system does not depend on which company is behind each plug-in, so providers can be changed, and new countries added, without rewriting the system. Services that report events back to the platform, such as payment confirmations, do so through webhooks, which move transactions forward automatically.

## 9.4 Partner API

A partner API for agencies, estate managers, developers and lenders is under consideration and is not yet approved. If approved, partners would receive their own access keys, limits and a test version.

# 10. Escrow Technical Design

- **Double-entry ledger:** every movement of money is recorded as leaving one account and entering another, so the records always balance.

- **Unchangeable records:** ledger entries are never edited or deleted; corrections are made with new entries.

- **No double processing:** every payment request carries a unique reference, so a request sent twice over a poor network is processed only once.

- **Daily reconciliation:** a background job compares each escrow bank account with the ledger every day and alerts management to any difference.

- **Restricted access:** only named staff roles can use escrow functions; large manual actions need two approvals.

- **Separate permissions:** the escrow module runs with its own access rules and keys, separate from the rest of the system.

# 11. Media Processing

Every photo and video passes through these steps before anyone can see it:

1.  Captured in the app on site, with GPS location and time recorded.

2.  Uploaded in small pieces, so an interrupted upload resumes rather than restarting.

3.  Original stored in private storage that no user can reach.

4.  Quality check for blur, darkness and resolution.

5.  Photo fingerprint created and compared for duplicates and stolen images.

6.  Faces, number plates and documents blurred automatically.

7.  Hidden location data removed from public copies.

8.  Visible and hidden watermarks added.

9.  Display copies made in several sizes for different screens and connection speeds.

10. Display copies delivered through the CDN using links that expire.

# 12. Country and Feature Controls

- Country settings and feature switches are stored centrally and read by the server on every request that depends on them.

- The apps download the switches that apply to them when they open, and refresh them regularly, so changes take effect within minutes without an app update.

- Every rule in the system (fees, time periods, accepted documents, categories, languages) reads its value from the controls rather than being written into the code.

- Every change to a control is recorded with the staff member, time and reason.

# 13. Data and Security

- Encryption of all stored data and of all data in transit.

- Encryption keys held in a dedicated key vault provided by the cloud host.

- Identity documents and originals of media stored separately from other data, with access recorded.

- Web firewall in front of the API gateway.

- Two-step login for all staff; role-based and country-based staff access.

- Automated security scanning of code on every change; independent security testing before launch and yearly.

- Daily backups in a separate location; recovery tested regularly.

# 14. Design for Local Conditions

- Apps run well on low-cost Android phones.

- Small images load first on slow connections; full quality on request.

- Listings already viewed remain available with a weak or no connection.

- Uploads resume after interruptions.

- Data use is kept low, and users can choose a data saver setting.

# 15. Release 0: First Tasks

1.  Create the Projectiles GitHub account and the FindHouseQuick repository.

2.  Set up the code structure for the server, apps and public website, with coding standards and automated tests.

3.  Design the database, including buildings, units, users, verification levels, country controls and the escrow ledger.

4.  Write the API design in the OpenAPI standard for the Release 1 areas.

5.  Build the country and feature controls framework.

6.  Set up the test system on the cloud host.

7.  Produce screen designs for tenants, landlords, agents and staff.

8.  Product owner review and approval of Release 0 before Release 1 begins.

# 16. Explanation of Terms

| **Term**            | **Meaning**                                                                                                                  |
|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| Adapter (plug-in)   | A piece of code that connects the platform to one outside service, so the service can be replaced without changes elsewhere. |
| API                 | Application Programming Interface: an agreed set of requests and responses that lets one piece of software use another.      |
| API gateway         | A front door through which every API request passes for security checks and limits.                                          |
| CDN                 | Content Delivery Network: servers around the world that hold copies of images and videos close to users.                     |
| Containers          | A standard way of packaging software so it runs the same on any server.                                                      |
| Double-entry ledger | An accounting record where every movement of money is entered twice, so the books always balance.                            |
| GitHub repository   | An online store for code that keeps every version and allows a team to work on it together.                                  |
| JSON                | A simple text format for data sent between apps and servers.                                                                 |
| Modular monolith    | One program divided into well-separated modules.                                                                             |
| OpenAPI             | A standard way of writing down how an API works.                                                                             |
| Product owner       | The person who decides what the software does and accepts finished work.                                                     |
| REST                | A common style for building APIs.                                                                                            |
| Token               | A digital pass issued at login that proves who a user is on each request.                                                    |
| Webhook             | An automatic message from one system to another when something happens.                                                      |
| WebSockets          | A live connection that lets the server send updates to an app instantly.                                                     |
