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
import 'package:findhousequick/src/property/property_api.dart';
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
    'contact.chat': true,
    'contact.inspection_booking': true,
    'search.compare': true,
  },
  'country': {'code': 'NG', 'name': 'Nigeria', 'currency': 'NGN', 'dialCode': '+234', 'languages': ['en'], 'defaultLanguage': 'en', 'settings': <String, dynamic>{}},
  'refreshAfterSeconds': 300,
};

var _me = <String, dynamic>{'id': 'u1', 'firstName': 'Osaro', 'lastName': 'Igbinedion', 'phoneConfirmed': true, 'emailConfirmed': true, 'types': ['TENANT'], 'verificationLevel': 1};

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

Future<_FakeServer> _open(WidgetTester tester, String location, (int, Object?) Function(RequestOptions) handler, {bool signedIn = true, LocationReader? reader, Size size = const Size(360, 6000)}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = size;
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


Map<String, dynamic> _page({Map<String, dynamic>? lister}) => {
      ..._card('l1', '3 bedroom flat', 1800000),
      'area': 'GRA',
      'bedrooms': 3,
      'bathrooms': 3,
      'kind': 'LONG_TERM',
      'description': 'A bright first-floor flat in a quiet, gated compound.',
      'photosTakenAt': '2026-10-28T10:00:00Z',
      'approximateLocation': {'lat': 6.33, 'lng': 5.62},
      'moveInCost': {
        'rent': {'amountMinor': '180000000', 'currency': 'NGN'},
        'fees': [
          {'type': 'AGENCY_FEE', 'amount': {'amountMinor': '18000000', 'currency': 'NGN'}},
          {'type': 'CAUTION_DEPOSIT', 'amount': {'amountMinor': '10000000', 'currency': 'NGN'}},
        ],
        'total': {'amountMinor': '208000000', 'currency': 'NGN'},
        'inspectionFee': 'FREE',
      },
      'availableFrom': '2026-12-01',
      'occupancyRules': {'allowed': ['FAMILIES', 'COMPANIES'], 'notes': 'no pets'},
      'unit': {'toilets': 4, 'floorLevel': 1, 'floorArea': null, 'areaUnit': 'SQM', 'details': {'water': 'Borehole with treatment'}},
      'gallery': [
        {'partCode': 'FRONT', 'partLabel': 'Front of building', 'note': null, 'media': [for (var i = 0; i < 3; i++) {'id': 'f$i', 'display': {'small': null}}]},
        {'partCode': 'LIVING', 'partLabel': 'Living room', 'note': null, 'media': [{'id': 'v1', 'display': {'small': null}}]},
        {'partCode': 'BED1', 'partLabel': 'Bedroom 1', 'note': null, 'media': [{'id': 'b1', 'display': null}]},
      ],
      'walkthrough': null,
      'savedPlaceDistances': [],
      'nearbyAmenities': [{'name': 'Hospital', 'distanceM': 1200}],
      'lister': lister,
    };

(int, Object?) Function(RequestOptions) _listing({Map<String, dynamic>? lister}) => (r) {
      if (r.path == '/listings/l1') return (200, _page(lister: lister));
      if (r.path == '/listings/l1/related') return (200, {'similar': [_card('l2', '2 bedroom flat', 950000)], 'nearby': <dynamic>[]});
      return _results(r);
    };

void main() {
  test('the property page reads the listing, leaving out photos that cannot be shown yet', () {
    final p = PropertyPage.fromJson(_page());
    expect(p.gallery.map((g) => g.label), ['Front of building', 'Living room']);
    expect(p.photos.length, 4);
    // One photo from each part first, then the rest.
    expect(p.previews.map((x) => x.id).take(2), ['f0', 'v1']);
    expect(p.totalMinor, BigInt.from(208000000));
    expect(p.fees.map((f) => f.type), ['AGENCY_FEE', 'CAUTION_DEPOSIT']);
    expect(p.lister, isNull);
  });

  testWidgets('screen 30 shows the costs, the facts and the details, and a signed-out visitor is sent to sign in to book', (tester) async {
    await _open(tester, '/homes/l1', _listing(), signedIn: false);
    expect(find.text('3 bedroom flat in GRA, Benin City'), findsOneWidget);
    expect(find.text('GRA, Benin City (approximate area)'), findsOneWidget);
    expect(find.text('Rent (1 year)'), findsOneWidget);
    expect(find.text('Agency fee'), findsOneWidget);
    expect(find.text('₦2,080,000'), findsOneWidget);
    expect(find.text('1 December 2026'), findsOneWidget);
    expect(find.text('First floor'), findsOneWidget);
    expect(find.text('Families and companies; no pets'), findsOneWidget);
    expect(find.text('Front of building (3)'), findsOneWidget);
    expect(find.text('Hospital, 1.2 km'), findsOneWidget);
    expect(find.text('Similar homes nearby'), findsOneWidget);
    // Signed out: no lister is shown, and booking leads to sign in.
    expect(find.text('Osagie Igbinedion'), findsNothing);
    await tester.tap(find.text('Book a free inspection').last);
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('someone not yet verified is asked to verify before chatting with the lister', (tester) async {
    await _open(tester, '/homes/l1', _listing(lister: {'id': 'u9', 'displayName': 'Osagie Igbinedion', 'role': 'LANDLORD', 'verified': true, 'typicalResponseMinutes': 120}));
    expect(find.text('Osagie Igbinedion'), findsOneWidget);
    expect(find.text('Verified landlord'), findsOneWidget);
    expect(find.text('Usually replies within 2 hours'), findsOneWidget);
    await tester.tap(find.text('Chat with the lister'));
    await tester.pumpAndSettle();
    expect(find.text('Verify to chat with the lister'), findsOneWidget);
  });

  testWidgets('a listing that has gone says so and offers to keep looking', (tester) async {
    await _open(tester, '/homes/l1', (r) => r.path == '/listings/l1' ? (404, {'message': 'Not found'}) : _results(r));
    expect(find.text('This home is no longer listed'), findsOneWidget);
  });

  testWidgets('the website layouts fit at 768 and 1366 without spilling over', (tester) async {
    for (final size in const [Size(768, 7000), Size(1366, 5000)]) {
      final errors = <String>[];
      final old = FlutterError.onError;
      FlutterError.onError = (d) => errors.add(d.toString());
      await _open(tester, '/homes/l1', _listing(lister: {'id': 'u9', 'displayName': 'Osagie Igbinedion', 'role': 'LANDLORD', 'verified': true}), size: size);
      FlutterError.onError = old;
      expect(errors, isEmpty, reason: errors.map((e) => e.split('\n').take(12).join('\n')).join('\n---\n'));
      expect(find.text('3 bedroom flat in GRA, Benin City'), findsOneWidget);
      expect(find.text('More from FindHouseQuick'), findsOneWidget);
    }
  });
}
