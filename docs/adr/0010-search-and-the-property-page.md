# ADR 0010: Search, the property page and saved items (Release 1 step 5, part 2)

Status: proposed in the step 5 part 2 pull request; takes effect when Emmanuel merges it.

## Context

Part 2 of step 5 (ADR 0009) lets tenants and visitors find listings and see them. It follows:
- Product Specification Sections 4.1 to 4.3, 5.4 and 15.2;
- decision 48 (saved places), decision 52 (viewing limits), decision 75 (signed-out visitors see listings in full,
  without the lister) and decisions 77 and 80 (similar and nearby listings).

## Decisions on how it is built

### What can be found

- **Which listings appear.** Only live listings in switched-on cities and states appear, and only the kinds of
  rental switched on for the caller: long-term, commercial, and short lets (off by default).
- **One query for everything.** "Around me", landmark, map and area search, and every filter, are one database
  query on the building's position (PostGIS).
- **Before an inspection is confirmed** (Specification 4.3):
  - a listing's map position is moved by 40% to 100% of the country setting `listings.approximateLocationMetres`
    (default 300 m), in a direction and distance worked out from the listing's id, so it always lands in the
    same place and cannot be averaged out;
  - distances are rounded to the nearest 100 m.
- **Zoomed-out maps** (below zoom 13): pins come back as groups, each placed at the centre of its grid square,
  never at a listing's own position.
- **Pages** of 20 results, with a cursor.
- **Landmark search for now.** It finds the area names and landmarks that listers typed in. Proper place search,
  nearby amenities and travel times need a maps provider (Google Maps or OpenStreetMap, decision 81; `docs/adr/0015-maps-providers.md`), which is
  connected when its account is opened. Until then, nearby amenities are empty and travel distance to saved places is a straight line.

### The property page

- Those who manage a listing get its owner view (ADR 0009), whatever its state.
- Everyone else gets the property page of a live listing, in full: details, costs, photos by part and the
  approximate position.
- Signed-in users also see the lister and the distance to their saved places (decisions 48, 75 and 80).
- The exact position is never returned yet; it comes with confirmed inspections in part 4.
- The walkthrough video is not shown until its watermarked copy exists (ADR 0009).
- Similar homes and more homes in the area come from `GET /listings/{id}/related`:
  - **similar:** the same property type and rent period, rent within 25% either way, within 5 km;
  - **more in the area:** the same area name or within 2 km.
  Distances from one listing to another are not shown, because they would point to where the first one is.

### Viewing limits (decision 52)

- Opening property pages is counted in Redis, per hour, so every server shares the counts:
  - per signed-in account (platform setting `listingViewsPerHour`, default 120);
  - without sign-in, per device and network address (`signedOutListingViewsPerHour`, default 60), with a wider
    limit per address whatever device it claims to be (`signedOutViewsPerAddressPerHour`, default 300).
- Over the limit, the answer is `429 VIEW_LIMIT` with the seconds until the next hour.
- The apps send their own device id in `X-Device-Id`.
- If Redis cannot be reached, the page is still shown and the gap is logged: a short lapse in copy protection is
  better than the site failing.
- Behind proxies such as Cloudflare, the server must take the visitor's address from the header the proxies add.
  The new server setting `TRUST_PROXY_HOPS` says how many proxies to trust. Without it, all signed-out visitors
  would share one address and one limit.

### Saved items

- **Saved areas** (Specification 4.2) are a drawn shape or a circle, with filters and an alerts switch, stored as
  a PostGIS polygon. There are at most 20 per user. The alerts themselves are sent with notifications in part 3.
- **Saved places** (decision 48), such as an office or school, are stored only when the user saves one
  (Specification 15.2). There are at most 10 per user.
- **Favourites:** saving twice is harmless. Favourites that are no longer live drop out of the list. There are at
  most 200 per user.
- Saving anything needs verification level 1 (decision 64).

## Consequences

- The `ioredis` package is added as a direct dependency; it was already used underneath the job queues.
- New platform settings: `listingViewsPerHour`, `signedOutListingViewsPerHour` and
  `signedOutViewsPerAddressPerHour`.
- New country setting: `listings.approximateLocationMetres`.
- New server setting: `TRUST_PROXY_HOPS`.
- A new table, `SavedPlace`.
