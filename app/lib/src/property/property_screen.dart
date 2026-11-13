import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/chips.dart';
import '../design/tokens.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';
import '../providers.dart';
import '../listings/listing_collage.dart' show formatMoney;
import '../search/listing_cards.dart';
import '../search/search_api.dart';
import '../search/search_state.dart';
import '../session/session.dart';
import '../verification/verification_parts.dart';
import 'property_api.dart';
import 'property_wide.dart';

// ---------------------------------------------------------------------------------------------------------------
// Words shared by the phone and website layouts
// ---------------------------------------------------------------------------------------------------------------

String headline(PropertyPage p) => p.card.area.isEmpty ? p.card.title : '${p.card.title} in ${p.card.place}';

/// "per year", as the price on the property page says it.
String periodLong(AppTexts t, String p) => switch (p) {
  'MONTH' => t.periodPerMonth,
  'WEEK' => t.periodPerWeek,
  'NIGHT' => t.periodPerNight,
  _ => t.periodPerYear,
};

String feeName(AppTexts t, String type) => switch (type) {
  'AGENCY_FEE' => t.feeAgency,
  'LEGAL_FEE' => t.feeLegal,
  'CAUTION_DEPOSIT' => t.feeCaution,
  'SERVICE_CHARGE' => t.feeService,
  _ => type,
};

/// "First floor", "Ground floor".
String floorText(AppTexts t, int level) {
  if (level == 0) return t.groundFloor;
  if (level < 0) return t.basement;
  return t.floorNumber('$level');
}

/// "SEMI_FURNISHED" becomes "Semi furnished"; lists are joined with semicolons.
String plainValue(Object? v) {
  if (v is List) return v.map(plainValue).where((s) => s.isNotEmpty).join('; ');
  if (v is bool) return v ? 'Yes' : 'No';
  if (v == null) return '';
  final s = '$v';
  if (!RegExp(r'^[A-Z0-9_]+$').hasMatch(s)) return s;
  final lower = s.toLowerCase().replaceAll('_', ' ');
  return lower[0].toUpperCase() + lower.substring(1);
}

/// "roadCondition" becomes "Road condition".
String detailLabel(String key) {
  final spaced = key.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}').replaceAll('_', ' ').toLowerCase();
  return spaced.isEmpty ? spaced : spaced[0].toUpperCase() + spaced.substring(1);
}

/// "1 December 2026", as drawn.
String dateText(BuildContext context, DateTime d) => DateFormat('d MMMM y', Localizations.localeOf(context).toLanguageTag()).format(d);

/// The facts box: label and value pairs, empty ones left out.
List<(String, String)> propertyFacts(BuildContext context, PropertyPage p) {
  final t = context.texts;
  return [
    if (p.card.bedrooms != null) (t.factBedrooms, '${p.card.bedrooms}'),
    if (p.card.bathrooms != null) (t.factBathrooms, '${p.card.bathrooms}'),
    (t.factToilets, '${p.toilets}'),
    if (p.floorLevel != null) (t.factFloor, floorText(t, p.floorLevel!)),
    if (p.floorArea != null) (t.factFloorArea, '${p.floorArea} ${p.areaUnit == 'SQFT' ? 'sq ft' : 'm²'}'),
    if (p.availableFrom != null) (t.factAvailableFrom, dateText(context, p.availableFrom!)),
    if (p.photosTakenAt != null) (t.factPhotosTaken, dateText(context, p.photosTakenAt!)),
  ];
}

/// The key details box: what the lister filled in about the unit, and who can rent it.
List<(String, String)> keyDetails(AppTexts t, PropertyPage p) {
  // "Families and companies": the kinds of tenant allowed, as one phrase.
  final kinds = [for (final (i, a) in p.allowed.indexed) i == 0 ? plainValue(a) : plainValue(a).toLowerCase()];
  final allowed = kinds.length < 2 ? kinds.join() : '${kinds.sublist(0, kinds.length - 1).join(', ')} and ${kinds.last}';
  return [
    for (final e in p.details.entries)
      if (plainValue(e.value).isNotEmpty) (detailLabel(e.key), plainValue(e.value)),
    if (allowed.isNotEmpty) (t.whoCanRent, [allowed, ?p.occupancyNotes].where((s) => s.isNotEmpty).join('; ')),
  ];
}

