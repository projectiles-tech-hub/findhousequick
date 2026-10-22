import 'package:dio/dio.dart';

import '../config/app_config.dart';

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
  ApiException({required this.message, this.statusCode, this.code, this.feature, this.requiredLevel});

  final String message;
  final int? statusCode;

  /// Machine-readable reason, e.g. FEATURE_UNAVAILABLE or VERIFICATION_REQUIRED.
  final String? code;
  final String? feature;
  final int? requiredLevel;

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
      );
    }
    final offline = e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout;
    return ApiException(
      message: offline
          ? 'No connection. Check your internet and try again.'
          : 'Something went wrong. Please try again.',
      statusCode: e.response?.statusCode,
    );
  }

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}

/// Thin wrapper over Dio. All business rules live on the server; the app only asks.
class ApiClient {
  ApiClient(AppConfig config, {Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: config.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;
  LocationContext? location;

  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: query,
        options: Options(headers: location?.toHeaders()),
      );
      return res.data ?? const {};
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
