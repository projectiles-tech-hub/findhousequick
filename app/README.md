# FindHouseQuick app

One Flutter codebase for Android, iPhone, web, Windows and Mac.

## Run

```bash
flutter pub get
flutter run                                   # pick a device
flutter run -d chrome                         # in the browser
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/v1   # Android emulator talking to a local server
```

The API server must be running (see `../server`). For the web app, the server's `CORS_ORIGINS` must include the
address the app is served from.

## Structure

| Folder | Contents |
| --- | --- |
| `lib/src/config` | Build-time settings (`--dart-define`) |
| `lib/src/api` | API client and error handling |
| `lib/src/controls` | Feature switches and country settings from the server; `FeatureGate` widget |
| `lib/src/theme` | Colours and styles (placeholder until the brand is designed) |
| `lib/src/home` | Release 0 start screen |

## Rules

- The server decides everything; the app asks and displays. Never put business rules only in the app.
- Wrap feature-specific UI in `FeatureGate(feature: '...')` so switched-off features are hidden.

## Checks

```bash
flutter analyze
flutter test
```