String amenityText(AppTexts t, Amenity a) {
  if (a.distanceM == null) return a.name;
  final d = a.distanceM!;
  return '${a.name}, ${d >= 1000 ? '${(d / 1000).toStringAsFixed(1)} km' : '$d m'}';
}

/// Opens a page of the public website (the help pages), in a new tab on the web.
void openWebsite(WidgetRef ref, String path) => launchUrl(Uri.parse('${ref.read(appConfigProvider).webUrl}$path'), webOnlyWindowName: '_blank');

// ---------------------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------------------

/// Booking an inspection and chatting with the lister need level 2 on the server (verified identity). Signed-out
/// visitors go to sign in; others not yet verified get screen 13, Verify to continue. The booking and chat screens
/// themselves are part 4; until then a verified user is taken to the Inspections or Messages tab.
Future<void> contactAction(BuildContext context, WidgetRef ref, {required bool book}) async {
  final t = context.texts;
  final session = ref.read(sessionProvider).value;
  if (session == null || !session.signedIn) {
    await context.push('/sign-in');
    return;
  }
  if ((session.me?.verificationLevel ?? 0) < 2) {
    final String idType = ref.read(controlsProvider).value?.country?.acceptedIdTypes.firstOrNull ?? 'ID';
    final go = await showVerifySheet(context, title: book ? t.verifyToBook : t.verifyToChat, idType: idType);
    if (go && context.mounted) await context.push('/verification');
    return;
  }
  if (context.mounted) context.go(book ? '/inspections' : '/messages');
}

/// Opens the photos by room (screen 31), at a part when one is given.
void openGallery(BuildContext context, String listingId, {String? part}) =>
    context.push(part == null ? '/homes/$listingId/photos' : '/homes/$listingId/photos?part=${Uri.encodeComponent(part)}');

void openPhoto(BuildContext context, String listingId, int index) => context.push('/homes/$listingId/photo/$index');

// ---------------------------------------------------------------------------------------------------------------
// Screen 30, the property page
// ---------------------------------------------------------------------------------------------------------------

class PropertyScreen extends ConsumerWidget {
  const PropertyScreen({super.key, required this.listingId});
  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(propertyPageProvider(listingId));
    return page.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.green700)),
      ),
      error: (e, _) => _PageProblem(error: e, onRetry: () => ref.invalidate(propertyPageProvider(listingId))),
      data: (p) => AppWide.of(context) ? PropertyWideLayout(page: p) : _PhoneLayout(page: p),
    );
  }
}

class _PageProblem extends StatelessWidget {
  const _PageProblem({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final gone = error is ApiException && (error as ApiException).statusCode == 404;
    final limit = error is ApiException && (error as ApiException).statusCode == 429;
    final (title, text) = gone
        ? (t.homeGoneTitle, t.homeGoneText)
        : limit
        ? (t.viewLimitTitle, t.viewLimitText)
        : (t.somethingWentWrong, t.noConnectionMessage);
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: AppIconButton(icon: AppIcons.back, label: t.back, onPressed: () => context.canPop() ? context.pop() : context.go('/home')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Semantics(
            header: true,
            child: Text(title, style: AppText.title.copyWith(height: 27 / 22)),
          ),
          const SizedBox(height: 12),
          Text(text, style: AppText.body.copyWith(color: AppColors.ink600)),
          const SizedBox(height: 24),
          if (limit)
            AppButton(label: t.signIn, onPressed: () => context.push('/sign-in'))
          else if (gone)
            AppButton(label: t.startLooking, onPressed: () => context.go('/home'))
          else
            AppButton(label: t.tryAgain, onPressed: onRetry),
        ],
      ),
    );
  }
}

/// A white box with a thin border, as every section of the page is drawn.
class PropertyBox extends StatelessWidget {
  const PropertyBox({super.key, required this.child, this.tint = false, this.padding});
  final Widget child;
  final bool tint;

  /// 16 on the phone and 24 on the website, as drawn, unless given.
  final double? padding;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(padding ?? (AppWide.of(context) ? 24 : 16)),
    decoration: BoxDecoration(
      color: tint ? AppColors.green50 : AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.medium),
      border: tint ? null : Border.all(color: AppColors.divider),
    ),
    child: child,
  );
}

Widget boxTitle(String text) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: Semantics(
    header: true,
    child: Text(text, style: AppText.title.copyWith(height: 26 / 22)),
  ),
);

