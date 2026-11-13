# ADR 0014: The app screens (Release 1 step 6)

Status: accepted. Merged in pull request #55 on 11 November 2026; sections 8 and 9 in pull requests #57 and #58
(11 November 2026); section 10 in pull request #59.

## Context

Step 6 builds the screens of the Flutter app in `app/`, for the phone app, the signed-in website and the desktop
software (staff screens only). Every screen is built only from its approved design (`docs/designs.md`,
decision 73). Until this step, `app/` held only a start screen that showed the feature switches.

All the rules stay on the server. The app shows what the server allows and explains what it refuses; it never
decides a verification level, a fee, a limit or a switch itself.

## Decision

### 1. Built in parts, each its own pull request

| Part | What it holds | Designs |
| --- | --- | --- |
| 1 | The foundation: design values, the icon set, the shared parts, the words, and the sign-in session | 00 Design system |
| 2 | Sign-up, sign-in and verification, in three pull requests: (a) the phone layouts of screens 1 to 9; (b) the wide layouts of screens 1 to 9; (c) verification, screens 12 to 21 | Screens 1 to 9 and 12 to 21 |
| 3 | Search, the map, the property page and saved items, in four pull requests: (a) search on the phone, screens 10, 11, 22 and 25 to 29; (b) the map, screens 23 and 24, and the website layouts of the search screens; (c) the property page, screens 30 to 36; (d) saved items, screens 37 to 39 | Screens 10, 11, 22 to 39 |
| 4 | Messages, calls and inspections | The messages, calls and inspections groups |
| 5 | Listing a property, agents and authority | Screens 50 to 65 and the agents group |
| 6 | Me and settings, and the scout screens | The me and settings group; screens 81 to 87 |
| 7 | The staff screens (website and desktop) | Screens 88 to 105 |

Parts 2 to 7 each build the phone layout and the wide layouts of their screens together, from the same parts.
The map in part 3 is built for both maps providers, Google Maps and OpenStreetMap (decision 81, ADR 0015).

### 2. One set of design values, taken from the design file

`app/lib/src/design/tokens.dart` holds the colours, text styles, spacing and corners read from the "00 Design
system" page. A screen uses these names and never writes a colour or a size of its own, so a change to the
design system is made in one place.

The font is Source Sans 3 (decision 69), packed inside the app (`app/assets/fonts/`, under the SIL Open Font
License), so it does not have to be downloaded when the app opens.

### 3. The app's own icons, from one list

The icons are the set drawn in the design file (decision 68). The list read out of the design file is
`web/scripts/penpot-icons.txt`; the website and the app are both made from it (`web/scripts/make-icons.mjs` and
`app/tool/make_icons.mjs`), so the two cannot drift apart. The nine filled icons (used for the current tab of the
bottom bar) were added to the list in this part. A filled icon has details cut out of it in the colour behind it.

### 4. Shared parts

`app/lib/src/design/` holds the parts the design system defines, each built to its measurements: buttons (main,
outline, text only, danger) 52 high, icon buttons, filter chips, tags and the verified badge, the text, phone,
password, code, picker and search fields, radio and tick choices, notices, and the bottom bar with its two sets of
tabs (Properties takes the place of Saved for landlords and agents). Every tappable part is at least 48 high;
errors are written in words under the field; long wording wraps rather than being cut off.

Property cards, conversation rows and map pins are built with the parts that use them (parts 3 and 4).

A page showing every shared part exists for checking against the design file. It is not in the app users get: it
is reachable only when the app is built with `--dart-define=PARTS_GALLERY=true`.

### 5. The words, in each language

The app's words are kept in one file per language in `app/lib/l10n/` (`app_en.arb`, `app_pcm.arb`) and turned
into code by Flutter's own tool (side note: "ARB" is the file format Flutter uses for translations). A word
missing from a language is shown in English. Which languages a user may choose comes from the country's settings
(decision 40). Flutter's own words, such as "Copy" and "Paste", do not come in Pidgin, so Pidgin borrows the
English ones.

The Pidgin file starts empty. Projectiles Tech Hub writes the Pidgin wording itself, later (decision 83); it is
not made up during the build. Until it is supplied, the app shows English when Pidgin is chosen.

### 6. The sign-in session

- The keys the server gives at sign-in (side note: an "access token", which lasts minutes, and a "refresh
  token", which gets a new access token) are kept in the phone's protected storage (Keychain on iPhone, Keystore
  on Android), through the `flutter_secure_storage` package; never in ordinary settings.
- Every request carries the access token. Shortly before it runs out, the app gets a new one. A refresh token
  works once only, so requests made at the same moment share one refresh.
- If the server refuses the refresh, the session has ended: the keys are removed and the app shows sign-in.
  A lost connection does not sign the user out.
- Each installation makes a random identifier on first use and sends it as `X-Device-Id` (viewing limits, and
  the scout conflict checks of ADR 0008). It says nothing about the phone or the person.

