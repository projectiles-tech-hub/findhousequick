import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../controls/controls.dart';
import '../providers.dart';

class LatLng {
  const LatLng(this.lat, this.lng);
  final double lat;
  final double lng;

  factory LatLng.fromJson(Map j) => LatLng((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble());
  Map<String, double> toJson() => {'lat': lat, 'lng': lng};
}

/// Where a search looks: around the phone, near a landmark, or by the name of an area or city.
class SearchPlace {
  const SearchPlace.aroundMe(this.centre, {this.radiusM = 2000})
      : label = null,
        area = null,
        city = null,
        landmark = false;
  const SearchPlace.landmark(String this.label, this.centre, {this.radiusM = 1000})
      : area = null,
        city = null,
        landmark = true;
  const SearchPlace.area(String this.area, {this.city})
      : label = area,
        centre = null,
        radiusM = 0,
        landmark = false;
  const SearchPlace.city(String this.city)
      : label = city,
        area = null,
        centre = null,
        radiusM = 0,
        landmark = false;

  /// What the user sees in the search box; empty for "around me".
  final String? label;
  final LatLng? centre;
  final int radiusM;
  final String? area;
  final String? city;
  final bool landmark;

  bool get aroundMe => centre != null && !landmark;

  SearchPlace withRadius(int metres) =>
      landmark ? SearchPlace.landmark(label!, centre!, radiusM: metres) : (aroundMe ? SearchPlace.aroundMe(centre!, radiusM: metres) : this);
}

/// The filters of a search, in the server's own terms (amounts in minor units).
class SearchFilters {
  const SearchFilters({this.category, this.propertyType, this.minRent, this.maxRent, this.minBedrooms, this.furnished, this.verifiedOnly = false});

  /// LONG_TERM_RESIDENTIAL, COMMERCIAL or SHORT_LET.
  final String? category;
  final String? propertyType;
  final BigInt? minRent;
  final BigInt? maxRent;
  final int? minBedrooms;
  final String? furnished;
  final bool verifiedOnly;

  bool get isEmpty =>
      category == null && propertyType == null && minRent == null && maxRent == null && minBedrooms == null && furnished == null && !verifiedOnly;

  SearchFilters copyWith({
    String? Function()? category,
    String? Function()? propertyType,
    BigInt? Function()? minRent,
    BigInt? Function()? maxRent,
    int? Function()? minBedrooms,
    String? Function()? furnished,
    bool? verifiedOnly,
  }) =>
      SearchFilters(
        category: category == null ? this.category : category(),
        propertyType: propertyType == null ? this.propertyType : propertyType(),
        minRent: minRent == null ? this.minRent : minRent(),
        maxRent: maxRent == null ? this.maxRent : maxRent(),
        minBedrooms: minBedrooms == null ? this.minBedrooms : minBedrooms(),
        furnished: furnished == null ? this.furnished : furnished(),
        verifiedOnly: verifiedOnly ?? this.verifiedOnly,
      );

  /// As stored with a saved area, so alerts match the same homes.
  Map<String, dynamic> toJson() => {
        'category': ?category,
        'propertyType': ?propertyType,
        'minRent': ?minRent?.toString(),
        'maxRent': ?maxRent?.toString(),
        'minBedrooms': ?minBedrooms,
        'furnished': ?furnished,
        if (verifiedOnly) 'verifiedOnly': true,
      };
}

class SearchQuery {
  const SearchQuery({required this.place, this.filters = const SearchFilters(), this.sort});

  final SearchPlace place;
  final SearchFilters filters;

  /// DISTANCE, PRICE_ASC, PRICE_DESC or NEWEST; the server's default when empty.
  final String? sort;

  SearchQuery copyWith({SearchPlace? place, SearchFilters? filters, String? Function()? sort}) =>
      SearchQuery(place: place ?? this.place, filters: filters ?? this.filters, sort: sort == null ? this.sort : sort());

  Map<String, dynamic> toParams({String? cursor}) {
    final f = filters;
    final p = place;
    return {
      if (p.centre != null) ...{
        'near': '${p.centre!.lat.toStringAsFixed(5)},${p.centre!.lng.toStringAsFixed(5)}',
        'radiusM': p.radiusM,
        'source': p.landmark ? 'LANDMARK' : 'AROUND_ME',
      },
      'area': ?p.area,
      'city': ?p.city,
      'category': ?f.category,
      'propertyType': ?f.propertyType,
      'minRent': ?f.minRent?.toString(),
      'maxRent': ?f.maxRent?.toString(),
      'minBedrooms': ?f.minBedrooms,
      'furnished': ?f.furnished,
      if (f.verifiedOnly) 'verifiedOnly': true,
      // Distance only makes sense from a point; otherwise the newest homes come first.
      'sort': sort ?? (p.centre != null ? 'DISTANCE' : 'NEWEST'),
      'cursor': ?cursor,
    };
  }
}

/// A listing as a search result card shows it (decision 39: the summary anyone may see).
class ListingCardData {
  const ListingCardData({
    required this.id,
    required this.title,
    required this.rentMinor,
    required this.currency,
    required this.rentPeriod,
    this.area = '',
    this.city = '',
    this.bedrooms,
    this.bathrooms,
    this.coverImage,
    this.distanceM,
    this.badges = const [],
    this.publishedAt,
    this.location,
  });