/// A photo of the home, or the grey box with its part's name while it loads or when it cannot be shown.
class HomePhoto extends StatelessWidget {
  const HomePhoto({super.key, required this.url, required this.label, this.radius = AppRadius.medium, this.dark = false, this.overlay});
  final String? url;
  final String label;
  final double radius;
  final bool dark;
  final String? overlay;

  @override
  Widget build(BuildContext context) {
    Widget grey() => ColoredBox(
      color: AppColors.divider,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppIcon(AppIcons.image, color: AppColors.green700),
            const SizedBox(height: 6),
            Text(
              label,
              style: AppText.bodySmall.copyWith(color: AppColors.ink600),
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (url == null) grey() else Image.network(url!, fit: BoxFit.cover, errorBuilder: (_, _, _) => grey()),
          if (overlay != null)
            ColoredBox(
              color: AppColors.ink900.withValues(alpha: url == null ? 1 : 0.6),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const AppIcon(AppIcons.image, color: AppColors.green700),
                    const SizedBox(height: 6),
                    Text(
                      overlay!,
                      style: AppText.bodySmall.copyWith(color: AppColors.surface),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// "Inspections are free": the amber badge.
class FreeBadge extends StatelessWidget {
  const FreeBadge({super.key});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: AppColors.amber100, borderRadius: BorderRadius.circular(AppRadius.small)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const AppIcon(AppIcons.home, size: 18, color: AppColors.warning),
        const SizedBox(width: 4),
        Flexible(
          child: Text(context.texts.inspectionsAreFree, style: AppText.label.copyWith(color: AppColors.warning)),
        ),
      ],
    ),
  );
}

/// An outlined chip that only shows words (rooms, nearby places).
class InfoChip extends StatelessWidget {
  const InfoChip({super.key, required this.label, this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: onTap != null,
    child: Material(
      color: AppColors.surface,
      shape: const StadiumBorder(side: BorderSide(color: AppColors.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Text(
            label,
            style: AppText.label.copyWith(color: AppColors.ink900, height: 17 / 14),
          ),
        ),
      ),
    ),
  );
}

/// The price, the badges, the two contact buttons, the lister, and the move-in costs.
/// "Book a free inspection" and "Chat with the lister": one under the other (phone, 1366), side by side (768).
class ContactButtons extends ConsumerWidget {
  const ContactButtons({super.key, this.row = false});
  final bool row;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final controls = ref.watch(controlsProvider).value;
    final buttons = [
      if (controls?.isOn('contact.inspection_booking') ?? true) AppButton(label: t.bookFreeInspection, onPressed: () => contactAction(context, ref, book: true)),
      if (controls?.isOn('contact.chat') ?? false) AppButton(label: t.chatWithLister, kind: AppButtonKind.outline, onPressed: () => contactAction(context, ref, book: false)),
    ];
    if (row) return Row(children: [for (final (i, b) in buttons.indexed) ...[if (i > 0) const SizedBox(width: 12), Expanded(child: b)]]);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final (i, b) in buttons.indexed) ...[if (i > 0) SizedBox(height: AppWide.of(context) ? 16 : 12), b]]);
  }
}

class CostsBox extends ConsumerWidget {
  const CostsBox({super.key, required this.page, this.side = false});
  final PropertyPage page;

