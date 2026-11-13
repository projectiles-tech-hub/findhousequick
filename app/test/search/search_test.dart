import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:findhousequick/src/api/api_client.dart';
import 'package:findhousequick/src/app.dart';
import 'package:findhousequick/src/config/app_config.dart';
import 'package:findhousequick/src/providers.dart';
import 'package:findhousequick/src/search/location.dart';
import 'package:findhousequick/src/search/search_api.dart';
import 'package:findhousequick/src/search/search_screens.dart';
import 'package:findhousequick/src/session/token_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeServer implements HttpClientAdapter {
  _FakeServer(this.handler);
  (int, Object?) Function(RequestOptions request) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final (status, body) = switch (options.path) {
      '/controls' => (200, _controls),
      '/me' => (200, _me),
      '/reference/countries/NG/regions' => (200, [
          {
            'id': 'r1',
            'name': 'Edo',
            'cities': [
              {'id': 'c1', 'name': 'Benin City', 'enabled': true, 'centre': {'lat': 6.335, 'lng': 5.627}},
            ],
          },
        ]),
      '/reference/countries/NG/property-types' => (200, [
          {'code': 'FLAT', 'label': 'Flat', 'category': 'LONG_TERM_RESIDENTIAL'},
          {'code': 'SHOP', 'label': 'Shop', 'category': 'COMMERCIAL'},
        ]),
      _ => handler(options),
    };
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}

  List<Map<String, dynamic>> searches() => [for (final r in requests.where((r) => r.path == '/search/listings')) r.queryParameters];
}

const _controls = {
  'features': {
    'search.around_me': true,
    'search.landmark': true,
    'search.saved_alerts': true,
    'listings.long_term': true,
    'listings.commercial': true,
  },
  'country': {'code': 'NG', 'name': 'Nigeria', 'currency': 'NGN', 'dialCode': '+234', 'languages': ['en'], 'defaultLanguage': 'en', 'settings': <String, dynamic>{}},
  'refreshAfterSeconds': 300,
};

const _me = {'id': 'u1', 'firstName': 'Osaro', 'lastName': 'Igbinedion', 'phoneConfirmed': true, 'emailConfirmed': true, 'types': ['TENANT'], 'verificationLevel': 1};

Map<String, dynamic> _card(String id, String title, int rentNaira, {int? distance, List<String> badges = const ['OWNER_VERIFIED']}) => {
      'id': id,
      'title': title,
      'rent': {'amountMinor': '${rentNaira * 100}', 'currency': 'NGN'},
      'rentPeriod': 'YEAR',
      'area': 'Ugbowo',
      'city': 'Benin City',
      'bedrooms': 2,
      'bathrooms': 2,
      'distanceM': distance,
      'badges': badges,
    };

class _FakeLocation extends LocationReader {
  _FakeLocation({this.explainedBefore = true});
  bool explainedBefore;
  @override
  Future<bool> explained() async => explainedBefore;
  @override
  Future<void> markExplained() async => explainedBefore = true;
  @override
  Future<(LocationOutcome, LatLng?)> read() async => (LocationOutcome.found, const LatLng(6.4, 5.61));
}

const _config = AppConfig(apiBaseUrl: 'http://server.test/v1', defaultCountry: 'NG');

