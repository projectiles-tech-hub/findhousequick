import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'config/app_config.dart';
import 'session/token_store.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment);

/// Where the sign-in keys are kept. Tests replace it with one kept in memory.
final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  final config = ref.watch(appConfigProvider);
  return ApiClient(config, tokens: ref.watch(tokenStoreProvider), deviceId: loadDeviceId())
    ..location = LocationContext(countryCode: config.defaultCountry);
});