  /// At 1366 the costs stand on their own beside the details: the badges, buttons and lister are drawn elsewhere.
  final bool side;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final locale = Localizations.localeOf(context).languageCode;
    final c = page.card;
    String money(BigInt m) => formatMoney(m, c.currency, locale);
    final grey = AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16);
    Widget line(String label, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(child: Text(label, style: grey)),
          const SizedBox(width: 8),
          Text(value, style: AppText.body.copyWith(height: 19 / 16)),
        ],
      ),
    );
    final periodWord = switch (c.rentPeriod) {
      'MONTH' => t.rentOneMonth,
      'WEEK' => t.rentOneWeek,
      'NIGHT' => t.rentOneNight,
      _ => t.rentOneYear,
    };
    return PropertyBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 6,
            children: [
              Text(money(c.rentMinor), style: AppText.display.copyWith(height: 34 / 28)),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(periodLong(t, c.rentPeriod), style: grey),
              ),
            ],
          ),
          if (!side) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (c.listerVerified) AppTag(label: t.verifiedLister, kind: AppTagKind.verified),
                const FreeBadge(),
              ],
            ),
            const SizedBox(height: 12),
            ContactButtons(row: AppWide.of(context)),
            if (page.lister != null) ...[const SizedBox(height: 12), ListerTile(lister: page.lister!)],
          ],
          const SizedBox(height: 12),
          Text(page.shortLet ? t.whatYouPay : t.totalToMoveIn, style: AppText.subtitle.copyWith(height: 22 / 18)),
          const SizedBox(height: 12),
          line(t.rentFor(periodWord), money(c.rentMinor)),
          for (final f in page.fees)
            line(
              f.type == 'SERVICE_CHARGE' && (page.serviceChargeCovers ?? '').isNotEmpty ? '${feeName(t, f.type)} (${page.serviceChargeCovers})' : feeName(t, f.type),
              money(f.amountMinor),
            ),
          const Divider(height: 1, color: AppColors.divider),
          Padding(
            padding: const EdgeInsets.only(top: 13),
            child: Row(
              children: [
                Expanded(
                  child: Text(page.shortLet ? t.totalLabel : t.totalToMoveIn, style: AppText.subtitle.copyWith(height: 22 / 18)),
                ),
                Text(money(page.totalMinor), style: AppText.price.copyWith(height: 24 / 20)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: BoxDecoration(color: AppColors.amber100, borderRadius: BorderRadius.circular(AppRadius.small)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AppIcon(AppIcons.home, color: AppColors.green700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    t.noHiddenFees,
                    style: AppText.bodySmall.copyWith(color: AppColors.warning, height: 17 / 14),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ListerTile extends StatelessWidget {
  const ListerTile({super.key, required this.lister});
  final Lister lister;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final grey = AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(AppRadius.small)),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
            child: Text(lister.initials, style: AppText.subtitle.copyWith(color: AppColors.green700)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(lister.name, style: AppText.subtitle.copyWith(height: 22 / 18)),
                if (lister.verified)
                  Row(
                    children: [
                      const AppIcon(AppIcons.shieldCheck, size: 16, color: AppColors.verified),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          lister.landlord ? t.verifiedLandlord : t.verifiedAgent,
                          style: AppText.bodySmall.copyWith(color: AppColors.verified, height: 17 / 14),
                        ),
                      ),
                    ],
                  ),
                if (lister.replyMinutes != null)
                  Text(lister.replyMinutes! < 60 ? t.repliesMinutes(lister.replyMinutes!) : t.repliesHours((lister.replyMinutes! / 60).round()), style: grey),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Two columns of label and value.
class FactsBox extends StatelessWidget {
  const FactsBox({super.key, required this.facts, this.columns = 2});
  final List<(String, String)> facts;
  final int columns;

  @override
  Widget build(BuildContext context) => PropertyBox(
    child: LayoutBuilder(
      builder: (context, box) {
        final w = (box.maxWidth - 24 * (columns - 1)) / columns;
        return Wrap(
          spacing: 24,
          runSpacing: 12,
          children: [
            for (final (k, v) in facts)
              SizedBox(
                width: w,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      k,
                      style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14),
                    ),
                    Text(v, style: AppText.body.copyWith(fontSize: 17, height: 24 / 17)),
                  ],
                ),
              ),
          ],
        );
      },
    ),
  );
}

class PhotosByRoomBox extends StatelessWidget {
  const PhotosByRoomBox({super.key, required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return PropertyBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          boxTitle(t.photosByRoom),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final g in page.gallery)
                InfoChip(
                  label: '${g.label} (${g.photos.length})',
                  onTap: () => openGallery(context, page.card.id, part: g.code),
                ),
            ],
          ),
          if (page.hasWalkthrough) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () => context.push('/homes/${page.card.id}/walkthrough'),
              child: Row(
                children: [
                  Container(
                    width: 120,
                    height: 80,
                    decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(AppRadius.medium)),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const AppIcon(AppIcons.play, color: AppColors.green700),
                        const SizedBox(height: 4),
                        Text(t.video, style: AppText.bodySmall.copyWith(color: AppColors.ink600)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.walkthroughVideo, style: AppText.subtitle.copyWith(height: 22 / 18)),
                        Text(
                          t.walkthroughText,
                          style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class KeyDetailsBox extends StatelessWidget {
  const KeyDetailsBox({super.key, required this.details});
  final List<(String, String)> details;

  @override
  Widget build(BuildContext context) => PropertyBox(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        boxTitle(context.texts.keyDetails),
        for (final (i, (k, v)) in details.indexed) ...[
          if (i > 0) const SizedBox(height: 12),
          Text(
            k,
            style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14),
          ),
          Text(v, style: AppText.body.copyWith(fontSize: 17, height: 21 / 17)),
        ],
      ],
    ),
  );
}

class AboutBox extends StatelessWidget {
  const AboutBox({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => PropertyBox(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        boxTitle(context.texts.aboutThisHome),
        Text(text, style: AppText.body.copyWith(fontSize: 17, height: 19 / 17)),
      ],
    ),
  );
}

class LocationBox extends StatelessWidget {
  const LocationBox({super.key, required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return PropertyBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          boxTitle(t.location),
          Container(
            height: 180,
            decoration: BoxDecoration(color: AppColors.green50, borderRadius: BorderRadius.circular(AppRadius.medium)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.green700.withValues(alpha: 0.15),
                    border: Border.all(color: AppColors.green700, width: 1.5),
                  ),
                ),
                const SizedBox(height: 8),
                Text(t.approximateArea, style: AppText.label.copyWith(color: AppColors.green700)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            t.exactAddressLater,
            style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16),
          ),
          if (page.savedPlaces.isNotEmpty || page.amenities.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in page.savedPlaces) InfoChip(label: amenityText(t, Amenity(s.name, s.distanceM))),
                for (final a in page.amenities) InfoChip(label: amenityText(t, a)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// "Homes like this go quickly": saves the area so alerts arrive (screen 29).
class AlertBox extends ConsumerWidget {
  const AlertBox({super.key, required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    return PropertyBox(
      tint: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const AppIcon(AppIcons.bell, color: AppColors.green700),
              const SizedBox(width: 10),
              Expanded(
                child: Text(t.homesGoQuickly, style: AppText.subtitle.copyWith(height: 22 / 18)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            t.alertSimilarIn(page.card.area),
            style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16),
          ),
          const SizedBox(height: 12),
          AppButton(
            label: t.getAlertsFor(page.card.area),
            kind: AppButtonKind.outline,
            onPressed: () {
              final signedIn = ref.read(sessionProvider).value?.signedIn ?? false;
              if (!signedIn) {
                context.push('/sign-in');
                return;
              }
              final at = page.card.location;
              ref
                  .read(searchProvider.notifier)
                  .set(
                    SearchQuery(
                      place: at == null ? SearchPlace.area(page.card.area, city: page.card.city) : SearchPlace.landmark(page.card.area, at, radiusM: 1000),
                      filters: SearchFilters(minBedrooms: page.card.bedrooms == 0 ? null : page.card.bedrooms),
                    ),
                  );
              context.push('/search/save-area');
            },
          ),
        ],
      ),
    );
  }
}

/// A row of result cards that scrolls sideways, with its heading and a link under it.
class HomesRow extends StatelessWidget {
  const HomesRow({super.key, required this.title, this.subtitle, required this.homes, required this.linkLabel, required this.onLink, this.cardWidth = 260});
  final String title;
  final String? subtitle;
  final List<ListingCardData> homes;
  final String linkLabel;
  final VoidCallback onLink;
  final double cardWidth;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        header: true,
        child: Text(title, style: AppText.title.copyWith(height: 26 / 22)),
      ),
      if (subtitle != null)
        Text(
          subtitle!,
          style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16),
        ),
      const SizedBox(height: 12),
      SingleChildScrollView(
              // The cards scroll sideways; each is as tall as its words need.
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [for (final (i, h) in homes.indexed) ...[if (i > 0) const SizedBox(width: 16), ResultCard(h, width: cardWidth)]],
              ),
            ),
      const SizedBox(height: 12),
      AppLinkText(label: linkLabel, onTap: onLink),
    ],
  );
}

