# ADR 0014: The app screens (Release 1 step 6)

Status: proposed in the step 6 part 1 pull request; takes effect when Emmanuel merges it.

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
| 3 | Search, the map, the property page and saved items; with screens 10 (location permission) and 11 (not signed in), which belong to search | Screens 10, 11, 22 to 36 and the saved group |
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
- Three code screens have no design of their own: signing in with a code, and confirming the email address or
  phone number. They reuse the approved layout of screen 4 (Enter the code) without the sign-up steps.
- When the sign-up code went by email, screen 5 asks for the phone number to be confirmed, with the same layout.
- The language button on the welcome screen opens a short list of the country's languages.
- Until the wide layouts are built (part 2b), a wide screen shows the phone layout in a column 480 wide.
- Until the Me screen is built (part 6), signing out is a button on the temporary start screen.

## Consequences

- The app now needs the font file and five more packages (`flutter_svg`, `flutter_secure_storage`, `intl`,
  `flutter_localizations`, and `url_launcher` to open the terms and privacy pages).
- On the web, a browser has no protected storage like a phone's; the package encrypts the keys in the browser's
  own storage. This is the usual arrangement for a web app and is looked at again with the security review.
- Pidgin shows English in the app until Projectiles Tech Hub supplies the Pidgin wording (decision 83).
