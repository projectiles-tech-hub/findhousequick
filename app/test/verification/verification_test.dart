import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:findhousequick/src/api/api_client.dart';
import 'package:findhousequick/src/app.dart';
import 'package:findhousequick/src/config/app_config.dart';
import 'package:findhousequick/src/providers.dart';
import 'package:findhousequick/src/session/token_store.dart';
import 'package:findhousequick/src/verification/verification_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeServer implements HttpClientAdapter {
  _FakeServer(this.handler);
  (int, Object?) Function(RequestOptions request) handler;
  final List<RequestOptions> requests = [];
  bool identityAvailable = true;
  Map<String, dynamic> me = _me(level: 1);

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final (status, body) = switch (options.path) {
      '/controls' => (200, _controls(identityAvailable)),
      '/me' => (200, me),
      _ => handler(options),
    };
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}

  Map<String, dynamic> body(String path) => requests.lastWhere((r) => r.path == path).data as Map<String, dynamic>;
}

Map<String, dynamic> _controls(bool identity) => {
      'features': <String, bool>{},
      'country': {
        'code': 'NG',
        'name': 'Nigeria',
        'currency': 'NGN',
        'dialCode': '+234',
        'languages': ['en'],
        'defaultLanguage': 'en',
        'settings': {
          'verification': {
            'identityCheckAvailable': identity,
            'acceptedIdTypes': ['NIN'],
            'idNumberPatterns': {'NIN': r'^[0-9]{11}$'},
            'idDocumentTypes': ['DRIVERS_LICENCE', 'NIN_SLIP'],
          },
        },
      },
      'refreshAfterSeconds': 300,
    };

Map<String, dynamic> _me({required int level, List<String> types = const ['TENANT']}) => {
      'id': 'u1',
      'firstName': 'Osaro',
      'lastName': 'Igbinedion',
      'phone': '+2348031234567',
      'email': 'osaro@example.com',
      'phoneConfirmed': true,
      'emailConfirmed': level >= 1,
      'types': types,
      'verificationLevel': level,
    };

Map<String, dynamic> _check(String status, {String? reason, String? next, bool doc = false}) =>
    {'id': 'c1', 'idType': 'NIN', 'idNumberLast4': '8901', 'status': status, 'failureReason': reason, 'nextAction': next, 'documentAttached': doc};

const _config = AppConfig(apiBaseUrl: 'http://server.test/v1', defaultCountry: 'NG');

