# ADR 0015: Maps providers (Google Maps and OpenStreetMap)

Status: accepted. Merged in pull request #56 on 11 November 2026 (decision 81).

## Context

Decision 81: the platform is prepared for two maps providers, Google Maps and OpenStreetMap, and which one is used
is a setting. Mapbox is no longer planned.

Maps are used in four ways:

| Use | Who does it | What it is for |
| --- | --- | --- |
| The map picture | The apps and the website | Drawing the map with pins on it |
| Place search | The server | Finding an area, street or landmark by name |
| Nearby amenities | The server | Schools, hospitals, markets and the like near a property |
| Travel times | The server | Distance and minutes from a property to a tenant's saved places (decision 48) |

The two providers differ:

- **Google Maps** uses Google's own data, which is fuller for streets and landmarks in Nigerian cities. Google
  charges for each request above a free monthly allowance. It needs a Google Cloud project and one key.
- **OpenStreetMap** is free map data made by volunteers; its coverage of Nigerian cities is thinner. The data is
  free, but something must serve it: a paid host, or servers the company runs itself. The OpenStreetMap project's
  own public servers are for light use only and must not carry a live platform's traffic.

## Decision

### 1. One adapter per provider, behind one interface

`server/src/integrations/maps/` holds the interface (`maps-provider.ts`) and three adapters:

- `google`: the Places API (New) for place search and nearby amenities, and the Routes API for travel times.
- `openstreetmap`: three services built on OpenStreetMap data. Nominatim for place search, Overpass for nearby
  amenities, and OSRM for travel times (side note: these are the standard free programs for each job; a host, or
  the company, runs them). The address of each is a setting.
- `none`: no maps service. Place search by the provider finds nothing, no amenities are listed and travel times
  are unknown. This is the default, and is how the platform behaved before this change.

### 2. The provider is chosen per use

`MAPS_PROVIDER` chooses the provider for every use. Each use can be sent elsewhere with its own setting
(`MAPS_PLACES_PROVIDER`, `MAPS_AMENITIES_PROVIDER`, `MAPS_TRAVEL_PROVIDER`), so the two can be used together: for
example OpenStreetMap for the uses where its data is good enough, and Google Maps for the rest.

The server refuses to start if a chosen provider is missing its key or its server address, so a mistake is found
at once and not by a user.

### 3. Amenity kinds are the platform's own

The platform has its own short list of amenity kinds (school, hospital, pharmacy, market, bank, fuel station, bus
stop, place of worship, police). Each adapter translates them into its provider's categories. Which kinds a
country shows will be a country setting when the property page uses them.

### 4. A maps service that fails never breaks a page

Each request gives up after `MAPS_TIMEOUT_MS` (4 seconds unless set). A failure is reported to the caller as
"maps unavailable", and the caller carries on without that information.

## What is built now, and what is not

Built: the interface, the three adapters, the settings and their checks, with tests that stand in for each
provider's service. **Neither adapter has been tried against the real service**, because no Google Cloud account
and no OpenStreetMap host exists yet; the first step after an account is opened is to try each call for real.

Not built yet:

- **Travel times** to the user's saved places on the property page: still straight-line distances. Each one is
  asked per user and per listing, so it is left until the cost is known once the account exists.

## Built in step 6 part 3 (13 November 2026)

- **Place search** (`GET /search/places`) lists the areas and landmarks named on our own listings first, then the
  provider's places in the country, near the city when only one city is open.
- **Nearby amenities** on the property page, measured from the approximate position and rounded to 100 m like every
  other distance, so they do not point to the building. Which kinds, how far and how many are country settings
  (`maps.amenityKinds`, `maps.amenityRadiusMetres`, `maps.amenityLimit`).
- **Answers are kept** in the database for the country's `maps.keepAnswersDays` (side note: a "cache"), shared by
  every server, so the same question is paid for once; the hourly job clears old ones. If the provider fails, the
  last answer kept is used, or nothing.
- **The map picture**: `GET /maps/tiles` tells the apps where to fetch it (a Google Map Tiles session, made per
  language and country, or an OpenStreetMap tile host), with the credit to show. Settings: `MAPS_TILES_PROVIDER`,
  `GOOGLE_MAPS_TILES_KEY`, `OSM_TILES_URL`, `OSM_TILES_ATTRIBUTION`.
- **The satellite check** of a building's location (Specification Section 6): OpenStreetMap has no satellite
  pictures, so that check needs Google Maps or another source of pictures.
- **The directions link** after an inspection is confirmed still opens Google Maps (ADR 0012).

## Consequences

- With `MAPS_PROVIDER` left as `none`, nothing changes for users.
- Google Maps brings a running cost that grows with use; OpenStreetMap brings either a host's fee or servers to
  look after.
- Both providers require their credit to be shown on the map ("© OpenStreetMap contributors"; Google's logo). The
  apps will show it when the map is built.
