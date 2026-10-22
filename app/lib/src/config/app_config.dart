/// Build-time settings. Override with --dart-define, for example:
///
///   flutter run --dart-define=API_BASE_URL=https://api.findhousequick.com/v1
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.defaultCountry});

  final String apiBaseUrl;

  /// Country used until the user's location or account says otherwise.
  final String defaultCountry;

  static const AppConfig fromEnvironment = AppConfig(
    apiBaseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/v1'),
    defaultCountry: String.fromEnvironment('DEFAULT_COUNTRY', defaultValue: 'NG'),
  );
}
