# ADR 0013: The public website (Release 1 step 5, part 5)

Status: proposed in the step 5 part 5 pull request; takes effect when Emmanuel merges it.

## Context

The public website is what search engines and signed-out visitors see. The Technical Architecture chose Next.js
for it, because the Flutter web app is weak at being found by search engines. This part sets up its code structure
in `web/` and builds the two pages that show listings:
- page 107, search results, and page 108, the listing page, as redrawn in Figma (decisions 75 to 78);
- signed-out visitors see listings in full, without the lister (decision 75);
- both pages also show other properties and FindHouseQuick's own services (decision 77), and a property's photos
  appear only on its own listing (decision 76).

The designs of pages 107 and 108 are approved when pull request #46 is merged. This part is built on that pull
request, so it can only be merged after it.

## Decisions on how it is built

### Structure

- **`web/` is its own small project** (Next.js with the App Router, TypeScript, pnpm), beside `server/` and `app/`.
  It has its own checks in CI: lint, types, unit tests and a build.
- **It holds no data of its own.** Every page is made on the web server from the API's public routes. Nothing
  country-specific is written into it: the currency, the feature switches and the furnishing choices come from the
  API (`/controls`), and amounts are formatted from minor units by the currency's own rules.
- **Pages are made for each request, not stored.** Photo links expire after 15 minutes and listings change, so a
  stored page would show broken photos. (Side note: this is called server-side rendering; the visitor and the
  search engine both receive a complete page.)
- **The design values are one stylesheet** (`web/src/app/globals.css`): the approved colours and text styles from
  `docs/designs.md`. The font, Source Sans 3, is packaged with the site, so no visitor's browser calls Google.
- **One layout for three widths.** The pages follow the 1366, 768 and 360 designs with the same code.
- **Icons** are the app's own set (decision 68), read out of the Penpot design file into
  `web/scripts/penpot-icons.txt` and turned into code by `web/scripts/make-icons.mjs`. Four icons the set lacked (money,
  image, people and lock) were drawn in the same style on 11 November 2026, added to the icon set in the design file,
  and are used on the website.

### Pages

- **`/homes` (page 107).** Filters live in the address (`?city=Benin City&area=GRA&beds=3`), so every search can
  be linked, shared and found. It shows: the results with their total; sorting; filters for category, price,
  bedrooms and furnishing; alerts, "why rent here" and "own a property" panels; newly listed homes; popular areas
  with counts; and "More from FindHouseQuick".
- **`/homes/{id}` (page 108).** The photo mosaic, the facts, photos by room, key details, the description, the
  approximate area, the total to move in with only the country's fee types, similar homes and more homes in the
  area. The lister is not shown; the buttons to book an inspection, chat, save, compare and report lead to sign-in.
- **`/help` (page 110), `/terms` (page 111) and `/privacy` (page 112)**, from the approved Penpot designs.
  - Help: a search over the common questions, the support lines, and the five questions of the design, each
    opening to show its answer.
  - Terms and privacy: the eight sections of each design, with the list of sections beside them. The designs show
    grey lines where the text goes; the text is written in standard terms from what the platform does, and must be
    reviewed by the company's lawyer before any real user signs up.
  - **The words are kept per country** (`web/src/content/ng/` for Nigeria), because laws, regulators and time
    limits differ between countries. A country with no text written gets "not found", never another country's terms.
  - **Contact details are settings,** not text in the code: the support lines, emails and address. One left empty
    is not shown.
- **One header and footer for every page:** the approved public website header and footer from Penpot. The Figma
  redraw of pages 107 and 108 showed a slightly different header; the approved one is used on those pages too.
- **`/` goes to `/homes`** until the home page (page 106) is built.
- **Signing in and everything after it** happens in the signed-in web app, at the address in
  `NEXT_PUBLIC_APP_URL`, with a return address so the visitor comes back to the same page.
- **Links to things not built yet are left out,** not shown dead: "show on map", "homes around me", the language
  button (English is the only language until Release 3), the app store links (until their addresses are set), and
  the "power and water" and "more filters" chips, which the API cannot filter by yet.
- **Feature switches are respected:** short lets, shops and offices, scouts and alerts appear only when their
  switches are on.

### For search engines

- Each page has its own title, description and one preferred address. Filtered and later pages of results are
  marked "do not index", so only the plain page of each place is kept.
- `/sitemap.xml` lists the search page, the popular areas and the newest live listings; `/robots.txt` points to it.
- The listing page carries a short machine-readable description (schema.org), with the city and state only, never
  the address or position (Specification 4.3).
- Photos are not offered to other sites as preview images: their links expire, and they stay on their own listing.

### Viewing limits (decision 52)

- The API counts page views per device and per network address. Because the web server asks the API on the
  visitor's behalf, it **passes on the visitor's network address** and a **device id** it keeps in a cookie
  (a random number for that browser, not a person). Without this, the API would see the web server as one very busy
  visitor and soon refuse everyone.
- For this to be safe, the website must reach the API on its internal address, and both must sit behind the same
  proxies. This is recorded in `docs/DEPLOYMENT.md`.
- A visitor over the limit sees a page asking them to sign in.

### Small additions to the API

- Search results carry `total`, and each listing card carries its `city` and `region`.
- Search can be narrowed by `city`.
- `GET /search/areas` gives the areas with the most live listings, for "popular areas".
- `/controls` now includes the choices for unit details (furnishing and so on), which the filters need.
- Photos from the development storage can be shown on another address (the website's), as a real storage service
  allows.

## Not in this part

- Pages 106 (home) and 109 (sign-in prompt).
- The map: it needs the maps provider.
- A cookie banner: the only cookie is the device number, which the site needs to work and which the privacy policy
  describes; whether a banner is still wanted is for the lawyer's review.
- Languages other than English (Release 3, decision 40).
