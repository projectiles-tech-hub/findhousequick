import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../controls/controls.dart';
import '../session/session.dart';
import 'search_api.dart';

/// The search the user is looking at. Screens change it; the results list follows it.
class SearchNotifier extends Notifier<SearchQuery?> {
  @override
  SearchQuery? build() => null;

  void set(SearchQuery query) => state = query;
  void setFilters(SearchFilters filters) => state = state?.copyWith(filters: filters);
  void setPlace(SearchPlace place) => state = state?.copyWith(place: place);
  void setSort(String? sort) => state = state?.copyWith(sort: () => sort);
}

final searchProvider = NotifierProvider<SearchNotifier, SearchQuery?>(SearchNotifier.new);

/// The switched-on city the app searches until the user chooses a place; empty when there is none, or several.
final defaultCityProvider = FutureProvider<CityInfo?>((ref) async {
  final country = (await ref.watch(controlsProvider.future)).country;
  if (country == null) return null;
  final cities = await ref.watch(searchApiProvider).enabledCities(country.code);
  return cities.length == 1 ? cities.first : null;
});

/// The ids of the homes the signed-in user has saved, so every heart shows the same.
class SavedListingsNotifier extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final signedIn = ref.watch(sessionProvider).value?.signedIn ?? false;
    if (!signedIn) return const {};
    return ref.read(searchApiProvider).savedListingIds();
  }

  Future<void> toggle(String id) async {
    final before = state.value ?? const <String>{};
    final saving = !before.contains(id);
    // Shown at once; put back if the server refuses.
    state = AsyncData(saving ? {...before, id} : ({...before}..remove(id)));
    try {
      saving ? await ref.read(searchApiProvider).saveListing(id) : await ref.read(searchApiProvider).unsaveListing(id);
    } catch (_) {
      state = AsyncData(before);
    }
  }
}

final savedListingsProvider = AsyncNotifierProvider<SavedListingsNotifier, Set<String>>(SavedListingsNotifier.new);

/// A search the user made, kept on this device only for "Recent searches". Places typed are kept; "around me"
/// locations never are (Specification 15.2).
class RecentSearch {
  const RecentSearch({required this.label, required this.query, required this.at});
  final String label;
  final SearchQuery query;
  final DateTime at;

  Map<String, dynamic> toJson() => {
        'label': label,
        'at': at.toIso8601String(),
        'place': {
          'label': query.place.label,
          'area': query.place.area,
          'city': query.place.city,
          'landmark': query.place.landmark,
          'radiusM': query.place.radiusM,
          if (query.place.centre != null) 'centre': query.place.centre!.toJson(),
        },
        'filters': query.filters.toJson(),
      };

  static RecentSearch? fromJson(Map<String, dynamic> j) {
    try {
      final p = (j['place'] as Map).cast<String, dynamic>();
      final SearchPlace place;
      if (p['landmark'] == true && p['centre'] != null) {
        place = SearchPlace.landmark(p['label'] as String, LatLng.fromJson(p['centre'] as Map), radiusM: (p['radiusM'] as num).toInt());
      } else if (p['area'] != null) {
        place = SearchPlace.area(p['area'] as String, city: p['city'] as String?);
      } else if (p['city'] != null) {
        place = SearchPlace.city(p['city'] as String);
      } else {
        return null;
      }
      final f = (j['filters'] as Map).cast<String, dynamic>();
      return RecentSearch(
        label: j['label'] as String,
        at: DateTime.parse(j['at'] as String),
        query: SearchQuery(
          place: place,
          filters: SearchFilters(
            category: f['category'] as String?,
            propertyType: f['propertyType'] as String?,
            minRent: f['minRent'] == null ? null : BigInt.parse(f['minRent'] as String),
            maxRent: f['maxRent'] == null ? null : BigInt.parse(f['maxRent'] as String),
            minBedrooms: (f['minBedrooms'] as num?)?.toInt(),
            furnished: f['furnished'] as String?,
            verifiedOnly: f['verifiedOnly'] == true,
          ),
        ),
      );
    } catch (_) {
      return null;
    }
  }
}

class RecentSearches extends AsyncNotifier<List<RecentSearch>> {
  static const _key = 'search.recent.v1';

  @override
  Future<List<RecentSearch>> build() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_key);
      if (saved == null) return const [];
      return [for (final e in jsonDecode(saved) as List) ?RecentSearch.fromJson((e as Map).cast<String, dynamic>())];
    } catch (_) {
      return const [];
    }
  }

  Future<void> add(String label, SearchQuery query) async {
    if (query.place.aroundMe) return;
    final list = [RecentSearch(label: label, query: query, at: DateTime.now()), ...(state.value ?? const <RecentSearch>[]).where((r) => r.label != label)].take(5).toList();
    state = AsyncData(list);
    try {
      (await SharedPreferences.getInstance()).setString(_key, jsonEncode([for (final r in list) r.toJson()]));
    } catch (_) {}
  }
}

final recentSearchesProvider = AsyncNotifierProvider<RecentSearches, List<RecentSearch>>(RecentSearches.new);