Future<_FakeServer> _open(WidgetTester tester, String location, (int, Object?) Function(RequestOptions) handler, {void Function(_FakeServer)? setUp}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(360, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _FakeServer(handler);
  setUp?.call(server);
  final store = MemoryTokenStore(Tokens(accessToken: 'access', accessTokenExpiresAt: DateTime.now().add(const Duration(minutes: 15)), refreshToken: 'refresh'));
  final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
  final api = ApiClient(_config, dio: dio, tokens: store, deviceId: Future.value('device-12345678'))..location = const LocationContext(countryCode: 'NG');
  await tester.pumpWidget(ProviderScope(
    overrides: [tokenStoreProvider.overrideWithValue(store), apiClientProvider.overrideWithValue(api)],
    child: FindHouseQuickApp(initialLocation: location),
  ));
  await tester.pumpAndSettle();
  return server;
}

/// Ends the screen so its timer for asking the server again is stopped.
Future<void> _close(WidgetTester tester) => tester.pumpWidget(const SizedBox());

void main() {
  test('an ID number is checked the way the server checks it', () {
    expect(idNumberLooksRight('1234 567 8901', r'^[0-9]{11}$'), isTrue);
    expect(idNumberLooksRight('1234-567-890', r'^[0-9]{11}$'), isFalse);
    expect(idNumberLooksRight('a1b2c3', null), isTrue);
    expect(idNumberLooksRight('ab', null), isFalse);
  });

  test('a photo is told from its first bytes, not its name', () {
    expect(photoContentType(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0])), 'image/jpeg');
    expect(photoContentType(Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0])), 'image/png');
    expect(photoContentType(Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0])), isNull);
  });

  testWidgets('the hub shows the three levels, with the next one offering the identity check', (tester) async {
    await _open(tester, '/verification', (r) => r.path == '/identity/checks' ? (200, <dynamic>[]) : (404, null));
    expect(find.text('Tenant account. Each level unlocks more of FindHouseQuick.'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);
    expect(find.text('Later'), findsOneWidget);
    expect(find.text('NIN and a face check'), findsOneWidget);
    await tester.tap(find.text('Verify my identity'));
    await tester.pumpAndSettle();
    expect(find.text('Your NIN'), findsOneWidget);
  });

  testWidgets('a check with the team shows as waiting on the hub, with a way back to it', (tester) async {
    await _open(tester, '/verification', (r) => r.path == '/identity/checks' ? (200, [_check('MANUAL_REVIEW', reason: 'NAME_MISMATCH')]) : (200, _check('MANUAL_REVIEW', reason: 'NAME_MISMATCH')));
    expect(find.text('Waiting for check'), findsOneWidget);
    await tester.tap(find.text('See my check'));
    await tester.pumpAndSettle();
    expect(find.text('A member of our team is checking'), findsOneWidget);
    expect(find.text('Nothing more is needed from you'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('the ID number and the consent are checked before anything is sent', (tester) async {
    final server = await _open(tester, '/verification/identity', (r) => (201, _check('PENDING')));
    await tester.enterText(find.byType(TextField), '12345');
    await tester.tap(find.text('Continue to face check'));
    await tester.pumpAndSettle();
    expect(find.text('This number does not look right. Please check it.'), findsOneWidget);
    expect(find.text('Please tick the box to agree before you continue'), findsOneWidget);
    expect(server.requests.where((r) => r.path == '/identity/checks' && r.method == 'POST'), isEmpty);

    await tester.enterText(find.byType(TextField), '1234 567 8901');
    await tester.tap(find.textContaining('I agree that my NIN', findRichText: true));
    await tester.pump();
    server.handler = (r) => r.method == 'POST' ? (201, _check('PENDING')) : (200, _check('PENDING'));
    await tester.tap(find.text('Continue to face check'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(server.requests.lastWhere((r) => r.path == '/identity/checks' && r.method == 'POST').data, {'idType': 'NIN', 'idNumber': '1234 567 8901', 'consent': true});
    expect(find.text('Checking your details'), findsOneWidget);
    expect(find.text('NIN ending 8901'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('where no identity check exists yet, the screen says so and asks for nothing', (tester) async {
    await _open(tester, '/verification/identity', (_) => (404, null), setUp: (s) => s.identityAvailable = false);
    expect(find.text('Identity checks are not available yet'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('the checking screen asks again and moves to verified when the check passes', (tester) async {
    var answer = _check('PENDING');
    final server = await _open(tester, '/verification/check/c1', (_) => (200, answer));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Checking your details'), findsOneWidget);
    answer = _check('PASSED');
    server.me = _me(level: 2);
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text("You're verified"), findsOneWidget);
    expect(find.text('Message and call landlords and agents'), findsOneWidget);
    expect(find.text('Start looking for a home'), findsOneWidget);
    await _close(tester);
  });

  testWidgets('a face check that did not work offers another try, never a document', (tester) async {
    await _open(tester, '/verification/check/c1', (_) => (200, _check('FAILED', reason: 'LIVENESS_FAILED')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text("The face check didn't work"), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(find.text('Add a photo of your ID'), findsNothing);
    await _close(tester);
  });

  testWidgets('when the NIN did not match, the document screen lists the country\'s documents and insists on both choices', (tester) async {
    final server = await _open(tester, '/verification/check/c1', (r) {
      if (r.path.endsWith('/document-types')) {
        return (200, [
          {'code': 'DRIVERS_LICENCE', 'label': "Driver's licence"},
          {'code': 'NIN_SLIP', 'label': 'NIN slip'},
          {'code': 'CERTIFICATE_OF_OCCUPANCY', 'label': 'Certificate of occupancy'},
        ]);
      }
      return (200, _check('FAILED', reason: 'ID_NOT_FOUND', next: 'UPLOAD_ID_DOCUMENT'));
    });
    await tester.pumpAndSettle();
    expect(find.text('Add a photo of your ID'), findsOneWidget);
    expect(find.text("Driver's licence"), findsOneWidget);
    expect(find.text('NIN slip'), findsOneWidget);
    expect(find.text('Certificate of occupancy'), findsNothing);
    await tester.tap(find.text('Send for checking'));
    await tester.pumpAndSettle();
    expect(find.text('Please choose which document it is'), findsOneWidget);
    expect(find.text('Please add a photo of the document'), findsOneWidget);
    expect(server.requests.where((r) => r.path == '/documents'), isEmpty);
    await _close(tester);
  });

  test('adding a document: declared, uploaded, confirmed, then attached to the check', () async {
    final asked = <String>[];
    final server = _FakeServer((r) {
      asked.add('${r.method} ${r.uri.host}${r.uri.path}');
      if (r.path == '/documents') return (201, {'documentId': 'd1', 'uploadUrl': 'http://storage.test/put/d1', 'uploadHeaders': {'x-test': '1'}});
      if (r.uri.host == 'storage.test') return (200, null);
      if (r.path == '/documents/d1/complete') return (200, {'id': 'd1'});
      return (200, _check('MANUAL_REVIEW', doc: true));
    });
    final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
    final api = ApiClient(_config, dio: dio, tokens: MemoryTokenStore(Tokens(accessToken: 'access', accessTokenExpiresAt: DateTime.now().add(const Duration(minutes: 15)), refreshToken: 'r')));
    final bytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]);
    final check = await VerificationApi(api).addDocument(checkId: 'c1', documentTypeCode: 'NIN_SLIP', bytes: bytes, contentType: 'image/jpeg', idempotencyKey: 'key-1');
    expect(asked, ['POST server.test/v1/documents', 'PUT storage.test/put/d1', 'POST server.test/v1/documents/d1/complete', 'POST server.test/v1/identity/checks/c1/document']);
    final declared = server.requests.first;
    expect(declared.headers['Idempotency-Key'], 'key-1');
    expect((declared.data as Map)['sizeBytes'], 7);
    expect((declared.data as Map)['sha256'], hasLength(64));
    final upload = server.requests[1];
    expect(upload.headers['x-test'], '1');
    // The sign-in token never goes to the storage address.
    expect(upload.headers.containsKey('Authorization'), isFalse);
    expect(check.withTeam, isTrue);
  });

  testWidgets('an agent saves company details and sees them waiting for a check', (tester) async {
    final server = await _open(
      tester,
      '/verification/company',
      (r) => r.method == 'GET' ? (404, {'code': 'NOT_FOUND', 'message': 'None saved yet'}) : (200, {'businessName': 'Osaro Homes Ltd', 'registrationNumber': null, 'status': 'PENDING'}),
      setUp: (s) => s.me = _me(level: 2, types: ['AGENT']),
    );
    await tester.tap(find.text('Save company details'));
    await tester.pumpAndSettle();
    expect(find.text('Please enter the business name'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'Osaro Homes Ltd');
    await tester.tap(find.text('Save company details'));
    await tester.pumpAndSettle();
    expect(server.body('/me/agent-profile'), {'businessName': 'Osaro Homes Ltd'});
    expect(find.text('Waiting for check'), findsOneWidget);
  });

  testWidgets('the verification screens fit the website widths without spilling over', (tester) async {
    for (final size in const [Size(768, 1024), Size(1366, 768)]) {
      for (final path in ['/verification', '/verification/identity', '/verification/check/c1', '/verification/company']) {
        SharedPreferences.setMockInitialValues({});
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final server = _FakeServer((r) => r.path == '/identity/checks' ? (200, <dynamic>[]) : (200, _check('PASSED')));
        final store = MemoryTokenStore(Tokens(accessToken: 'a', accessTokenExpiresAt: DateTime.now().add(const Duration(minutes: 15)), refreshToken: 'r'));
        final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
        final api = ApiClient(_config, dio: dio, tokens: store)..location = const LocationContext(countryCode: 'NG');
        await tester.pumpWidget(ProviderScope(
          overrides: [tokenStoreProvider.overrideWithValue(store), apiClientProvider.overrideWithValue(api)],
          child: FindHouseQuickApp(key: ValueKey('$path$size'), initialLocation: path),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$path at $size');
        await _close(tester);
      }
    }
  });
}
