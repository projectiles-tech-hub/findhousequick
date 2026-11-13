import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../controls/controls.dart';
import '../l10n/languages.dart';
import '../providers.dart';
import '../session/session.dart';
import 'app_icon.dart';
import 'tokens.dart';

/// The page edge of the website layouts: 64 at 1366 (content 1238 wide), 32 at 768.
double websiteEdge(double width) => width >= 1100 ? ((width - 1238) / 2).clamp(64, double.infinity) : 32;

void _openSite(WidgetRef ref, String path) => launchUrl(Uri.parse('${ref.read(appConfigProvider).webUrl}$path'), webOnlyWindowName: '_blank');

/// The frame of a full website page, as drawn for the signed-in pages (screen 30 and the search pages): the green strip,
/// the bar with the logo, the search box and the main links, the page itself, and the dark footer.
class WebsiteFrame extends ConsumerWidget {
  const WebsiteFrame({super.key, required this.children, this.searchText});

  final List<Widget> children;

  /// What the search box shows; its hint when empty.
  final String? searchText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    final edge = websiteEdge(width);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Header(edge: edge, searchText: searchText),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(edge, 24, edge, 48),
              sliver: SliverList.list(children: children),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: _Footer(edge: edge),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.edge, this.searchText});
  final double edge;
  final String? searchText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final big = MediaQuery.sizeOf(context).width >= 1100;
    final scouts = ref.watch(controlsProvider).value?.isOn('growth.scouts') ?? false;
    final me = ref.watch(sessionProvider).value?.me;
    final initials = me == null ? '' : [me.firstName, me.lastName].where((s) => s.isNotEmpty).map((s) => s[0].toUpperCase()).join();
    final stripLink = AppText.bodySmall.copyWith(color: AppColors.green800, height: 17 / 14);
    Widget link(String label, VoidCallback onTap, TextStyle style) => Semantics(
      link: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(label, style: style),
        ),
      ),
    );
    final navStyle = AppText.bodySmall.copyWith(color: AppColors.ink900, fontWeight: FontWeight.w500, fontVariations: const [FontVariation('wght', 500)], height: 17 / 14);
    final search = _SearchField(text: searchText);
    final searchButton = Material(
      color: AppColors.green700,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => context.push('/search/place'),
        child: SizedBox(
          height: 48,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Center(
              child: Text(t.searchButton, style: AppText.button.copyWith(color: AppColors.surface)),
            ),
          ),
        ),
      ),
    );
    final avatar = Semantics(
      button: true,
      label: t.tabMe,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => context.go(me == null ? '/sign-in' : '/me'),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
          child: initials.isEmpty ? const AppIcon(AppIcons.person, size: 20, color: AppColors.green700) : Text(initials, style: AppText.label.copyWith(color: AppColors.green800)),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: AppColors.green50,
          height: 33,
          padding: EdgeInsets.symmetric(horizontal: edge),
          child: Row(
            children: [
              Expanded(
                child: Text(t.everyListerProves, style: stripLink, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              link(t.listYourProperty, () => _openSite(ref, '/help#listing'), stripLink),
              if (big && scouts) ...[const SizedBox(width: 24), link(t.becomeScout, () => _openSite(ref, '/help#scouts'), stripLink)],
              const SizedBox(width: 24),
              link(t.help, () => _openSite(ref, '/help'), stripLink),
            ],
          ),
        ),
        Container(
          color: AppColors.surface,
          padding: EdgeInsets.fromLTRB(edge, big ? 16 : 14, edge, big ? 17 : 14),
          child: Column(
            children: [
              Row(
                children: [
                  _Logo(onTap: () => context.go('/home')),
                  if (big) ...[
                    const SizedBox(width: 24),
                    // 380 wide as drawn, narrower when the links need the room.
                    Flexible(
                      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 380), child: search),
                    ),
                    const SizedBox(width: 24),
                    searchButton,
                  ],
                  const Spacer(),
                  if (big) ...[link(t.homesToRent, () => context.go('/home'), navStyle), const SizedBox(width: 24)],
                  link(t.tabSaved, () => context.go('/saved'), navStyle),
                  const SizedBox(width: 24),
                  link(t.tabMessages, () => context.go('/messages'), navStyle),
                  if (big) ...[const SizedBox(width: 24), link(t.tabInspections, () => context.go('/inspections'), navStyle)],
                  const SizedBox(width: 24),
                  avatar,
                ],
              ),
              if (!big) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: search),
                    const SizedBox(width: 12),
                    searchButton,
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    link: true,
    label: context.texts.appName,
    child: InkWell(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 32,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.green700, borderRadius: BorderRadius.circular(6)),
            child: Text('F', style: AppText.label.copyWith(color: AppColors.surface, height: 1)),
          ),
          const SizedBox(width: 8),
          ExcludeSemantics(
            child: Text(
              context.texts.appName,
              style: AppText.title.copyWith(color: AppColors.green700, fontSize: 21, height: 26 / 21),
            ),
          ),
        ],
      ),
    ),
  );
}

