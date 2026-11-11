import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:findhousequick/src/api/api_client.dart';
import 'package:findhousequick/src/config/app_config.dart';
import 'package:findhousequick/src/providers.dart';
import 'package:findhousequick/src/session/session.dart';
import 'package:findhousequick/src/session/token_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Stands in for the server: answers each request from [handler] and remembers what was asked.
class _FakeServer implements HttpClientAdapter {
  _FakeServer(this.handler);
  final (int, Object?) Function(RequestOptions request) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final (status, body) = handler(options);
    if (status == 0) throw DioException.connectionError(requestOptions: options, reason: 'offline');
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

const _config = AppConfig(apiBaseUrl: 'http://server.test/v1', defaultCountry: 'NG');

Tokens _tokens(String name, {Duration life = const Duration(minutes: 15)}) =>
    Tokens(accessToken: 'access-$name', accessTokenExpiresAt: DateTime.now().add(life), refreshToken: 'refresh-$name');

Map<String, dynamic> _sessionJson(String name) => {
      ..._tokens(name).toJson(),
      'user': {'id': 'u1', 'firstName': 'Osaro', 'lastName': 'Igbinedion', 'types': ['LANDLORD'], 'verificationLevel': 1},
    };

(ApiClient, _FakeServer) _client(TokenStore store, (int, Object?) Function(RequestOptions) handler) {
  final server = _FakeServer(handler);
  final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
  return (ApiClient(_config, dio: dio, tokens: store, deviceId: Future.value('device-12345678')), server);
}

void main() {
  test('sends the access token and the device identifier', () async {
    final (api, server) = _client(MemoryTokenStore(_tokens('a')), (_) => (200, {'ok': true}));
    await api.getJson('/me');
    expect(server.requests.single.headers['Authorization'], 'Bearer access-a');
    expect(server.requests.single.headers['X-Device-Id'], 'device-12345678');
  });

  test('sign-in requests go without a token even when one is held', () async {
    final (api, server) = _client(MemoryTokenStore(_tokens('a')), (_) => (200, <String, dynamic>{}));
    await api.postJson('/auth/login', body: {'phone': '+2348031234567', 'password': 'x'}, signedIn: false);
    expect(server.requests.single.headers.containsKey('Authorization'), isFalse);
  });

  test('fetches a new token first when the old one is about to run out', () async {
    final store = MemoryTokenStore(_tokens('old', life: const Duration(seconds: 5)));
    final (api, server) = _client(store, (r) => r.path == '/auth/refresh' ? (200, _sessionJson('new')) : (200, {'ok': true}));
    await api.getJson('/me');
    expect(server.requests.map((r) => r.path), ['/auth/refresh', '/me']);
    expect(server.requests.last.headers['Authorization'], 'Bearer access-new');
    expect((await store.read())!.refreshToken, 'refresh-new');
  });

  test('requests made at the same moment share one refresh, since a refresh token works once', () async {
    final store = MemoryTokenStore(_tokens('old', life: Duration.zero));
    final (api, server) = _client(store, (r) => r.path == '/auth/refresh' ? (200, _sessionJson('new')) : (200, {'ok': true}));
    await Future.wait([api.getJson('/me'), api.getJson('/saved'), api.getJson('/conversations')]);
    expect(server.requests.where((r) => r.path == '/auth/refresh'), hasLength(1));
  });

  test('a refused token is refreshed once and the request tried again', () async {
    final store = MemoryTokenStore(_tokens('old'));
    final (api, server) = _client(store, (r) {
      if (r.path == '/auth/refresh') return (200, _sessionJson('new'));
      return r.headers['Authorization'] == 'Bearer access-old' ? (401, {'code': 'SESSION_INVALID', 'message': 'ended'}) : (200, {'ok': true});
    });
    expect(await api.getJson('/me'), {'ok': true});
    expect(server.requests.map((r) => r.path), ['/me', '/auth/refresh', '/me']);
  });

  test('when the server refuses the refresh, the keys are removed and the app is told', () async {
    final store = MemoryTokenStore(_tokens('old', life: Duration.zero));
    final (api, _) = _client(store, (_) => (401, {'code': 'SESSION_INVALID', 'message': 'Your session has ended. Please sign in again.'}));
    var ended = 0;
    api.onSessionEnded = () => ended++;
    await expectLater(api.getJson('/me'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'SESSION_INVALID')));
    expect(await store.read(), isNull);
    expect(ended, 1);
  });

  test('a lost connection does not sign the user out', () async {
    final store = MemoryTokenStore(_tokens('old', life: Duration.zero));
    final (api, _) = _client(store, (_) => (0, null));
    await expectLater(api.getJson('/me'), throwsA(isA<ApiException>().having((e) => e.offline, 'offline', isTrue)));
    expect(await store.read(), isNotNull);
  });

  group('session', () {
    ProviderContainer container(TokenStore store, (int, Object?) Function(RequestOptions) handler) {
      final (api, _) = _client(store, handler);
      final c = ProviderContainer(overrides: [
        tokenStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    test('opens signed out when no keys are held', () async {
      final c = container(MemoryTokenStore(), (_) => (500, null));
      expect((await c.read(sessionProvider.future)).signedIn, isFalse);
    });

    test('restores the user when keys are held', () async {
      final c = container(MemoryTokenStore(_tokens('a')), (_) => (200, _sessionJson('a')['user']));
      final s = await c.read(sessionProvider.future);
      expect(s.signedIn, isTrue);
      expect(s.me?.firstName, 'Osaro');
      expect(s.me?.listsProperties, isTrue);
    });

    test('stays signed in when the server cannot be reached', () async {
      final c = container(MemoryTokenStore(_tokens('a')), (_) => (0, null));
      final s = await c.read(sessionProvider.future);
      expect(s.signedIn, isTrue);
      expect(s.me, isNull);
    });

    test('starts after sign-in and ends on sign-out, even with no connection', () async {
      final store = MemoryTokenStore();
      final c = container(store, (_) => (0, null));
      await c.read(sessionProvider.future);
      await c.read(sessionProvider.notifier).start(_sessionJson('a'));
      expect(c.read(sessionProvider).value?.me?.id, 'u1');
      expect(await store.read(), isNotNull);
      await c.read(sessionProvider.notifier).signOut();
      expect(c.read(sessionProvider).value?.signedIn, isFalse);
      expect(await store.read(), isNull);
    });
  });
}
