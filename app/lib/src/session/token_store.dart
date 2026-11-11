import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The keys the server gave this device when the user signed in.
class Tokens {
  const Tokens({required this.accessToken, required this.accessTokenExpiresAt, required this.refreshToken});

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String refreshToken;

  /// True when the access token has run out, or is about to, so a new one should be fetched first.
  bool expiresWithin(Duration margin, {DateTime? now}) => !accessTokenExpiresAt.isAfter((now ?? DateTime.now()).add(margin));

  factory Tokens.fromJson(Map<String, dynamic> j) => Tokens(
        accessToken: j['accessToken'] as String,
        accessTokenExpiresAt: DateTime.parse(j['accessTokenExpiresAt'] as String),
        refreshToken: j['refreshToken'] as String,
      );

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
        'refreshToken': refreshToken,
      };
}

/// Where the keys are kept between uses of the app.
abstract class TokenStore {
  Future<Tokens?> read();
  Future<void> write(Tokens tokens);
  Future<void> clear();
}

/// Keeps the keys in the phone's own protected storage (Keychain on iPhone, Keystore on Android), never in plain
/// settings. Side note: on the web the browser has no such store, so the package encrypts them in the browser's storage.
class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'session.v1';

  @override
  Future<Tokens?> read() async {
    try {
      final saved = await _storage.read(key: _key);
      return saved == null ? null : Tokens.fromJson(jsonDecode(saved) as Map<String, dynamic>);
    } catch (_) {
      // Unreadable (for example after the app was restored onto another phone): treat as signed out.
      return null;
    }
  }

  @override
  Future<void> write(Tokens tokens) => _storage.write(key: _key, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// Kept in memory only; used in tests.
class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this._tokens]);
  Tokens? _tokens;

  @override
  Future<Tokens?> read() async => _tokens;
  @override
  Future<void> write(Tokens tokens) async => _tokens = tokens;
  @override
  Future<void> clear() async => _tokens = null;
}

/// This installation's own identifier, sent as X-Device-Id. It is a random value made on first use; it says nothing
/// about the phone or the person. The server uses it for viewing limits and the scout conflict checks (ADR 0008).
Future<String> loadDeviceId() async {
  const key = 'device.id.v1';
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString(key);
  if (saved != null && saved.length >= 8) return saved;
  final random = Random.secure();
  final id = List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  await prefs.setString(key, id);
  return id;
}
