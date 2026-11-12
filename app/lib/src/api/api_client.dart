import 'dart:async';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../session/token_store.dart';

/// Where the user is, sent with every request so the right country settings and switches apply.
class LocationContext {
  const LocationContext({required this.countryCode, this.regionId, this.cityId});

  final String countryCode;
  final String? regionId;
  final String? cityId;

  Map<String, String> toHeaders() => {
        'X-Country': countryCode,
        'X-Region': ?regionId,
        'X-City': ?cityId,
      };
}

/// A failure from the API, turned into something the app can explain to the user.
class ApiException implements Exception {
  ApiException({required this.message, this.statusCode, this.code, this.feature, this.requiredLevel, this.offline = false, this.details});

  final String message;
  final int? statusCode;

  /// Machine-readable reason, e.g. FEATURE_UNAVAILABLE or VERIFICATION_REQUIRED.
  final String? code;
  final String? feature;
  final int? requiredLevel;

  /// True when the server could not be reached at all.
  final bool offline;

  /// Everything else the server sent with the error, such as which field was wrong.
  final Map<String, dynamic>? details;

  bool get isFeatureUnavailable => code == 'FEATURE_UNAVAILABLE';
  bool get needsVerification => code == 'VERIFICATION_REQUIRED';

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final msg = data['message'];
      return ApiException(
        message: msg is String ? msg : 'Something went wrong. Please try again.',
        statusCode: e.response?.statusCode,
        code: data['code'] as String?,
        feature: data['feature'] as String?,
        requiredLevel: data['requiredLevel'] as int?,
        details: data,
      );
    }
    final offline = e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout;
    return ApiException(
      message: offline ? 'No connection. Check your internet and try again.' : 'Something went wrong. Please try again.',
      statusCode: e.response?.statusCode,
      offline: offline,
    );
  }

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}

/// Thin wrapper over Dio. All business rules live on the server; the app only asks.
///
/// When the user is signed in, it adds their access token to each request, fetches a new one shortly before the
/// old one runs out, and tells the app when the server says the session has ended.
class ApiClient {
  ApiClient(AppConfig config, {Dio? dio, TokenStore? tokens, this.deviceId})
      // ignore: prefer_initializing_formals
      : _tokens = tokens,
        _dio = dio ??
            Dio(BaseOptions(
              baseUrl: config.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;
  final TokenStore? _tokens;

  /// Resolves to this installation's identifier; sent as X-Device-Id.
  final Future<String>? deviceId;

  LocationContext? location;

  /// Called when the server no longer accepts this device's session, so the app can show the sign-in screen.
  void Function()? onSessionEnded;

  Future<Tokens>? _refreshing;

  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);

  /// For the few requests whose answer is a list rather than an object.
  Future<List<dynamic>> getList(String path, {Map<String, dynamic>? query}) async => ((await _send('GET', path, query: query))['items'] as List?) ?? const [];

  /// Sends a file to the upload address the server issued (private storage). No sign-in token goes with it: the
  /// address itself is the permission, and it is not the API.
  Future<void> uploadTo(String url, List<int> bytes, Map<String, String> headers) async {
    try {
      await _dio.putUri<dynamic>(Uri.parse(url), data: Stream.fromIterable([bytes]), options: Options(headers: {...headers, Headers.contentLengthHeader: bytes.length}));
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> postJson(String path, {Object? body, bool signedIn = true, String? idempotencyKey}) =>
      _send('POST', path, body: body, signedIn: signedIn, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> patchJson(String path, {Object? body}) => _send('PATCH', path, body: body);

  Future<Map<String, dynamic>> putJson(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<Map<String, dynamic>> deleteJson(String path) => _send('DELETE', path);

  /// [signedIn] false sends the request without the user's token even when one is held (sign-in and sign-up).
  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool signedIn = true,
    String? idempotencyKey,
  }) async {
    final tokens = signedIn ? await _currentTokens() : null;
    try {
      return await _once(method, path, query: query, body: body, tokens: tokens, idempotencyKey: idempotencyKey);
    } on ApiException catch (e) {
      // The token may have been refused although its time had not run out (the clock on the phone can be wrong).
      // Try once with a fresh one; if the server refuses that too, the session really has ended.
      if (e.statusCode != 401 || tokens == null) rethrow;
      final fresh = await _refresh(tokens);
      return _once(method, path, query: query, body: body, tokens: fresh, idempotencyKey: idempotencyKey);
    }
  }

  Future<Map<String, dynamic>> _once(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    Tokens? tokens,
    String? idempotencyKey,
  }) async {
    final device = deviceId == null ? null : await deviceId;
    try {
      final res = await _dio.request<dynamic>(
        path,
        queryParameters: query,
        data: body,
        options: Options(method: method, headers: {
          ...?location?.toHeaders(),
          'X-Device-Id': ?device,
          'Idempotency-Key': ?idempotencyKey,
          if (tokens != null) 'Authorization': 'Bearer ${tokens.accessToken}',
        }),
      );
      final data = res.data;
      // A list is handed back under "items", so every answer has the same shape inside the app.
      if (data is List) return {'items': data};
      return data is Map<String, dynamic> ? data : const {};
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Tokens?> _currentTokens() async {
    final tokens = await _tokens?.read();
    if (tokens == null) return null;
    if (!tokens.expiresWithin(const Duration(seconds: 30))) return tokens;
    return _refresh(tokens);
  }

  /// Refresh tokens can be used once only, so requests that need a new token at the same moment share one call.
  Future<Tokens> _refresh(Tokens old) {
    return _refreshing ??= () async {
      try {
        // Another request may have refreshed already while this one was waiting.
        final latest = await _tokens!.read();
        if (latest != null && latest.refreshToken != old.refreshToken) return latest;
        final json = await _once('POST', '/auth/refresh', body: {'refreshToken': old.refreshToken});
        final fresh = Tokens.fromJson(json);
        await _tokens.write(fresh);
        return fresh;
      } on ApiException catch (e) {
        // Only the server saying so ends the session; a lost connection leaves the user signed in.
        if (e.statusCode == 401) {
          await _tokens!.clear();
          onSessionEnded?.call();
        }
        rethrow;
      } finally {
        _refreshing = null;
      }
    }();
  }
}