  final String id;
  final String title;
  final BigInt rentMinor;
  final String currency;
  final String rentPeriod;
  final String area;
  final String city;
  final int? bedrooms;
  final int? bathrooms;
  final String? coverImage;
  final int? distanceM;
  final List<String> badges;
  final DateTime? publishedAt;

  /// Approximate until an inspection is confirmed (Specification 4.3); where the map pin goes.
  final LatLng? location;

  bool get listerVerified => badges.contains('OWNER_VERIFIED') || badges.contains('AUTHORITY_VERIFIED');
  String get place => [area, city].where((s) => s.isNotEmpty).join(', ');

  factory ListingCardData.fromJson(Map<String, dynamic> j) {
    final rent = (j['rent'] as Map).cast<String, dynamic>();
    return ListingCardData(
      id: j['id'] as String,
      title: (j['title'] as String?) ?? '',
      rentMinor: BigInt.parse('${rent['amountMinor']}'),
      currency: rent['currency'] as String,
      rentPeriod: (j['rentPeriod'] as String?) ?? 'YEAR',
      area: (j['area'] as String?) ?? '',
      city: (j['city'] as String?) ?? '',
      bedrooms: (j['bedrooms'] as num?)?.toInt(),
      bathrooms: (j['bathrooms'] as num?)?.toInt(),
      coverImage: j['coverImage'] as String?,
      distanceM: (j['distanceM'] as num?)?.toInt(),
      badges: ((j['badges'] as List?) ?? const []).cast<String>(),
      publishedAt: j['publishedAt'] == null ? null : DateTime.tryParse(j['publishedAt'] as String),
      location: j['approximateLocation'] is Map ? LatLng.fromJson((j['approximateLocation'] as Map).cast<String, dynamic>()) : null,
    );
  }
}

class SearchPage {
  const SearchPage({required this.items, required this.total, this.nextCursor});
  final List<ListingCardData> items;
  final int total;
  final String? nextCursor;
}

/// A group of listings shown as one pin when the map is zoomed out.
class MapCluster {
  const MapCluster({required this.centre, required this.count});
  final LatLng centre;
  final int count;
}

class MapPage {
  const MapPage({required this.items, required this.clusters});
  final List<ListingCardData> items;
  final List<MapCluster> clusters;
}

/// Where the map picture comes from (GET /maps/tiles).
class TileSource {
  const TileSource({required this.urlTemplate, required this.attribution, required this.maxZoom, this.expiresAt});
  final String urlTemplate;
  final String attribution;
  final int maxZoom;
  final DateTime? expiresAt;
}

class PlaceResult {
  const PlaceResult({required this.name, required this.description, required this.location});
  final String name;
  final String description;
  final LatLng location;
}

class AreaCount {
  const AreaCount(this.area, this.city, this.count);
  final String area;
  final String city;
  final int count;
}

class PropertyTypeOption {
  const PropertyTypeOption(this.code, this.label, this.category);
  final String code;
  final String label;
  final String category;
}

class SavedPlace {
  const SavedPlace({required this.id, required this.label, required this.location});
  final String id;
  final String label;
  final LatLng location;
}

class CityInfo {
  const CityInfo(this.name, this.centre);
  final String name;
  final LatLng? centre;
}

class SearchApi {
  SearchApi(this._api);
  final ApiClient _api;

  Future<SearchPage> search(SearchQuery query, {String? cursor}) async {
    final j = await _api.getJson('/search/listings', query: query.toParams(cursor: cursor));
    return SearchPage(
      items: ((j['items'] as List?) ?? const []).map((e) => ListingCardData.fromJson((e as Map).cast<String, dynamic>())).toList(),
      total: (j['total'] as num?)?.toInt() ?? 0,
      nextCursor: j['nextCursor'] as String?,
    );
  }