### 7. Structure and tests

State is held with Riverpod and pages are reached with go_router, as the start screen already did. Each area of
the app gets a folder under `app/lib/src/`. Each part comes with widget tests for its screens and unit tests for
anything it works out; the shared parts are also checked by eye against the design file at 360 wide.

### 8. Sign-up and sign-in (part 2a, as built)

- The addresses are `/` (welcome, or the start screen when signed in), `/sign-up`, `/sign-up/details`,
  `/sign-up/code`, `/confirm/email` and `/confirm/phone` (each with `/code`), `/sign-in`, `/sign-in/code`,
  `/forgot-password` and `/reset-password`. The website's links to `/sign-up?as=landlord&invitation=CODE`
  (decision 82) choose Landlord and carry the scout's code into the account.
- What the user types during sign-up is kept in memory only, and cleared once the account exists.
- The country's dialling code and flag, and the versions of the terms and privacy policy being agreed to, come
  from `GET /controls`; none is written in the app. The server gained `dialCode` there and the country settings
  `legal.termsVersion` and `legal.privacyVersion`.
- Refusals from the server are shown in the app's own words for the reasons it knows, so they can be translated;
  any other reason is shown as the server wrote it.
- Three code screens are forms of screen 4 (Enter the code) without the sign-up steps: 4b signing in with a
  code, 4c confirming the email address and 4d confirming the phone number (decision 84; drawn in Figma).
- When the sign-up code went by email, screen 5 asks for the phone number to be confirmed, with the same layout.
- The language button on the welcome screen opens a short list of the country's languages.
- Until the Me screen is built (part 6), signing out is a button on the temporary start screen.

### 9. The website layouts of sign-up and sign-in (part 2b, as built)

- From 768 wide (decision 74) every screen is shown in its website layout. A screen is written once: each shared
  part reads which layout it is in (`app/lib/src/design/wide.dart`) and draws itself with the website's
  measurements (rounder corners, heavier labels, larger headings), and the screen moves a few things (names side
  by side, the two ways to get a code in one row, the agreement in a tinted box).
- Sign-up (screens 2 to 5), Forgot password and Set a new password are a white card under a header with the logo
  and "Back to properties", which leads to the public website's list of homes.
- From 1100 wide, sign-up shows a picture beside the card made of the two newest real listings, how many
  properties are available, and "Every lister identity-checked". With no listings, only that last line is drawn.
  The distance on each card in the design is left out, because someone signing up has given no location yet;
  the heart is left out, because it could not do anything there.
- After sign-up, a dark panel beside the card lists what the user can do next.
- Sign in and Sign in paused (screens 6 and 7) are a panel over a dimmed page with a close button. The design
  shows the public home page behind and the words "You stay on this page"; the app shows only the header behind,
  and leaves those words out, because the public pages are a separate site (ADR 0013). Opening sign-in over the
  public page itself is recorded as work still to do with that site.
- Screen 1's website layout is the public home page (page 106), which belongs to the public website and is not
  part of this step.
- The small calendar icon beside "Send the code again" in the website design is not drawn.

### 10. Verification (part 2c, as built)

- The addresses are `/verification` (screen 12, Your verification), `/verification/identity` (screen 14),
  `/verification/check/{id}` and `/verification/company` (screen 21).
- **One address for a check.** Screens 16 to 20 (Checking, You're verified, The face check didn't work, Add an ID
  document, With our verification team) are shown at the one address of the check, whichever matches the check's
  state on the server. Coming back later, or reloading the page, always shows the truth. While a check is being
  made, the app asks the server again every 4 seconds for the first minute, then every 15 seconds.
- **Screen 15, the camera, is not built.** As the design says, the camera is the identity partner's own
  component. No partner is chosen yet, so after the ID number the app goes straight to Checking. This can only be
  reached where the server has a provider: with none, screen 14 says identity checks are not available yet and
  asks for nothing. The partner's camera is added with the partner's adapter (ADR 0007).
- **Screen 13, Verify to continue,** is built as a sheet any screen can open (`showVerifySheet`). It is first
  used in part 3, from the property page.
- The ID type, how its number must look, and the documents accepted as a photo come from `GET /controls` and the
  country's document types; none is written in the app. The words for NIN are in the app's texts; any other ID
  type gets plain words made from its name.
- A photo of an ID document is taken or chosen with the phone's own camera and gallery (`image_picker`), declared
  to the server with its size and fingerprint, sent to private storage, confirmed and attached to the check
  (decision 49). The sign-in token never goes to the storage address.
- The words shown to landlords and agents at each level ("List properties, and message and call tenants") are
  not in the designs, which show a tenant; they are written to match and can be changed.
- The website layouts of these screens use the same card and header as sign-up (section 9). They have not yet
  been compared one by one with their own website designs (screens 12 to 21 at 1366 and 768).
- Until the Me screen is built (part 6), verification is reached from a shield button on the temporary start
  screen.

