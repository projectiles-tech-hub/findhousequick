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
    this.dialCode,
  });

  final String code;
  final String name;
  final String currency;
  final List<String> languages;
  final String defaultLanguage;
  final Map<String, dynamic> settings;

  /// The country's dialling code, e.g. "+234".
  final String? dialCode;

  /// The country's flag as an emoji, worked out from its two-letter code (each letter has a matching flag letter).
  String get flag => String.fromCharCodes(code.toUpperCase().codeUnits.map((c) => 0x1F1E6 + c - 0x41));

  Map get _verification => (settings['verification'] as Map?) ?? const {};

  /// Whether an identity check can be started in this country at all.
  bool get identityCheckAvailable => _verification['identityCheckAvailable'] == true;

  /// The ID types accepted for the identity check, e.g. NIN.
  List<String> get acceptedIdTypes => ((_verification['acceptedIdTypes'] as List?) ?? const []).cast<String>();

  /// How an ID number of [idType] must look once spaces and dashes are removed; empty when the country sets none.
  String? idNumberPattern(String idType) => (_verification['idNumberPatterns'] as Map?)?[idType] as String?;

  /// The documents that may be added as a photo when the ID check does not match (decision 49).
  List<String> get idDocumentTypes => ((_verification['idDocumentTypes'] as List?) ?? const []).cast<String>();

  /// The versions of the terms of use and privacy policy a new user agrees to.
  String get termsVersion => ((settings['legal'] as Map?)?['termsVersion'] as String?) ?? '';
  String get privacyVersion => ((settings['legal'] as Map?)?['privacyVersion'] as String?) ?? '';

  factory CountryInfo.fromJson(Map<String, dynamic> j) => CountryInfo(
        code: j['code'] as String,
        name: j['name'] as String,
        currency: j['currency'] as String,
        languages: (j['languages'] as List).cast<String>(),
        defaultLanguage: j['defaultLanguage'] as String,
        settings: (j['settings'] as Map).cast<String, dynamic>(),
        dialCode: j['dialCode'] as String?,
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
