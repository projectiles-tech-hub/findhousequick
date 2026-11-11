import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../design/app_icon.dart';
import '../design/tokens.dart';
import '../l10n/languages.dart';
import '../providers.dart';

/// What a listing card shows of a listing (the summary anyone may see, decision 39).
class ListingSummary {
  const ListingSummary({
    required this.id,
    required this.title,
    required this.area,
    required this.rentMinor,
    required this.currency,
    required this.rentPeriod,
    required this.verified,
    this.coverImage,
    this.publishedAt,
  });

  final String id;
  final String title;
  final String area;
  final BigInt rentMinor;
  final String currency;
  final String rentPeriod;
  final bool verified;
  final String? coverImage;
  final DateTime? publishedAt;

  factory ListingSummary.fromJson(Map<String, dynamic> j) {
    final rent = (j['rent'] as Map).cast<String, dynamic>();
    return ListingSummary(
      id: j['id'] as String,
      title: (j['title'] as String?) ?? '',
      area: (j['area'] as String?) ?? '',
      rentMinor: BigInt.parse('${rent['amountMinor']}'),
      currency: rent['currency'] as String,
      rentPeriod: (j['rentPeriod'] as String?) ?? 'YEAR',
      verified: ((j['badges'] as List?) ?? const []).isNotEmpty,
      coverImage: j['coverImage'] as String?,
      publishedAt: j['publishedAt'] == null ? null : DateTime.tryParse(j['publishedAt'] as String),
    );
  }
}

/// Money as people write it: the currency's own sign and number of decimal places, with no decimals when the amount
/// is a whole number of the main unit ("₦1,200,000"). Amounts arrive in minor units (kobo, cents) and stay whole.
String formatMoney(BigInt minor, String currency, String locale) {
  final format = NumberFormat.simpleCurrency(name: currency, locale: locale == 'pcm' ? 'en' : locale);
  final digits = format.decimalDigits ?? 2;
  var unit = BigInt.one;
  for (var i = 0; i < digits; i++) {
    unit *= BigInt.from(10);
  }
  final whole = minor ~/ unit;
  final rest = minor.remainder(unit);
  final grouped = NumberFormat.decimalPattern(locale == 'pcm' ? 'en' : locale).format(whole.toInt());
  return rest == BigInt.zero ? '${format.currencySymbol}$grouped' : '${format.currencySymbol}$grouped.${rest.toString().padLeft(digits, '0')}';
}

String rentPeriodText(AppTexts t, String period) => switch (period) { 'MONTH' => t.perMonth, 'WEEK' => t.perWeek, 'NIGHT' => t.perNight, _ => t.perYear };

String listedAgo(AppTexts t, DateTime published, DateTime now) {
  final d = now.difference(published);
  if (d.inMinutes < 60) return t.listedMinutesAgo(d.inMinutes < 1 ? 1 : d.inMinutes);
  if (d.inHours < 24) return t.listedHoursAgo(d.inHours);
  return t.listedDaysAgo(d.inDays);
}

/// The newest listings and how many are live, for the picture beside the sign-up card.
final newestListingsProvider = FutureProvider<({List<ListingSummary> items, int total})>((ref) async {
  final json = await ref.watch(apiClientProvider).getJson('/search/listings', query: {'sort': 'NEWEST'});
  final items = ((json['items'] as List?) ?? const []).map((e) => ListingSummary.fromJson((e as Map).cast<String, dynamic>())).toList();
  return (items: items, total: (json['total'] as num?)?.toInt() ?? items.length);
});

/// The picture beside the sign-up card on the website: the two newest listings, how many properties are
/// available, and the promise that every lister is identity-checked. It shows real listings; with none to show,
/// only the promise is drawn.
class ListingCollage extends ConsumerWidget {
  const ListingCollage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final data = ref.watch(newestListingsProvider).value;
    final items = data?.items ?? const <ListingSummary>[];
    Widget pill(Widget lead, String words, {required Color bg, required Color fg}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              lead,
              const SizedBox(width: 6),
              Text(words, style: AppText.label.copyWith(color: fg, fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 19 / 14)),
            ],
          ),
        );
    return ExcludeSemantics(
      child: SizedBox(
        width: 440,
        height: 500,
        child: Stack(
          children: [
            if (items.isNotEmpty) Positioned(left: 190, top: 0, child: _Card(items.first, width: 240, photoHeight: 140)),
            if (items.length > 1) Positioned(left: 0, top: 170, child: _Card(items[1], width: 260, photoHeight: 150)),
            if (data != null && data.total > 0)
              Positioned(
                left: 0,
                top: 96,
                child: pill(
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle)),
                  t.propertiesAvailable(data.total),
                  bg: AppColors.ink900,
                  fg: AppColors.surface,
                ),
              ),
            Positioned(
              left: 190,
              top: 440,
              child: pill(const AppIcon(AppIcons.shieldCheck, size: 18, color: AppColors.verified), t.everyListerChecked, bg: AppColors.surface, fg: AppColors.verified),
            ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card(this.listing, {required this.width, required this.photoHeight});

  final ListingSummary listing;
  final double width;
  final double photoHeight;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final locale = Localizations.localeOf(context).languageCode;
    final w600 = AppText.label.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 19 / 14);
    const placeholder = ColoredBox(color: AppColors.divider, child: Center(child: AppIcon(AppIcons.camera, color: AppColors.ink500)));
    return Container(
      width: width,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: photoHeight,
            width: width,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (listing.coverImage == null) placeholder else Image.network(listing.coverImage!, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder),
                if (listing.publishedAt != null)
                  Positioned(
                    left: 12,
                    top: 12,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(10, 5, 10, 4),
                      decoration: BoxDecoration(color: AppColors.ink900, borderRadius: BorderRadius.circular(20)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          Text(listedAgo(t, listing.publishedAt!, DateTime.now()), style: w600.copyWith(color: AppColors.surface)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(child: Text(formatMoney(listing.rentMinor, listing.currency, locale), style: AppText.price, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    const SizedBox(width: 6),
                    Text(rentPeriodText(t, listing.rentPeriod), style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 19 / 14)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(listing.title, style: AppText.body.copyWith(fontWeight: FontWeight.w500, fontVariations: const [FontVariation('wght', 500)], height: 21 / 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const AppIcon(AppIcons.location, size: 18, color: AppColors.ink500),
                    const SizedBox(width: 4),
                    Expanded(child: Text(listing.area, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 19 / 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ],
                ),
                if (listing.verified) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.fromLTRB(10, 4, 10, 4),
                    decoration: BoxDecoration(color: AppColors.infoTint, borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const AppIcon(AppIcons.shieldCheck, size: 18, color: AppColors.verified),
                        const SizedBox(width: 4),
                        Text(t.verified, style: w600.copyWith(color: AppColors.verified)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
