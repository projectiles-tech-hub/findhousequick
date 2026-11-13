import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/tokens.dart';
import '../design/website_frame.dart';
import '../l10n/languages.dart';
import '../search/listing_cards.dart';
import '../search/search_api.dart';
import '../search/search_state.dart';
import '../session/session.dart';
import 'property_api.dart';
import 'property_screen.dart';

/// Screen 30 on the website, as drawn at 1366 (two columns, the costs beside the details) and at 768 (one column).
class PropertyWideLayout extends ConsumerWidget {
  const PropertyWideLayout({super.key, required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final big = MediaQuery.sizeOf(context).width >= 1100;
    final c = page.card;
    final related = ref.watch(relatedHomesProvider(c.id)).value ?? const RelatedHomes();
    final alerts = ref.watch(controlsProvider).value?.isOn('search.saved_alerts') ?? false;
    final details = keyDetails(t, page);
    const gap = SizedBox(height: 24);
    final grey = AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16);

    final crumbs = Wrap(
      children: [
        for (final (i, (label, onTap)) in [
          (t.crumbHome, () => context.go('/home')),
          (c.city, () => searchFrom(context, ref, page, sameBedrooms: false)),
          (c.area, () => searchFrom(context, ref, page, sameBedrooms: false)),
          (c.title, null),
        ].indexed) ...[
          if (i > 0) Text('  /  ', style: AppText.bodySmall.copyWith(color: AppColors.ink600)),
          if (onTap == null)
            Text(label, style: AppText.bodySmall.copyWith(color: AppColors.ink600))
          else
            Semantics(
              link: true,
              child: InkWell(
                onTap: onTap,
                child: Text(label, style: AppText.bodySmall.copyWith(color: AppColors.ink600)),
              ),
            ),
        ],
      ],
    );

    final actions = Wrap(
      spacing: 12,
      runSpacing: 8,
      children: [
        _SaveChip(listingId: c.id),
        InfoChip(label: t.share, onTap: () => context.push('/homes/${c.id}/share')),
        if (ref.watch(controlsProvider).value?.isOn('search.compare') ?? false) InfoChip(label: t.compare, onTap: () => context.push('/homes/${c.id}/compare')),
        InfoChip(label: t.report, onTap: () => context.push('/homes/${c.id}/report')),
      ],
    );

    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(
            headline(page),
            style: AppText.display.copyWith(fontSize: 36, height: 43 / 36),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            const AppIcon(AppIcons.location, color: AppColors.green700),
            const SizedBox(width: 6),
            Flexible(child: Text(t.approximatePlace(c.place), style: grey)),
          ],
        ),
      ],
    );

    final facts = PropertyBox(
      padding: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (big) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (c.listerVerified) const VerifiedBadge(),
                const FreeBadge(),
              ],
            ),
            const SizedBox(height: 16),
          ],
          Wrap(
            spacing: big ? 32 : 24,
            runSpacing: 12,
            children: [
              for (final (k, v) in propertyFacts(context, page))
                SizedBox(
                  width: big ? null : 150,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        k,
                        style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14),
                      ),
                      const SizedBox(height: 2),
                      Text(v, style: AppText.subtitle.copyWith(height: 22 / 18)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );

    final keyBox = details.isEmpty ? null : KeyDetailsBox(details: details);

    final mainColumn = <Widget>[
      facts,
      if (page.gallery.isNotEmpty) ...[gap, PhotosByRoomBox(page: page)],
      if (keyBox != null) ...[gap, keyBox],
      if (page.description.isNotEmpty) ...[gap, AboutBox(text: page.description)],
      gap,
      LocationBox(page: page),
    ];

    Widget homesGrid(String title, String? subtitle, List<ListingCardData> homes, String linkLabel, VoidCallback onLink) {
      final shown = homes.take(4).toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(title, style: AppText.title.copyWith(fontSize: 24, height: 29 / 24)),
                    ),
                    if (subtitle != null) ...[const SizedBox(height: 4), Text(subtitle, style: grey)],
                  ],
                ),
              ),
              if (big) AppLinkText(label: linkLabel, onTap: onLink),
            ],
          ),
          SizedBox(height: big ? 16 : 12),
          if (big)
            LayoutBuilder(
              builder: (context, box) {
                final w = (box.maxWidth - 3 * 24) / 4;
                return Wrap(spacing: 24, runSpacing: 24, children: [for (final h in shown) ResultCard(h, width: w)]);
              },
            )
          else
            SingleChildScrollView(
              // The cards scroll sideways; each is as tall as its words need.
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [for (final (i, h) in homes.indexed) ...[if (i > 0) const SizedBox(width: 16), ResultCard(h, width: 300)]],
              ),
            ),
          if (!big) ...[const SizedBox(height: 12), AppLinkText(label: linkLabel, onTap: onLink)],
        ],
      );
    }

    final photos = page.photos;
    final children = <Widget>[
      crumbs,
      const SizedBox(height: 24),
      if (big)
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: titleBlock),
            actions,
          ],
        )
      else ...[
        titleBlock,
        gap,
        actions,
      ],
      gap,
      if (photos.isNotEmpty) ...[_Mosaic(page: page, big: big), gap],
      if (big)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: mainColumn),
            ),
            const SizedBox(width: 32),
            SizedBox(
              width: 400,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CostsBox(page: page, side: true),
                  const SizedBox(height: 16),
                  _ContactBox(page: page),
                  if (alerts) ...[const SizedBox(height: 16), AlertBox(page: page)],
                ],
              ),
            ),
          ],
        )
      else ...[
        CostsBox(page: page),
        gap,
        ...mainColumn,
        if (alerts) ...[gap, AlertBox(page: page)],
      ],
      if (related.similar.isNotEmpty) ...[
        gap,
        homesGrid(
          t.similarHomesNearby,
          (c.bedrooms ?? 0) > 0 ? t.similarHomesText(c.bedrooms!) : null,
          related.similar,
          t.seeAllSimilar,
          () => searchFrom(context, ref, page, sameBedrooms: true),
        ),
      ],
      if (related.nearby.isNotEmpty) ...[
        gap,
        homesGrid(t.moreHomesIn(c.area), null, related.nearby, t.seeAllHomesIn(c.area), () => searchFrom(context, ref, page, sameBedrooms: false)),
      ],
      gap,
      MoreFromCards(columns: big ? 4 : 2),
    ];
    return WebsiteFrame(children: children);
  }
}

