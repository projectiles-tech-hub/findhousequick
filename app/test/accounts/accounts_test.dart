import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:findhousequick/src/accounts/accounts_api.dart';
import 'package:findhousequick/src/api/api_client.dart';
import 'package:findhousequick/src/app.dart';
import 'package:findhousequick/src/config/app_config.dart';
import 'package:findhousequick/src/providers.dart';
import 'package:findhousequick/src/session/token_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stands in for the server: answers each request from [handler] and remembers what was asked.
class _FakeServer implements HttpClientAdapter {
  _FakeServer(this.handler);
  (int, Object?) Function(RequestOptions request) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final (status, body) = options.path == '/controls' ? (200, _controls) : handler(options);
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}

  RequestOptions last(String path) => requests.lastWhere((r) => r.path == path);
  Map<String, dynamic> body(String path) => last(path).data as Map<String, dynamic>;
}

const _controls = {
  'features': {'platform.new_registrations': true},
  'country': {
    'code': 'NG',
    'name': 'Nigeria',
    'currency': 'NGN',
    'dialCode': '+234',
    'languages': ['en', 'pcm'],
    'defaultLanguage': 'en',
    'settings': {
      'legal': {'termsVersion': '2026-11-10', 'privacyVersion': '2026-11-10'},
    },
  },
  'refreshAfterSeconds': 300,
};

const _config = AppConfig(apiBaseUrl: 'http://server.test/v1', defaultCountry: 'NG');

Map<String, dynamic> _session({bool emailConfirmed = false}) => {
      'accessToken': 'access',
      'accessTokenExpiresAt': DateTime.now().add(const Duration(minutes: 15)).toUtc().toIso8601String(),
      'refreshToken': 'refresh',
      'user': {
        'id': 'u1',
        'firstName': 'Osaro',
        'lastName': 'Igbinedion',
        'phone': '+2348031234567',
        'email': 'osaro@example.com',
        'phoneConfirmed': true,
        'emailConfirmed': emailConfirmed,
        'types': ['TENANT'],
        'verificationLevel': 0,
      },
    };

Future<_FakeServer> _open(WidgetTester tester, String location, (int, Object?) Function(RequestOptions) handler, {Size size = const Size(360, 1400)}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _FakeServer(handler);
  final store = MemoryTokenStore();
  final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
  final api = ApiClient(_config, dio: dio, tokens: store, deviceId: Future.value('device-12345678'))..location = const LocationContext(countryCode: 'NG');
  await tester.pumpWidget(ProviderScope(
    overrides: [tokenStoreProvider.overrideWithValue(store), apiClientProvider.overrideWithValue(api)],
    child: FindHouseQuickApp(initialLocation: location),
  ));
  await tester.pumpAndSettle();
  return server;
}

Finder _field(String label) => find.ancestor(of: find.text(label), matching: find.byType(Column)).first;

Future<void> _type(WidgetTester tester, String label, String text) async {
  await tester.enterText(find.descendant(of: _field(label), matching: find.byType(TextField)).first, text);
  await tester.pump();
}