Future<_FakeServer> _open(WidgetTester tester, String location, (int, Object?) Function(RequestOptions) handler, {bool signedIn = true, LocationReader? reader}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(360, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _FakeServer(handler);
  final store = MemoryTokenStore(signedIn ? Tokens(accessToken: 'a', accessTokenExpiresAt: DateTime.now().add(const Duration(minutes: 15)), refreshToken: 'r') : null);
  final dio = Dio(BaseOptions(baseUrl: _config.apiBaseUrl))..httpClientAdapter = server;
  final api = ApiClient(_config, dio: dio, tokens: store)..location = const LocationContext(countryCode: 'NG');
  await tester.pumpWidget(ProviderScope(
    overrides: [
      tokenStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(api),
      locationReaderProvider.overrideWithValue(reader ?? _FakeLocation()),
    ],
    child: FindHouseQuickApp(initialLocation: location),
  ));
  await tester.pumpAndSettle();
  return server;
}

(int, Object?) _results(RequestOptions r) {
  if (r.path == '/search/listings') {
    return (200, {
      'items': [_card('l1', '3 bedroom flat', 1800000), _card('l2', '2 bedroom flat', 950000)],
      'total': 2,
      'nextCursor': null,
    });
  }
  if (r.path == '/search/areas') return (200, [{'area': 'Ugbowo', 'city': 'Benin City', 'count': 18}]);
  if (r.path == '/me/saved-places' || r.path == '/me/saved-listings') return (200, <dynamic>[]);
  return (404, null);
}

void main() {
  testWidgets('the home screen greets the user and shows the newest homes in the busiest area', (tester) async {
    await _open(tester, '/home', _results);
    expect(find.textContaining(', Osaro'), findsOneWidget);
    expect(find.text('Benin City'), findsOneWidget);
    expect(find.text('Homes around me'), findsOneWidget);
    expect(find.text('Homes to rent'), findsOneWidget);
    expect(find.text('Shops and offices'), findsOneWidget);
    // Short lets are switched off, so not offered.
    expect(find.text('Short lets'), findsNothing);
    expect(find.text('New in Ugbowo'), findsOneWidget);
    expect(find.text('₦1,800,000 a year'), findsOneWidget);
  });

  testWidgets('choosing a kind of property searches the city for it and lists the results', (tester) async {
    final server = await _open(tester, '/home', _results);
    await tester.tap(find.text('Homes to rent'));
    await tester.pumpAndSettle();
    expect(find.text('Homes to rent in Benin City'), findsOneWidget);
    expect(find.textContaining('2 homes, every lister identity-checked'), findsOneWidget);
    expect(find.text('₦1,800,000'), findsOneWidget);
    expect(find.text('/year'), findsWidgets);
    expect(find.text('Verified lister'), findsWidgets);
    final last = server.searches().last;
    expect(last['city'], 'Benin City');
    expect(last['category'], 'LONG_TERM_RESIDENTIAL');
    expect(last['sort'], 'NEWEST');
  });

  testWidgets('around me asks for the location the first time, then searches around it, nearest first', (tester) async {
    final reader = _FakeLocation(explainedBefore: false);
    final server = await _open(tester, '/home', _results, reader: reader);
    await tester.tap(find.text('Homes around me'));
    await tester.pumpAndSettle();
    expect(find.text('Show homes around you?'), findsOneWidget);
    await tester.tap(find.text('Allow location'));
    await tester.pumpAndSettle();
    final last = server.searches().last;
    expect(last['near'], '6.40000,5.61000');
    expect(last['source'], 'AROUND_ME');
    expect(last['sort'], 'DISTANCE');
    expect(find.text('Homes to rent in around you'), findsNothing);
    expect(find.text('Properties in around you'), findsOneWidget);
    // Around me can be saved as an area with alerts.
    expect(find.text('Save this search'), findsOneWidget);
  });

  testWidgets('filters change the search, and the button says how many homes match', (tester) async {
    final server = await _open(tester, '/home', _results);
    await tester.tap(find.text('Homes to rent'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Filters'));
    await tester.pumpAndSettle();
    expect(find.text('Clear all'), findsOneWidget);
    expect(find.text('Flat'), findsOneWidget);
    expect(find.text('Shop'), findsNothing);
    await tester.tap(find.text('2+'));
    await tester.enterText(find.byType(TextField).at(1), '1500000');
    await tester.pumpAndSettle(const Duration(milliseconds: 500));
    expect(find.text('Show 2 homes'), findsOneWidget);
    await tester.tap(find.text('Show 2 homes'));
    await tester.pumpAndSettle();
    final last = server.searches().last;
    expect(last['minBedrooms'], 2);
    expect(last['maxRent'], '150000000');
  });

  testWidgets('a landmark found by name is searched around, at the distance chosen', (tester) async {
    final server = await _open(tester, '/search/place', (r) {
      if (r.path == '/search/places') return (200, [{'name': 'Uniben main gate', 'description': 'Landmark · Benin-Lagos Road', 'location': {'lat': 6.39, 'lng': 5.61}}]);
      return _results(r);
    });
    await tester.tap(find.text('500 m'));
    await tester.enterText(find.byType(TextField), 'uniben');
    await tester.pumpAndSettle(const Duration(milliseconds: 400));
    await tester.tap(find.text('Uniben main gate'));
    await tester.pumpAndSettle();
    final last = server.searches().last;
    expect(last['near'], '6.39000,5.61000');
    expect(last['radiusM'], 500);
    expect(last['source'], 'LANDMARK');
    expect(find.text('Uniben main gate · 500 m'), findsOneWidget);
  });

  testWidgets('when nothing matches, the screen offers a wider search with how many it finds', (tester) async {
    final server = await _open(tester, '/search/place', (r) {
      if (r.path == '/search/places') return (200, [{'name': 'Uniben main gate', 'description': '', 'location': {'lat': 6.39, 'lng': 5.61}}]);
      if (r.path == '/search/listings') {
        final wide = r.queryParameters['radiusM'] == 3000;
        return (200, {'items': wide ? [_card('l9', 'Flat', 700000)] : <dynamic>[], 'total': wide ? 9 : 0, 'nextCursor': null});
      }
      return _results(r);
    });
    await tester.tap(find.text('500 m'));
    await tester.enterText(find.byType(TextField), 'uniben');
    await tester.pumpAndSettle(const Duration(milliseconds: 400));
    await tester.tap(find.text('Uniben main gate'));
    await tester.pumpAndSettle();
    expect(find.text('No homes match yet'), findsOneWidget);
    expect(find.text('Search up to 3 km away (9 homes)'), findsOneWidget);
    expect(find.text('Alert me when one is listed'), findsOneWidget);
    await tester.tap(find.text('Search up to 3 km away (9 homes)'));
    await tester.pumpAndSettle();
    expect(server.searches().last['radiusM'], 3000);
    expect(find.text('No homes match yet'), findsNothing);
  });

  testWidgets('someone looking around without an account sees the homes and the invitation to join', (tester) async {
    await _open(tester, '/home', _results, signedIn: false);
    expect(find.text('2 homes in Benin City'), findsOneWidget);
    expect(find.text('2 bedrooms · 2 toilets'), findsWidgets);
    expect(find.text('Owner verified'), findsWidgets);
    expect(find.text('Create a free account'), findsOneWidget);
    // No bottom bar without an account.
    expect(find.text('Inspections'), findsNothing);
  });

  testWidgets('the search screens fit a 360 wide phone without spilling over', (tester) async {
    for (final path in ['/home', '/search/place', '/search/location']) {
      await _open(tester, path, _results);
      expect(tester.takeException(), isNull, reason: path);
      await tester.pumpWidget(const SizedBox());
    }
  });
}