  /// Only how many homes match, for the button on the filters screen and the suggestions when nothing matches.
  /// The listings inside the part of the map on screen; zoomed out, they come back grouped.
  Future<MapPage> mapArea({required LatLng south, required LatLng north, required double zoom, required SearchFilters filters}) async {
    // Only the filters: the part of the map takes the place of a centre, area or city.
    final params = SearchQuery(place: const SearchPlace.city(''), filters: filters).toParams()
      ..remove('city')
      ..remove('sort')
      ..['bbox'] = [south.lat, south.lng, north.lat, north.lng].map((v) => v.toStringAsFixed(5)).join(',')
      ..['zoom'] = zoom.floor().clamp(1, 22);
    final j = await _api.getJson('/search/listings', query: params);
    return MapPage(
      items: [for (final i in (j['items'] as List? ?? const [])) ListingCardData.fromJson((i as Map).cast<String, dynamic>())],
      clusters: [
        for (final c in (j['clusters'] as List? ?? const []))
          MapCluster(centre: LatLng.fromJson(((c as Map)['centre'] as Map).cast<String, dynamic>()), count: (c['count'] as num).toInt()),
      ],
    );
  }

  /// Null when no map provider is set on the server.
  Future<TileSource?> tileSource() async {
    final s = (await _api.getJson('/maps/tiles'))['source'];
    if (s is! Map) return null;
    return TileSource(
      urlTemplate: s['urlTemplate'] as String,
      attribution: s['attribution'] as String,
      maxZoom: (s['maxZoom'] as num).toInt(),
      expiresAt: s['expiresAt'] == null ? null : DateTime.tryParse(s['expiresAt'] as String),
    );
  }

  Future<int> count(SearchQuery query) async => (await search(query)).total;

  Future<List<PlaceResult>> places(String text) async {
    final list = await _api.getList('/search/places', query: {'q': text});
    return [
      for (final p in list.cast<Map>())
        PlaceResult(name: p['name'] as String, description: (p['description'] as String?) ?? '', location: LatLng.fromJson(p['location'] as Map)),
    ];
  }

  Future<List<AreaCount>> popularAreas({String? city, int limit = 8}) async {
    final list = await _api.getList('/search/areas', query: {'city': ?city, 'limit': limit});
    return [for (final a in list.cast<Map>()) AreaCount(a['area'] as String, (a['city'] as String?) ?? '', (a['count'] as num).toInt())];
  }

  Future<List<PropertyTypeOption>> propertyTypes(String countryCode) async {
    final list = await _api.getList('/reference/countries/$countryCode/property-types');
    return [for (final t in list.cast<Map>()) PropertyTypeOption(t['code'] as String, (t['label'] as String?) ?? t['code'] as String, t['category'] as String)];
  }

  /// The switched-on cities of the country, for the place the app searches until the user chooses one.
  Future<List<CityInfo>> enabledCities(String countryCode) async {
    final regions = await _api.getList('/reference/countries/$countryCode/regions');
    return [
      for (final r in regions.cast<Map>())
        for (final c in ((r['cities'] as List?) ?? const []).cast<Map>())
          if (c['enabled'] == true) CityInfo(c['name'] as String, c['centre'] == null ? null : LatLng.fromJson(c['centre'] as Map)),
    ];
  }

  Future<List<SavedPlace>> savedPlaces() async {
    final list = await _api.getList('/me/saved-places');
    return [for (final p in list.cast<Map>()) SavedPlace(id: p['id'] as String, label: (p['label'] as String?) ?? '', location: LatLng.fromJson(p['location'] as Map))];
  }

  Future<void> saveArea({required String name, required LatLng centre, required int radiusM, required SearchFilters filters, required bool alerts}) =>
      _api.postJson('/me/saved-searches', body: {
        'name': name,
        'area': {'centre': centre.toJson(), 'radiusM': radiusM},
        'filters': filters.toJson(),
        'alertsEnabled': alerts,
      });

  Future<Set<String>> savedListingIds() async => {for (final l in await _api.getList('/me/saved-listings')) (l as Map)['id'] as String};
  Future<void> saveListing(String id) => _api.putJson('/me/saved-listings/$id');
  Future<void> unsaveListing(String id) => _api.deleteJson('/me/saved-listings/$id');
}

final searchApiProvider = Provider<SearchApi>((ref) => SearchApi(ref.watch(apiClientProvider)));

/// The categories of rental switched on where the user is, in the order the designs show them.
List<String> enabledCategories(Controls? controls) => [
      if (controls?.isOn('listings.long_term') ?? false) 'LONG_TERM_RESIDENTIAL',
      if (controls?.isOn('listings.commercial') ?? false) 'COMMERCIAL',
      if (controls?.isOn('listings.short_let') ?? false) 'SHORT_LET',
    ];