class AppLinkText extends StatelessWidget {
  const AppLinkText({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    link: true,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(label, style: AppText.label.copyWith(color: AppColors.green700)),
      ),
    ),
  );
}

/// "More from FindHouseQuick": four cards about the service, each with a link to the help pages.
class MoreFromCards extends ConsumerWidget {
  const MoreFromCards({super.key, this.columns = 1});
  final int columns;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final scouts = ref.watch(controlsProvider).value?.isOn('growth.scouts') ?? false;
    final cards = [
      (AppIcons.shieldCheck, t.moreChecked, t.moreCheckedText, t.moreCheckedLink, '/help#checks'),
      (AppIcons.home, t.moreFree, t.moreFreeText, t.moreFreeLink, '/help#inspections'),
      (AppIcons.money, t.moreList, t.moreListText, t.moreListLink, '/help#listing'),
      if (scouts) (AppIcons.people, t.moreScout, t.moreScoutText, t.moreScoutLink, '/help#scouts'),
    ];
    Widget card((AppIcons, String, String, String, String) c) => PropertyBox(
      padding: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.green50, borderRadius: BorderRadius.circular(12)),
            child: AppIcon(c.$1, size: 20, color: AppColors.green700),
          ),
          const SizedBox(height: 16),
          Text(c.$2, style: AppText.subtitle.copyWith(height: 22 / 18)),
          const SizedBox(height: 8),
          Text(
            c.$3,
            style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16),
          ),
          const SizedBox(height: 12),
          AppLinkText(label: c.$4, onTap: () => openWebsite(ref, c.$5)),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(t.moreFromUs, style: AppText.title.copyWith(height: 26 / 22)),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, box) {
            final w = (box.maxWidth - 16 * (columns - 1)) / columns;
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [for (final c in cards) SizedBox(width: w, child: card(c))],
            );
          },
        ),
      ],
    );
  }
}

