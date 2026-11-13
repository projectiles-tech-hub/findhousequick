import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/app_icon.dart';
import '../design/chips.dart';
import '../design/tokens.dart';
import '../l10n/languages.dart';
import '../listings/listing_collage.dart' show formatMoney, rentPeriodText;
import '../session/session.dart';
import 'search_api.dart';
import 'search_state.dart';

String distanceText(AppTexts t, int metres) {
  if (metres < 1000) return t.mAway(((metres / 100).round() * 100).clamp(100, 900));
  final km = metres / 1000;
  return t.kmAway(km < 10 ? km.toStringAsFixed(1) : km.round().toString());
}

String radiusText(AppTexts t, int metres) => metres < 1000 ? t.withinM(metres) : t.withinKm((metres / 1000).round());

String periodShort(AppTexts t, String period) => switch (period) { 'MONTH' => t.perMonthShort, 'WEEK' => t.perWeekShort, 'NIGHT' => t.perNightShort, _ => t.perYearShort };

/// Opens a listing on the property page (screen 30).
void openListing(BuildContext context, String id) => context.push('/homes/$id');

Widget _photo(String? url, {required double radius}) {
  const placeholder = ColoredBox(color: AppColors.divider, child: Center(child: AppIcon(AppIcons.camera, color: AppColors.ink400)));
  return ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: url == null ? placeholder : Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder),
  );
}

/// The full card of the results list (screen 25): the cover photo with the save button, the price, the title, the
/// place, the rooms and the verified badge.
class ResultCard extends ConsumerWidget {
  const ResultCard(this.listing, {super.key, this.width});

  final ListingCardData listing;
  final double? width;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final locale = Localizations.localeOf(context).languageCode;
    final grey = AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14);
    final rooms = <Widget>[
      if (listing.bedrooms != null) _Fact(icon: AppIcons.bed, text: listing.bedrooms == 0 ? t.rooms(1) : t.beds(listing.bedrooms!)),
      if (listing.bathrooms != null) _Fact(icon: AppIcons.bath, text: t.baths(listing.bathrooms!)),
    ];
    return Semantics(
      button: true,
      label: '${formatMoney(listing.rentMinor, listing.currency, locale)} ${rentPeriodText(t, listing.rentPeriod)}, ${listing.title}, ${listing.place}',
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium), side: const BorderSide(color: AppColors.divider)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openListing(context, listing.id),
          child: SizedBox(
            width: width,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 190,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _photo(listing.coverImage, radius: 0),
                      Positioned(top: 6, right: 6, child: SaveHeart(listingId: listing.id)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                  child: ExcludeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Flexible(child: Text(formatMoney(listing.rentMinor, listing.currency, locale), style: AppText.price.copyWith(height: 24 / 20))),
                            const SizedBox(width: 4),
                            Text(periodShort(t, listing.rentPeriod), style: grey),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(listing.title, style: AppText.body.copyWith(fontWeight: FontWeight.w500, fontVariations: const [FontVariation('wght', 500)], height: 19 / 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const AppIcon(AppIcons.location, size: 16, color: AppColors.ink600),
                            const SizedBox(width: 4),
                            Expanded(child: Text(listing.distanceM == null ? listing.place : '${listing.place} · ${distanceText(t, listing.distanceM!)}', style: grey, maxLines: 1, overflow: TextOverflow.ellipsis)),
                          ],
                        ),
                        if (rooms.isNotEmpty) ...[const SizedBox(height: 6), Wrap(spacing: 16, children: rooms)],
                        if (listing.listerVerified) ...[const SizedBox(height: 10), AppTag(label: t.verifiedLister, kind: AppTagKind.verified)],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});
  final AppIcons icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [AppIcon(icon, size: 16, color: AppColors.ink600), const SizedBox(width: 4), Text(text, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14))],
      );
}

/// The small card of the home screen and the signed-out screen: a square photo beside the price, title and place.
class CompactCard extends ConsumerWidget {
  const CompactCard(this.listing, {super.key, this.subtitle, this.badge});

  final ListingCardData listing;

  /// The second line; the title when empty.
  final String? subtitle;

  /// The words on the badge; none when the lister is not verified.
  final String? badge;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final locale = Localizations.localeOf(context).languageCode;
    final place = listing.distanceM == null ? listing.area : '${listing.area} · ${distanceText(t, listing.distanceM!)}';
    return Semantics(
      button: true,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium), side: const BorderSide(color: AppColors.divider)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openListing(context, listing.id),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 96, height: 96, child: _photo(listing.coverImage, radius: AppRadius.small)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${formatMoney(listing.rentMinor, listing.currency, locale)} ${rentPeriodText(t, listing.rentPeriod)}', style: AppText.price.copyWith(height: 24 / 20), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(subtitle ?? listing.title, style: AppText.body.copyWith(height: 20 / 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(place, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (badge != null && listing.listerVerified) ...[const SizedBox(height: 4), AppTag(label: badge!, kind: AppTagKind.verified)],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The heart on a card. Signed-out users are taken to sign in; the server keeps the list of saved homes.
class SaveHeart extends ConsumerWidget {
  const SaveHeart({super.key, required this.listingId});
  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final signedIn = ref.watch(sessionProvider).value?.signedIn ?? false;
    final saved = ref.watch(savedListingsProvider).value?.contains(listingId) ?? false;
    final label = !signedIn ? t.signInToSave : (saved ? t.unsaveHome : t.saveHome);
    return Semantics(
      button: true,
      toggled: saved,
      label: label,
      child: Tooltip(
        message: label,
        excludeFromSemantics: true,
        child: InkResponse(
          radius: 24,
          onTap: () => signedIn ? ref.read(savedListingsProvider.notifier).toggle(listingId) : context.push('/sign-in'),
          // A white circle 36 across, as drawn; the tap area around it is 48.
          child: SizedBox(
            width: 48,
            height: 48,
            child: Center(
              child: Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
                child: AppIcon(saved ? AppIcons.heartFilled : AppIcons.heart, size: 20, color: saved ? AppColors.green700 : AppColors.ink900),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
