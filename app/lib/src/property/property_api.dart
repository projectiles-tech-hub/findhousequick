import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../providers.dart';
import '../search/search_api.dart';

/// A photo of the home, with its display copies behind links that expire after 15 minutes (ADR 0009).
class PropertyPhoto {
  const PropertyPhoto({required this.id, required this.partLabel, this.small, this.medium, this.large});
  final String id;
  final String partLabel;
  final String? small;
  final String? medium;
  final String? large;

  String? get best => large ?? medium ?? small;
  String? get thumb => small ?? medium ?? large;
}

/// One part of the checklist (front, living room, bedroom 1...) with its photos.
class GalleryPart {
  const GalleryPart({required this.code, required this.label, required this.photos, this.note});
  final String code;
  final String label;
  final String? note;
  final List<PropertyPhoto> photos;
}

class FeeLine {
  const FeeLine(this.type, this.amountMinor);

  /// AGENCY_FEE, LEGAL_FEE, CAUTION_DEPOSIT or SERVICE_CHARGE (decision 55: only the types shown in the country).
  final String type;
  final BigInt amountMinor;
}

class Lister {
  const Lister({required this.id, required this.name, required this.landlord, required this.verified, this.replyMinutes});
  final String id;
  final String name;
  final bool landlord;
  final bool verified;
  final int? replyMinutes;

  String get initials => name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();
}

class Amenity {
  const Amenity(this.name, this.distanceM);
  final String name;
  final int? distanceM;
}

class SavedPlaceDistance {
  const SavedPlaceDistance(this.name, this.distanceM);
  final String name;
  final int distanceM;
}

/// The property page (screen 30): the full listing anyone may see (decision 75), with the lister for signed-in users.
class PropertyPage {
  const PropertyPage({
    required this.card,
    required this.kind,
    required this.description,
    required this.fees,
    required this.totalMinor,
    required this.gallery,
    required this.toilets,
    required this.details,
    this.propertyTypeLabel = '',
    this.serviceChargeCovers,
    this.availableFrom,
    this.photosTakenAt,
    this.floorLevel,
    this.floorArea,
    this.areaUnit = 'SQM',
    this.allowed = const [],
    this.occupancyNotes,
    this.lister,
    this.amenities = const [],
    this.savedPlaces = const [],
    this.hasWalkthrough = false,
  });

  final ListingCardData card;
  final String kind;
  final String description;
  final String propertyTypeLabel;
  final List<FeeLine> fees;
  final BigInt totalMinor;
  final String? serviceChargeCovers;
  final DateTime? availableFrom;
  final DateTime? photosTakenAt;
  final List<GalleryPart> gallery;
  final int toilets;
  final int? floorLevel;
  final num? floorArea;
  final String areaUnit;
  final Map<String, dynamic> details;
  final List<String> allowed;
  final String? occupancyNotes;
  final Lister? lister;
  final List<Amenity> amenities;
  final List<SavedPlaceDistance> savedPlaces;
  final bool hasWalkthrough;

  bool get shortLet => kind == 'SHORT_LET';
  List<PropertyPhoto> get photos => [for (final g in gallery) ...g.photos];

  /// The photos shown first: one from each part (front, living room, bedroom 1...), as drawn, then the rest.
  List<PropertyPhoto> get previews {
    final firsts = [for (final g in gallery) g.photos.first];
    return [...firsts, ...photos.where((p) => !firsts.contains(p))];
  }