class _PhoneLayout extends ConsumerWidget {
  const _PhoneLayout({required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final c = page.card;
    final photos = page.previews;
    final all = page.photos;
    final related = ref.watch(relatedHomesProvider(c.id)).value ?? const RelatedHomes();
    final alerts = ref.watch(controlsProvider).value?.isOn('search.saved_alerts') ?? false;
    final details = keyDetails(t, page);
    const gap = SizedBox(height: 16);
    // Under the large photo: the next two photos, then the third with "See all" over it when there are more.
    Widget thumb(int slot) {
      final i = slot + 1;
      if (i >= photos.length) return const Expanded(child: SizedBox.shrink());
      final last = slot == 2 && photos.length > 4;
      return Expanded(
        child: Padding(
          padding: EdgeInsets.only(left: slot == 0 ? 0 : 8),
          child: SizedBox(
            height: 72,
            child: Semantics(
              button: true,
              label: last ? t.seeAllPhotos(photos.length) : photos[i].partLabel,
              child: GestureDetector(
                onTap: () => last ? openGallery(context, c.id) : openPhoto(context, c.id, all.indexOf(photos[i])),
                child: ExcludeSemantics(
                  child: HomePhoto(url: photos[i].thumb, label: photos[i].partLabel, overlay: last ? t.seeAllPhotos(photos.length) : null),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: ColoredBox(
          color: AppColors.surface,
          child: SafeArea(
            bottom: false,
            child: SizedBox(
              height: 56,
              child: Row(
                children: [
                  const SizedBox(width: 4),
                  AppIconButton(icon: AppIcons.back, label: t.back, onPressed: () => context.canPop() ? context.pop() : context.go('/home')),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      c.title,
                      style: AppText.subtitle.copyWith(height: 22 / 18),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  SaveHeartPlain(listingId: c.id),
                  AppIconButton(icon: AppIcons.share, label: t.share, onPressed: () => context.push('/homes/${c.id}/share')),
                  const SizedBox(width: 4),
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: _ActionBar(page: page),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Semantics(
            header: true,
            child: Text(headline(page), style: AppText.display.copyWith(height: 34 / 28)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const AppIcon(AppIcons.location, color: AppColors.green700),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  t.approximatePlace(c.place),
                  style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16),
                ),
              ),
            ],
          ),
          gap,
          Wrap(
            spacing: 8,
            children: [
              if (ref.watch(controlsProvider).value?.isOn('search.compare') ?? false) InfoChip(label: t.compare, onTap: () => context.push('/homes/${c.id}/compare')),
              InfoChip(label: t.report, onTap: () => context.push('/homes/${c.id}/report')),
            ],
          ),
          gap,
          if (photos.isNotEmpty) ...[
            SizedBox(
              height: 220,
              child: Semantics(
                button: true,
                label: photos.first.partLabel,
                child: GestureDetector(
                  onTap: () => openPhoto(context, c.id, 0),
                  child: ExcludeSemantics(
                    child: HomePhoto(url: photos.first.best, label: photos.first.partLabel),
                  ),
                ),
              ),
            ),
            if (photos.length > 1) ...[
              const SizedBox(height: 8),
              Row(children: [for (var slot = 0; slot < 3; slot++) thumb(slot)]),
            ],
            gap,
          ],
          CostsBox(page: page),
          gap,
          FactsBox(facts: propertyFacts(context, page)),
          if (page.gallery.isNotEmpty) ...[gap, PhotosByRoomBox(page: page)],
          if (details.isNotEmpty) ...[gap, KeyDetailsBox(details: details)],
          if (page.description.isNotEmpty) ...[gap, AboutBox(text: page.description)],
          gap,
          LocationBox(page: page),
          if (alerts) ...[gap, AlertBox(page: page)],
          if (related.similar.isNotEmpty) ...[
            const SizedBox(height: 24),
            HomesRow(
              title: t.similarHomesNearby,
              subtitle: c.bedrooms != null && c.bedrooms! > 0 ? t.similarHomesText(c.bedrooms!) : null,
              homes: related.similar,
              linkLabel: t.seeAllSimilar,
              onLink: () => _searchFrom(context, ref, page, sameBedrooms: true),
            ),
          ],
          if (related.nearby.isNotEmpty) ...[
            const SizedBox(height: 24),
            HomesRow(title: t.moreHomesIn(c.area), homes: related.nearby, linkLabel: t.seeAllHomesIn(c.area), onLink: () => _searchFrom(context, ref, page, sameBedrooms: false)),
          ],
          const SizedBox(height: 24),
          const MoreFromCards(),
        ],
      ),
    );
  }
}

/// Opens the results for the home's area, with its bedrooms when looking for similar homes.
void _searchFrom(BuildContext context, WidgetRef ref, PropertyPage p, {required bool sameBedrooms}) {
  ref
      .read(searchProvider.notifier)
      .set(
        SearchQuery(
          place: SearchPlace.area(p.card.area, city: p.card.city),
          filters: SearchFilters(minBedrooms: sameBedrooms && (p.card.bedrooms ?? 0) > 0 ? p.card.bedrooms : null),
        ),
      );
  context.push('/search/results');
}

void searchFrom(BuildContext context, WidgetRef ref, PropertyPage p, {required bool sameBedrooms}) => _searchFrom(context, ref, p, sameBedrooms: sameBedrooms);

/// The bar fixed to the bottom: chat, and the main button to book.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final booking = ref.watch(controlsProvider).value?.isOn('contact.inspection_booking') ?? true;
    final chat = ref.watch(controlsProvider).value?.isOn('contact.chat') ?? false;
    if (!booking && !chat) return const SizedBox.shrink();
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              if (chat)
                Semantics(
                  button: true,
                  label: t.chatWithLister,
                  child: Material(
                    color: AppColors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.medium),
                      side: const BorderSide(color: AppColors.green700, width: 2),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppRadius.medium),
                      onTap: () => contactAction(context, ref, book: false),
                      child: const SizedBox(
                        width: 48,
                        height: 48,
                        child: Center(child: AppIcon(AppIcons.chat, color: AppColors.green700)),
                      ),
                    ),
                  ),
                ),
              if (chat && booking) const SizedBox(width: 8),
              Expanded(
                child: booking ? AppButton(label: t.bookFreeInspection, onPressed: () => contactAction(context, ref, book: true)) : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The heart in the app bar: the plain icon, without the white circle the cards use.
class SaveHeartPlain extends ConsumerWidget {
  const SaveHeartPlain({super.key, required this.listingId});
  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final signedIn = ref.watch(sessionProvider).value?.signedIn ?? false;
    final saved = ref.watch(savedListingsProvider).value?.contains(listingId) ?? false;
    return Semantics(
      toggled: saved,
      child: AppIconButton(
        icon: saved ? AppIcons.heartFilled : AppIcons.heart,
        label: !signedIn ? t.signInToSave : (saved ? t.unsaveHome : t.saveHome),
        onPressed: () => signedIn ? ref.read(savedListingsProvider.notifier).toggle(listingId) : context.push('/sign-in'),
      ),
    );
  }
}