class _SearchField extends StatelessWidget {
  const _SearchField({this.text});
  final String? text;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final empty = text == null || text!.isEmpty;
    return Semantics(
      button: true,
      label: t.searchHint,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => context.push('/search/place'),
          child: SizedBox(
            height: 50,
            child: LayoutBuilder(
              // The icon gives way first if the box is ever squeezed very narrow.
              builder: (context, box) => Row(
                children: [
                  const SizedBox(width: 16),
                  if (box.maxWidth >= 120) ...[const AppIcon(AppIcons.search, color: AppColors.green700), const SizedBox(width: 10)],
                  Expanded(
                    child: ExcludeSemantics(
                      child: Text(
                        empty ? t.searchHint : text!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body.copyWith(color: empty ? AppColors.ink600 : AppColors.ink900, height: 20 / 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.edge});
  final double edge;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final big = MediaQuery.sizeOf(context).width >= 1100;
    final controls = ref.watch(controlsProvider).value;
    bool on(String k) => controls?.isOn(k) ?? false;
    const grey = Color(0xFFB8BEC7);
    final linkStyle = AppText.bodySmall.copyWith(color: grey, height: 17 / 14);
    final heading = AppText.bodySmall.copyWith(color: AppColors.surface, fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 17 / 14);
    Widget col(String title, List<(String, VoidCallback)> items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: heading)),
        for (final (label, onTap) in items) ...[
          const SizedBox(height: 10),
          Semantics(
            link: true,
            child: InkWell(
              onTap: onTap,
              child: Text(label, style: linkStyle),
            ),
          ),
        ],
      ],
    );
    final columns = [
      col(t.footerFind, [
        (t.homesToRent, () => context.go('/home')),
        if (on('listings.commercial')) (t.catShops, () => context.go('/home')),
        if (on('listings.short_lets')) (t.catShortLets, () => context.go('/home')),
      ]),
      col(t.footerList, [
        (t.listAProperty, () => _openSite(ref, '/help#listing')),
        (t.forAgents, () => _openSite(ref, '/help#agents')),
        if (on('growth.scouts')) (t.becomeScout, () => _openSite(ref, '/help#scouts')),
      ]),
      col(t.help, [
        (t.helpCentre, () => _openSite(ref, '/help')),
        (t.reportAListing, () => _openSite(ref, '/help#report')),
        (t.termsOfUse, () => _openSite(ref, '/terms')),
        (t.privacyPolicy, () => _openSite(ref, '/privacy')),
      ]),
    ];
    final about = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          t.appName,
          style: AppText.title.copyWith(color: AppColors.surface, fontSize: 21, height: 26 / 21),
        ),
        const SizedBox(height: 16),
        Text(t.footerAbout, style: linkStyle),
      ],
    );
    return Container(
      width: double.infinity,
      color: AppColors.ink900,
      padding: EdgeInsets.fromLTRB(edge, 48, edge, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (big)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: Padding(padding: const EdgeInsets.only(right: 48), child: about),
                ),
                for (final c in columns) Expanded(flex: 2, child: c),
              ],
            )
          else ...[
            about,
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [for (final c in columns) Expanded(child: c)],
            ),
          ],
          const SizedBox(height: 32),
          const Divider(height: 1, color: Color(0xFF374151)),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: Text(t.copyright('${DateTime.now().year}'), style: linkStyle)),
              Text(t.languageEn, style: linkStyle),
            ],
          ),
        ],
      ),
    );
  }
}