### 11. Flutter version and the Material parts

- The app is built and tested with Flutter 3.50.0. The same version is set in three places, kept together:
  `.github/workflows/ci.yml`, `scripts/setup-dev.sh` (`FLUTTER_VERSION`) and the lowest version in
  `app/pubspec.yaml`. Flutter is upgraded on purpose, in its own pull request.
- Material and Cupertino come from the packages `material_ui` and `cupertino_ui` (Flutter team), not from
  `package:flutter/material.dart`, which Flutter has marked as outdated. New code imports
  `package:material_ui/material_ui.dart`.
- Flutter's translation tool still writes the old names into the file it makes from the texts; that one warning
  is switched off in that file only (`app/l10n.yaml`).

### 12. Search on the phone (part 3a, as built)

- The main screens sit in a frame with the bottom bar (`app/lib/src/home/main_shell.dart`): Search, Saved (or
  Properties for landlords and agents), Messages, Inspections and Me. Someone looking around without an account
  sees the search screens without the bar, as in screen 11.
- Tabs whose screens come in later parts (Saved, Messages, Inspections) say plainly that they are on their way.
  The Me tab keeps the temporary screen with Verification and Sign out until part 6.
- Screen 22, Home: the search box, "Homes around me", the user's saved places, the kinds of property switched on
  where they are, and the newest homes in the busiest area. The bell (alerts) is left out until notifications
  have a screen (part 4).
- Screen 25, List of results, with screen 28, No results, in its place when nothing matches. No results offers a
  wider search and the same search without one filter, each with how many homes it finds, worked out by asking
  the server. "Show on map" waits for the map (part 3b). The design's "Own a property", "Newly listed",
  "Popular areas" and "More from FindHouseQuick" sections are left out of this part; "Why rent on
  FindHouseQuick" is in.
- Screen 26, Filters: the counts on its button come from the server as the filters change. The property types
  come from the country's reference list; the furnishing choices from the country settings.
- Screen 27, Search by area or landmark: places come from the server's place search (`GET /search/places`) and
  areas from the popular areas. A row of distances (500 m, 1 km, 3 km, 5 km) is added above the places, because
  the screen's own words ask the user to "set how far from it to look" and the design has no other way to do so.
  Recent searches are kept on the phone only, never "around me" locations (Specification 15.2).
- Screen 29, Save this area: the area is the circle the search used, around the user or a landmark; saving is
  offered only for those searches. The map picture of the area waits for the maps provider; until then the area
  is described in words.
- Screen 10, Location permission, is shown once, before the phone first asks; the location is read for that one
  search and never stored.
- Screen 11, Not signed in: the homes in the switched-on city and the invitation to create an account.
- A listing opens on the public website (page 108) until the property page is built in part 3c.
- These screens use the phone layout on wide screens, in a column 600 wide, until their website layouts are
  built (part 3b).
- The distance row on screen 27 was decided by Emmanuel on 13 November 2026 (decision 85), and the Penpot design
  of screen 27 was updated to show it (phone; the website layouts in progress).

### 13. The property page and the map (parts 3b and 3c, in progress)

- Screen 30, the property page, follows the approved Figma designs at 360, 768 and 1366, with their exact
  measurements: buttons with corners of 8 and a 1.5 outline, badges, chips 39 high, and the gaps between boxes
  (12 on the phone, 16 on the website). Its website layout uses the website header and footer drawn in Figma.
- Two states the designs did not show were designed in Figma first (frames 30a and 30b, phone and 1366): "This
  home is no longer listed", and "Sign in to keep viewing homes" when the viewing limit is reached (decision 52).
- "Book a free inspection" and "Chat with the lister" need level 2 on the server. Signed-out visitors go to sign
  in; anyone not yet verified sees screen 13, Verify to continue. The booking and chat screens come in part 4;
  until then a verified user is taken to the Inspections or Messages tab.
- The share and video icons were added to the app's icon set from the Figma design.
- The map: one map part for every screen (`app/lib/src/search/map_view.dart`, using the `flutter_map` and
  `latlong2` packages), drawing the picture from whichever provider the server names through `GET /maps/tiles`,
  with the provider's credit always shown. With no provider set, the screens show that the map is not available.
  Screens 23 (Map) and 24 (Around me), screens 31 to 36 and the website layouts of screens 22 to 29 follow, from
  their Penpot designs.

## Consequences

- The app now needs the font file and five more packages (`flutter_svg`, `flutter_secure_storage`, `intl`,
  `flutter_localizations`, `url_launcher` to open the terms and privacy pages, `image_picker` and `crypto`
  for photos of ID documents, and `geolocator` for "around me").
- On the web, a browser has no protected storage like a phone's; the package encrypts the keys in the browser's
  own storage. This is the usual arrangement for a web app and is looked at again with the security review.
- Pidgin shows English in the app until Projectiles Tech Hub supplies the Pidgin wording (decision 83).
