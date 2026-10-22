import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../providers.dart';

/// Country details and settings the app is allowed to see.
class CountryInfo {
  const CountryInfo({
    required this.code,
    required this.name,
    required this.currency,
    required this.languages,
    required this.defaultLanguage,
    required this.settings,
  });

  final String code;
  final String name;
  final String currency;
  final List<String> languages;
  final String defaultLanguage;
  final Map<String, dynamic> settings;

  factory CountryInfo.fromJson(Map<String, dynamic> j) => CountryInfo(
        code: j['code'] as String,
        name: j['name'] as String,
        currency: j['currency'] as String,
        languages: (j['languages'] as List).cast<String>(),
        defaultLanguage: j['defaultLanguage'] as String,
        settings: (j['settings'] as Map).cast<String, dynamic>(),
      );
}

/// Feature switches and country settings from GET /controls.
class Controls {
  const Controls({required this.features, required this.country, required this.refreshAfter, this.fromCache = false});

  final Map<String, bool> features;
  final CountryInfo? country;
  final Duration refreshAfter;

  /// True when loaded from the last saved copy because the server could not be reached.
  final bool fromCache;

  /// Unknown features count as off, so a feature never appears before the server has switched it on.
  bool isOn(String key) => features[key] ?? false;

  factory Controls.fromJson(Map<String, dynamic> j, {bool fromCache = false}) => Controls(
        features: (j['features'] as Map).map((k, v) => MapEntry(k as String, v == true)),
        country: j['country'] == null ? null : CountryInfo.fromJson((j['country'] as Map).cast<String, dynamic>()),
        refreshAfter: Duration(seconds: (j['refreshAfterSeconds'] as num?)?.toInt() ?? 300),
        fromCache: fromCache,
      );
}

const _cacheKey = 'controls.v1';

/// Loads controls when the app opens, keeps the last good copy for weak connections, and refreshes
/// on the interval the server asks for.
class ControlsNotifier extends AsyncNotifier<Controls> {
  Timer? _timer;

  @override
  Future<Controls> build() async {
    ref.onDispose(() => _timer?.cancel());
    final controls = await _load();
    _schedule(controls.refreshAfter);
    return controls;
  }

  Future<Controls> _load() async {
    final api = ref.read(apiClientProvider);
    final prefs = await SharedPreferences.getInstance();
    try {
      final json = await api.getJson('/controls');
      await prefs.setString(_cacheKey, jsonEncode(json));
      return Controls.fromJson(json);
    } on ApiException {
      final saved = prefs.getString(_cacheKey);
      if (saved != null) return Controls.fromJson(jsonDecode(saved) as Map<String, dynamic>, fromCache: true);
      rethrow;
    }
  }

  void _schedule(Duration every) {
    _timer?.cancel();
    _timer = Timer.periodic(every, (_) => refresh());
  }

  Future<void> refresh() async {
    final next = await AsyncValue.guard(_load);
    // Keep showing the previous switches if a background refresh fails.
    if (next.hasValue || !state.hasValue) state = next;
  }
}

final controlsProvider = AsyncNotifierProvider<ControlsNotifier, Controls>(ControlsNotifier.new);

/// Shows [child] only when [feature] is switched on. The server enforces switches regardless;
/// this just avoids showing users things they cannot use.
class FeatureGate extends ConsumerWidget {
  const FeatureGate({super.key, required this.feature, required this.child, this.otherwise});

  final String feature;
  final Widget child;
  final Widget? otherwise;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final on = ref.watch(controlsProvider).value?.isOn(feature) ?? false;
    return on ? child : (otherwise ?? const SizedBox.shrink());
  }
}