/// The large photo with four smaller ones beside it (1366), or the large photo with three under it (768).
class _Mosaic extends StatelessWidget {
  const _Mosaic({required this.page, required this.big});
  final PropertyPage page;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final photos = page.previews;
    final all = page.photos;
    final id = page.card.id;
    final smallCount = big ? 4 : 3;
    Widget tile(int i, {bool large = false}) {
      if (i >= photos.length) return const SizedBox.shrink();
      final last = i == smallCount && photos.length > smallCount + 1;
      return Semantics(
        button: true,
        label: last ? t.seeAllPhotos(photos.length) : photos[i].partLabel,
        child: GestureDetector(
          onTap: () => last ? openGallery(context, id) : openPhoto(context, id, all.indexOf(photos[i])),
          child: ExcludeSemantics(
            child: HomePhoto(url: large ? photos[i].best : photos[i].medium ?? photos[i].best, label: photos[i].partLabel, overlay: last ? t.seeAllPhotos(photos.length) : null),
          ),
        ),
      );
    }

    if (big) {
      return SizedBox(
        height: 452,
        child: Row(
          children: [
            Expanded(flex: 760, child: tile(0, large: true)),
            if (photos.length > 1) ...[
              const SizedBox(width: 12),
              Expanded(
                flex: 466,
                child: Column(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Expanded(child: tile(1)),
                          const SizedBox(width: 12),
                          Expanded(child: tile(2)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: Row(
                        children: [
                          Expanded(child: tile(3)),
                          const SizedBox(width: 12),
                          Expanded(child: tile(4)),
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
    return Column(
      children: [
        SizedBox(height: 400, child: tile(0, large: true)),
        if (photos.length > 1) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 140,
            child: Row(
              children: [
                for (var i = 1; i <= 3; i++) ...[if (i > 1) const SizedBox(width: 8), Expanded(child: tile(i))],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// At 1366, the contact buttons and the lister stand in their own box under the costs.
class _ContactBox extends ConsumerWidget {
  const _ContactBox({required this.page});
  final PropertyPage page;

  @override
  Widget build(BuildContext context, WidgetRef ref) => PropertyBox(
        padding: 24,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ContactButtons(),
            if (page.lister != null) ...[const SizedBox(height: 16), ListerTile(lister: page.lister!)],
          ],
        ),
      );
}

class _SaveChip extends ConsumerWidget {
  const _SaveChip({required this.listingId});
  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final signedIn = ref.watch(sessionProvider).value?.signedIn ?? false;
    final saved = ref.watch(savedListingsProvider).value?.contains(listingId) ?? false;
    return Semantics(
      toggled: saved,
      child: InfoChip(label: saved ? t.savedLabel : t.saveLabel, onTap: () => signedIn ? ref.read(savedListingsProvider.notifier).toggle(listingId) : context.push('/sign-in')),
    );
  }
}