  factory PropertyPage.fromJson(Map<String, dynamic> j) {
    final cost = (j['moveInCost'] as Map).cast<String, dynamic>();
    BigInt minor(Object? m) => BigInt.parse('${(m as Map)['amountMinor']}');
    final unit = ((j['unit'] as Map?) ?? const {}).cast<String, dynamic>();
    final rules = (j['occupancyRules'] as Map?)?.cast<String, dynamic>();
    final lister = (j['lister'] as Map?)?.cast<String, dynamic>();
    DateTime? day(Object? s) => s is String ? DateTime.tryParse(s) : null;
    return PropertyPage(
      card: ListingCardData.fromJson(j),
      kind: (j['kind'] as String?) ?? 'LONG_TERM',
      description: (j['description'] as String?) ?? '',
      propertyTypeLabel: (j['propertyTypeLabel'] as String?) ?? '',
      fees: [for (final f in (cost['fees'] as List? ?? const [])) FeeLine((f as Map)['type'] as String, minor(f['amount']))],
      totalMinor: minor(cost['total']),
      serviceChargeCovers: j['serviceChargeCovers'] as String?,
      availableFrom: day(j['availableFrom']),
      photosTakenAt: day(j['photosTakenAt']),
      gallery: [
        for (final g in (j['gallery'] as List? ?? const []))
          GalleryPart(
            code: (g as Map)['partCode'] as String,
            label: g['partLabel'] as String,
            note: g['note'] as String?,
            photos: [
              for (final m in (g['media'] as List? ?? const []))
                if ((m as Map)['display'] is Map)
                  PropertyPhoto(
                    id: m['id'] as String,
                    partLabel: g['partLabel'] as String,
                    small: (m['display'] as Map)['small'] as String?,
                    medium: (m['display'] as Map)['medium'] as String?,
                    large: (m['display'] as Map)['large'] as String?,
                  ),
            ],
          ),
      ].where((g) => g.photos.isNotEmpty).toList(),
      toilets: (unit['toilets'] as num?)?.toInt() ?? 0,
      floorLevel: (unit['floorLevel'] as num?)?.toInt(),
      floorArea: unit['floorArea'] as num?,
      areaUnit: (unit['areaUnit'] as String?) ?? 'SQM',
      details: ((unit['details'] as Map?) ?? const {}).cast<String, dynamic>(),
      allowed: ((rules?['allowed'] as List?) ?? const []).cast<String>(),
      occupancyNotes: rules?['notes'] as String?,
      lister: lister == null
          ? null
          : Lister(
              id: lister['id'] as String,
              name: (lister['displayName'] as String?) ?? '',
              landlord: lister['role'] == 'LANDLORD',
              verified: lister['verified'] == true,
              replyMinutes: (lister['typicalResponseMinutes'] as num?)?.toInt(),
            ),
      amenities: [for (final a in (j['nearbyAmenities'] as List? ?? const [])) Amenity((a as Map)['name'] as String, (a['distanceM'] as num?)?.toInt())],
      savedPlaces: [for (final p in (j['savedPlaceDistances'] as List? ?? const [])) SavedPlaceDistance((p as Map)['name'] as String, (p['distanceM'] as num).toInt())],
      hasWalkthrough: j['walkthrough'] != null,
    );
  }
}

class RelatedHomes {
  const RelatedHomes({this.similar = const [], this.nearby = const []});
  final List<ListingCardData> similar;
  final List<ListingCardData> nearby;
}

class PropertyApi {
  PropertyApi(this._api);
  final ApiClient _api;

  Future<PropertyPage> page(String id) async => PropertyPage.fromJson(await _api.getJson('/listings/$id'));

  Future<RelatedHomes> related(String id) async {
    final j = await _api.getJson('/listings/$id/related');
    List<ListingCardData> cards(Object? l) => [for (final c in (l as List? ?? const [])) ListingCardData.fromJson((c as Map).cast<String, dynamic>())];
    return RelatedHomes(similar: cards(j['similar']), nearby: cards(j['nearby']));
  }
}

final propertyApiProvider = Provider<PropertyApi>((ref) => PropertyApi(ref.watch(apiClientProvider)));

/// One fetch per opening: photo links expire after 15 minutes and each opening counts as a view (decision 52).
final propertyPageProvider = FutureProvider.autoDispose.family<PropertyPage, String>((ref, id) => ref.watch(propertyApiProvider).page(id));
final relatedHomesProvider = FutureProvider.autoDispose.family<RelatedHomes, String>((ref, id) => ref.watch(propertyApiProvider).related(id));