void main() {
  test('phone numbers are joined with the dialling code and hidden in the middle for display', () {
    expect(fullPhone('+234', '803 123 4567'), '+234 803 123 4567');
    expect(fullPhone('+234', '+44 7700 900123'), '+44 7700 900123');
    expect(maskPhone('+234', '0803 123 4567'), '+234 803 ••• 4567');
    expect(looksLikeEmail('osaro@example.com'), isTrue);
    expect(looksLikeEmail('osaro@example'), isFalse);
  });

  testWidgets('someone not signed in sees the welcome screen with the three ways in', (tester) async {
    await _open(tester, '/', (_) => (500, null));
    expect(find.text('Find your next home, quick.'), findsOneWidget);
    expect(find.text('Create an account'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Look around first'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
  });

  testWidgets('sign-up will not move on until a kind of user is chosen', (tester) async {
    await _open(tester, '/sign-up', (_) => (500, null));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Please choose at least one'), findsOneWidget);
    await tester.tap(find.text('Tenant'));
    await tester.tap(find.text('Agent'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Your details'), findsOneWidget);
  });

  testWidgets('the details are checked on the phone before any code is asked for', (tester) async {
    final server = await _open(tester, '/sign-up/details', (_) => (202, null));
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(find.text('Please enter your first name'), findsOneWidget);
    expect(find.text('Please enter your phone number'), findsOneWidget);
    expect(find.text('Please enter a valid email address'), findsOneWidget);
    expect(find.text('Use at least 8 characters'), findsOneWidget);
    expect(find.textContaining('Please agree to the terms'), findsOneWidget);
    expect(server.requests.where((r) => r.path == '/auth/otp'), isEmpty);
  });

  testWidgets('a full sign-up: details, code, account created, then asked to confirm the email', (tester) async {
    final server = await _open(tester, '/sign-up?as=landlord&invitation=ABCDE23456', (r) {
      if (r.path == '/auth/otp') return (202, null);
      if (r.path == '/auth/register') return (201, _session());
      return (404, null);
    });
    // The link from the website chose Landlord already.
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await _type(tester, 'First name', 'Osaro');
    await _type(tester, 'Surname', 'Igbinedion');
    await _type(tester, 'Phone number', '803 123 4567');
    await _type(tester, 'Email address', 'osaro@example.com');
    await _type(tester, 'Password', 'correct horse 9');
    await tester.tap(find.textContaining('I agree to the', findRichText: true));
    await tester.pump();
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/otp'), {'phone': '+234 803 123 4567', 'purpose': 'REGISTER'});
    expect(find.textContaining('+234 803 ••• 4567'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '482715');
    await tester.pump();
    await tester.tap(find.text('Create my account'));
    await tester.pumpAndSettle();
    final sent = server.body('/auth/register');
    expect(sent['types'], ['LANDLORD']);
    expect(sent['signUpWith'], 'SMS');
    expect(sent['otp'], '482715');
    expect(sent['countryCode'], 'NG');
    expect(sent['invitationCode'], 'ABCDE23456');
    expect(sent['consent'], {'termsVersion': '2026-11-10', 'privacyVersion': '2026-11-10'});
    expect(server.last('/auth/register').headers.containsKey('Authorization'), isFalse);
    expect(find.text('Welcome, Osaro. Your account is ready.'), findsOneWidget);
    expect(find.text('Send code to my email'), findsOneWidget);

    // Confirming the email address.
    server.handler = (r) => r.path == '/me/contacts/code' ? (202, null) : (200, _session(emailConfirmed: true)['user']);
    await tester.tap(find.text('Send code to my email'));
    await tester.pumpAndSettle();
    expect(server.body('/me/contacts/code'), {'channel': 'EMAIL', 'value': 'osaro@example.com'});
    await tester.enterText(find.byType(TextField), '111222');
    await tester.pump();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(server.body('/me/contacts/confirm'), {'channel': 'EMAIL', 'value': 'osaro@example.com', 'code': '111222'});
    expect(server.last('/me/contacts/confirm').headers['Authorization'], 'Bearer access');
    // Ends the countdown timers of the code screens.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('a wrong sign-up code is explained under the boxes, which are emptied for another try', (tester) async {
    await _open(tester, '/sign-up/code', (_) => (400, {'code': 'INVALID_CODE', 'message': 'The code is wrong or has expired.'}));
    await tester.enterText(find.byType(TextField), '000000');
    await tester.pump();
    await tester.tap(find.text('Create my account'));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('The code is wrong or has expired. Please ask for a new one.'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('sign-in explains a wrong password, and pauses after five in a row with the two ways forward', (tester) async {
    var locked = false;
    final server = await _open(tester, '/sign-in', (r) {
      if (r.path == '/auth/otp') return (202, null);
      return locked
          ? (429, {'code': 'PASSWORD_LOCKED', 'message': 'Too many wrong passwords.'})
          : (401, {'code': 'WRONG_CREDENTIALS', 'message': 'Not correct.'});
    });
    await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Please enter your phone number'), findsOneWidget);
    expect(find.text('Please enter your password'), findsOneWidget);
    expect(server.requests.where((r) => r.path == '/auth/login'), isEmpty);

    await _type(tester, 'Phone number', '803 123 4567');
    await _type(tester, 'Password', 'wrong password');
    await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/login'), {'phone': '+234 803 123 4567', 'password': 'wrong password'});
    expect(find.text('The phone number or email address, password or code is not correct.'), findsOneWidget);

    locked = true;
    await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Password sign-in is paused for 15 minutes'), findsOneWidget);
    expect(find.text('5 wrong passwords in a row'), findsOneWidget);
    expect(find.text('Get a sign-in code'), findsOneWidget);
    expect(find.text('Set a new password'), findsOneWidget);
    expect(find.text('Forgot your password?'), findsNothing);

    await tester.tap(find.text('Get a sign-in code'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/otp'), {'phone': '+234 803 123 4567', 'purpose': 'LOGIN'});
    expect(find.text('Enter the code'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('signing in by email with a password opens the app', (tester) async {
    final server = await _open(tester, '/sign-in', (r) => r.path == '/auth/login' ? (200, _session(emailConfirmed: true)) : (200, <String, dynamic>{}));
    await tester.tap(find.text('Email'));
    await tester.pumpAndSettle();
    await _type(tester, 'Email address', 'osaro@example.com');
    await _type(tester, 'Password', 'correct horse 9');
    await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/login'), {'email': 'osaro@example.com', 'password': 'correct horse 9'});
    expect(find.text('Sign out'), findsOneWidget);
  });

  group('website layouts (768 and over)', () {
    final listings = {
      'total': 312,
      'items': [
        {'id': 'l1', 'title': '2 bedroom flat', 'area': 'Ugbowo', 'rent': {'amountMinor': '120000000', 'currency': 'NGN'}, 'rentPeriod': 'YEAR', 'badges': ['OWNER_VERIFIED'], 'coverImage': null, 'publishedAt': DateTime.now().subtract(const Duration(minutes: 12)).toUtc().toIso8601String()},
        {'id': 'l2', 'title': '3 bedroom bungalow', 'area': 'GRA', 'rent': {'amountMinor': '250000000', 'currency': 'NGN'}, 'rentPeriod': 'YEAR', 'badges': <String>[], 'coverImage': null, 'publishedAt': null},
      ],
    };

    testWidgets('sign-up is a card with the header, the step name and real listings beside it', (tester) async {
      await _open(tester, '/sign-up', (r) => r.path == '/search/listings' ? (200, listings) : (404, null), size: const Size(1366, 768));
      expect(find.text('Back to properties'), findsOneWidget);
      expect(find.text('About you'), findsOneWidget);
      expect(find.text('Choose all that apply. You can add more later.'), findsOneWidget);
      expect(find.text('Already have an account?'), findsOneWidget);
      expect(find.text('312 properties available now'), findsOneWidget);
      expect(find.text('₦1,200,000'), findsOneWidget);
      expect(find.text('Listed 12 min ago'), findsOneWidget);
      expect(find.text('Verified'), findsOneWidget);
      // Phone-only parts are not shown.
      expect(find.text('Create an account'), findsNothing);
    });

    testWidgets('at tablet width the card stands alone, without the listings', (tester) async {
      await _open(tester, '/sign-up', (r) => r.path == '/search/listings' ? (200, listings) : (404, null), size: const Size(768, 1024));
      expect(find.text('About you'), findsOneWidget);
      expect(find.text('312 properties available now'), findsNothing);
    });

    testWidgets('sign-in is a panel with the two halves of one bar in place of chips', (tester) async {
      final server = await _open(tester, '/sign-in', (r) => r.path == '/auth/login' ? (200, _session(emailConfirmed: true)) : (200, <String, dynamic>{}), size: const Size(1366, 768));
      expect(find.text('Sign in to save homes, message listers and book inspections.'), findsOneWidget);
      expect(find.text('New here?'), findsOneWidget);
      await tester.tap(find.text('Email'));
      await tester.pumpAndSettle();
      await _type(tester, 'Email address', 'osaro@example.com');
      await _type(tester, 'Password', 'correct horse 9');
      await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(server.body('/auth/login'), {'email': 'osaro@example.com', 'password': 'correct horse 9'});
    });

    testWidgets('every sign-up and sign-in screen fits at 768 and at 1366 without spilling over', (tester) async {
      for (final size in const [Size(768, 1024), Size(1366, 768)]) {
        for (final path in ['/sign-up', '/sign-up/details', '/sign-up/code', '/sign-in', '/forgot-password']) {
          await _open(tester, path, (r) => r.path == '/search/listings' ? (200, listings) : (404, null), size: size);
          expect(tester.takeException(), isNull, reason: '$path at $size');
          await tester.pumpWidget(const SizedBox());
        }
      }
    });
  });

  testWidgets('a forgotten password: code asked for, then code and new password sent together', (tester) async {
    final server = await _open(tester, '/forgot-password', (r) => r.path == '/auth/otp' ? (202, null) : (204, null));
    await _type(tester, 'Phone number', '803 123 4567');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/otp'), {'phone': '+234 803 123 4567', 'purpose': 'RESET_PASSWORD'});
    expect(find.text('You will be signed out everywhere'), findsOneWidget);

    await tester.tap(find.text('Save new password'));
    await tester.pumpAndSettle();
    expect(find.text('Please enter the 6-digit code'), findsOneWidget);
    expect(server.requests.where((r) => r.path == '/auth/password-reset'), isEmpty);

    await tester.enterText(find.byType(TextField).first, '482715');
    await _type(tester, 'New password', 'new horse battery 7');
    await tester.tap(find.text('Save new password'));
    await tester.pumpAndSettle();
    expect(server.body('/auth/password-reset'), {'phone': '+234 803 123 4567', 'otp': '482715', 'newPassword': 'new horse battery 7'});
    expect(find.text('Your password has been changed'), findsOneWidget);
  });
}
