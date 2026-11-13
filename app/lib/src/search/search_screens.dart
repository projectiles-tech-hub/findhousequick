import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/chips.dart';
import '../design/fields.dart';
import '../design/notice.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../l10n/languages.dart';
import '../listings/listing_collage.dart' show formatMoney;
import '../session/session.dart';
import 'listing_cards.dart';
import 'location.dart';
import 'search_api.dart';
import 'search_state.dart';

final locationReaderProvider = Provider<LocationReader>((ref) => const LocationReader());

String _categoryLabel(AppTexts t, String c) => switch (c) { 'COMMERCIAL' => t.catShops, 'SHORT_LET' => t.catShortLets, _ => t.catHomes };

String _placeLabel(AppTexts t, SearchPlace p) {
  if (p.aroundMe) return t.aroundYou;
  if (p.landmark) return t.nearPlace(p.label!);
  return p.label ?? '';
}

/// The text in the search box for a search: the place, and how far from it for a landmark.
String searchBoxText(AppTexts t, SearchPlace p) {
  if (p.aroundMe) return t.homesAroundMe;
  if (p.landmark) return t.placeWithin(p.label!, radiusText(t, p.radiusM));
  return p.label ?? '';
}

/// The digits of the country's currency, so amounts typed in naira become kobo.
int _currencyDigits(String currency) => NumberFormat.simpleCurrency(name: currency, locale: 'en').decimalDigits ?? 2;

BigInt _toMinor(String typed, String currency) {
  final whole = BigInt.parse(typed.replaceAll(RegExp(r'[^0-9]'), ''));
  return whole * BigInt.from(10).pow(_currencyDigits(currency));
}

String _shortMoney(BigInt minor, String currency, String locale) => formatMoney(minor, currency, locale);

/// Starts "around me": explains first the very first time (screen 10), then asks the phone.
Future<void> startAroundMe(BuildContext context, WidgetRef ref) async {
  final reader = ref.read(locationReaderProvider);
  if (!await reader.explained()) {
    if (context.mounted) unawaited(context.push('/search/location'));
    return;
  }
  if (!context.mounted) return;
  await _findAndSearch(context, ref);
}

Future<void> _findAndSearch(BuildContext context, WidgetRef ref) async {
  final t = context.texts;
  final (outcome, where) = await ref.read(locationReaderProvider).read();
  if (!context.mounted) return;
  if (outcome == LocationOutcome.found) {
    final filters = ref.read(searchProvider)?.filters ?? const SearchFilters();
    ref.read(searchProvider.notifier).set(SearchQuery(place: SearchPlace.aroundMe(where!), filters: filters));
    unawaited(context.push('/search/results'));
    return;
  }
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(outcome == LocationOutcome.unavailable ? t.locationUnavailable : t.locationDenied),
    action: outcome == LocationOutcome.deniedForever ? SnackBarAction(label: t.openSettings, onPressed: () => ref.read(locationReaderProvider).openSettings()) : null,
  ));
}

/// The rounded search bar that opens the search by area or landmark (screen 27).
class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.text, this.placeholder = true});
  final String text;
  final bool placeholder;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: context.texts.searchHint,
      child: Material(
        color: AppColors.surface,
        shape: const StadiumBorder(side: BorderSide(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/search/place'),
          child: SizedBox(
            height: 48,
            child: Row(
              children: [
                const SizedBox(width: 16),
                const AppIcon(AppIcons.search, color: AppColors.ink600),
                const SizedBox(width: 8),
                Expanded(
                  child: ExcludeSemantics(
                    child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body.copyWith(color: placeholder ? AppColors.ink600 : AppColors.ink900, height: 20 / 16)),
                  ),
                ),
                const SizedBox(width: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Widget _sectionLabel(String text, {Widget? trailing}) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [Expanded(child: Text(text, style: AppText.label.copyWith(height: 17 / 14))), ?trailing]),
    );

/// Screen 22, Home, for a signed-in user; screen 11, Not signed in, for someone looking around first.
class SearchHomeScreen extends ConsumerWidget {
  const SearchHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider).value?.signedIn ?? false;
    return signedIn ? const _SignedInHome() : const _SignedOutHome();
  }
}

final _newestProvider = FutureProvider.autoDispose<({String? area, List<ListingCardData> items})>((ref) async {
  final city = await ref.watch(defaultCityProvider.future);
  final api = ref.watch(searchApiProvider);
  final areas = await api.popularAreas(city: city?.name, limit: 1);
  final area = areas.isEmpty ? null : areas.first;
  final place = area != null ? SearchPlace.area(area.area, city: area.city) : (city != null ? SearchPlace.city(city.name) : null);
  if (place == null) return (area: null, items: const <ListingCardData>[]);
  final page = await api.search(SearchQuery(place: place, sort: 'NEWEST'));
  return (area: area?.area, items: page.items.take(3).toList());
});

final _savedPlacesProvider = FutureProvider.autoDispose<List<SavedPlace>>((ref) => ref.watch(searchApiProvider).savedPlaces());

class _SignedInHome extends ConsumerWidget {
  const _SignedInHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final me = ref.watch(sessionProvider).value?.me;
    final controls = ref.watch(controlsProvider).value;
    final city = ref.watch(defaultCityProvider).value;
    final newest = ref.watch(_newestProvider).value;
    final places = ref.watch(_savedPlacesProvider).value ?? const <SavedPlace>[];
    final aroundMe = controls?.isOn('search.around_me') ?? false;
    final landmark = controls?.isOn('search.landmark') ?? false;
    final hour = DateTime.now().hour;
    final name = me?.firstName ?? '';
    final greeting = hour < 12 ? t.goodMorning(name) : (hour < 17 ? t.goodAfternoon(name) : t.goodEvening(name));
    void searchIn(SearchPlace place, {String? category}) {
      ref.read(searchProvider.notifier).set(SearchQuery(place: place, filters: SearchFilters(category: category)));
      context.push('/search/results');
    }

    final cats = enabledCategories(controls);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(greeting, style: AppText.subtitle.copyWith(height: 22 / 18))),
                      if (city != null) Text(city.name, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _SearchBox(text: t.searchHint),
            if (aroundMe) ...[
              const SizedBox(height: 16),
              Semantics(
                button: true,
                child: Material(
                  color: AppColors.green700,
                  borderRadius: BorderRadius.circular(AppRadius.medium),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => startAroundMe(context, ref),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: AppColors.surface.withValues(alpha: 0.18), shape: BoxShape.circle),
                            child: const AppIcon(AppIcons.locationFilled, color: AppColors.surface, cut: AppColors.green700),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(t.homesAroundMe, style: AppText.button.copyWith(color: AppColors.surface)),
                                const SizedBox(height: 2),
                                Text(t.homesAroundMeText, style: AppText.bodySmall.copyWith(color: const Color(0xFFD7EBDF), height: 17 / 14)),
                              ],
                            ),
                          ),
                          const AppIcon(AppIcons.forward, color: AppColors.surface),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
            if (places.isNotEmpty && landmark) ...[
              const SizedBox(height: 16),
              _sectionLabel(t.nearYourPlaces),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final p in places)
                    AppFilterChip(label: p.label, selected: false, onChanged: (_) => searchIn(SearchPlace.landmark(p.label, p.location, radiusM: 3000))),
                ],
              ),
            ],
            if (cats.isNotEmpty && city != null) ...[
              const SizedBox(height: 16),
              _sectionLabel(t.whatLookingFor),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < cats.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(child: _TypeTile(category: cats[i], onTap: () => searchIn(SearchPlace.city(city.name), category: cats[i]))),
                  ],
                ],
              ),
            ],
            if (newest != null && newest.items.isNotEmpty) ...[
              const SizedBox(height: 16),
              _sectionLabel(
                newest.area == null ? t.newlyListedIn(city?.name ?? '') : t.newIn(newest.area!),
                trailing: InkWell(
                  onTap: () => searchIn(newest.area != null ? SearchPlace.area(newest.area!, city: city?.name) : SearchPlace.city(city!.name)),
                  child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(t.seeAll, style: AppText.label.copyWith(color: AppColors.green700))),
                ),
              ),
              for (final l in newest.items) Padding(padding: const EdgeInsets.only(bottom: 12), child: CompactCard(l, badge: t.verified)),
            ],
          ],
        ),
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({required this.category, required this.onTap});
  final String category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = switch (category) { 'COMMERCIAL' => AppIcons.map, 'SHORT_LET' => AppIcons.bed, _ => AppIcons.home };
    return Semantics(
      button: true,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium), side: const BorderSide(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 14, 8, 14),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
                  child: AppIcon(icon, color: AppColors.green700, cut: AppColors.green50),
                ),
                const SizedBox(height: 8),
                Text(_categoryLabel(context.texts, category), textAlign: TextAlign.center, style: AppText.label.copyWith(height: 17 / 14)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final _signedOutProvider = FutureProvider.autoDispose<({String place, SearchPage page})?>((ref) async {
  final city = await ref.watch(defaultCityProvider.future);
  if (city == null) return null;
  final page = await ref.watch(searchApiProvider).search(SearchQuery(place: SearchPlace.city(city.name)));
  return (place: city.name, page: page);
});

class _SignedOutHome extends ConsumerWidget {
  const _SignedOutHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final data = ref.watch(_signedOutProvider);
    final result = data.value;
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.green700, borderRadius: BorderRadius.circular(7)),
                    child: const AppIcon(AppIcons.homeFilled, size: 18, color: AppColors.surface, cut: AppColors.surface),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(t.appName, style: AppText.subtitle.copyWith(height: 22 / 18))),
                  TextButton(
                    onPressed: () => context.push('/sign-in'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.green700, minimumSize: const Size(48, 48), textStyle: AppText.label),
                    child: Text(t.signIn),
                  ),
                ],
              ),
            ),
            Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: _SearchBox(text: result?.place ?? t.searchHint, placeholder: result == null)),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                children: [
                  if (data.hasError) AppNotice(kind: AppNoticeKind.error, title: t.searchFailed),
                  if (result != null) ...[
                    Text(t.homesIn(result.page.total, result.place), style: AppText.label.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    const SizedBox(height: 12),
                    for (final l in result.page.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: CompactCard(
                          l,
                          // A self-contained room has no separate bedroom: it shows as one room, as on the results list.
                          subtitle: [if (l.bedrooms != null) l.bedrooms == 0 ? t.rooms(1) : t.bedroomsCount(l.bedrooms!), if (l.bathrooms != null) t.toiletsCount(l.bathrooms!)].join(' · '),
                          badge: t.ownerVerified,
                        ),
                      ),
                    if (result.page.items.isEmpty) Text(t.noHomesYet, style: AppText.body.copyWith(color: AppColors.ink600)),
                  ],
                ],
              ),
            ),
            Container(
              width: double.infinity,
              color: AppColors.green50,
              padding: const EdgeInsets.all(16),
              child: SafeArea(
                top: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(t.seeEveryPhotoTitle, style: AppText.subtitle.copyWith(height: 22 / 18)),
                    const SizedBox(height: 8),
                    Text(t.seeEveryPhotoText, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    const SizedBox(height: 12),
                    AppButton(label: t.createFreeAccount, onPressed: () => context.push('/sign-up')),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Screen 25, List of results, with screen 28, No results, in place of the list when nothing matches.
class ResultsScreen extends ConsumerStatefulWidget {
  const ResultsScreen({super.key});

  @override
  ConsumerState<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends ConsumerState<ResultsScreen> {
  SearchQuery? _shown;
  final List<ListingCardData> _items = [];
  int _total = 0;
  String? _cursor;
  bool _loading = false;
  bool _failed = false;
  List<_Suggestion> _suggestions = const [];

  Future<void> _load(SearchQuery query, {bool more = false}) async {
    setState(() {
      _loading = true;
      _failed = false;
      if (!more) {
        _shown = query;
        _items.clear();
        _cursor = null;
        _suggestions = const [];
      }
    });
    try {
      final page = await ref.read(searchApiProvider).search(query, cursor: more ? _cursor : null);
      if (!mounted || _shown != query) return;
      setState(() {
        _items.addAll(page.items);
        _total = page.total;
        _cursor = page.nextCursor;
      });
      if (!more && page.total == 0) unawaited(_suggest(query));
    } catch (_) {
      if (mounted && _shown == query) setState(() => _failed = true);
    } finally {
      if (mounted && _shown == query) setState(() => _loading = false);
    }
  }

  /// For "No results": a wider search, or the same search without one filter, each with how many it finds.
  Future<void> _suggest(SearchQuery query) async {
    final t = context.texts;
    final api = ref.read(searchApiProvider);
    final f = query.filters;
    final candidates = <(String, SearchQuery)>[
      if (query.place.centre != null && query.place.radiusM < 3000)
        (t.searchUpTo(radiusText(t, 3000), 0), query.copyWith(place: query.place.withRadius(3000))),
      if (f.minBedrooms != null) (t.bedroomsPlus(f.minBedrooms!), query.copyWith(filters: f.copyWith(minBedrooms: () => null))),
      if (f.maxRent != null) (t.anyPrice, query.copyWith(filters: f.copyWith(maxRent: () => null, minRent: () => null))),
      if (f.propertyType != null) (t.propertyType, query.copyWith(filters: f.copyWith(propertyType: () => null))),
      if (f.furnished != null) (t.furnishing, query.copyWith(filters: f.copyWith(furnished: () => null))),
    ];
    final found = <_Suggestion>[];
    for (final (label, q) in candidates) {
      try {
        final n = await api.count(q);
        if (n > 0) found.add(_Suggestion(label, q, n, wider: q.place.radiusM != query.place.radiusM));
      } catch (_) {}
      if (found.length == 2) break;
    }
    if (mounted && _shown == query) setState(() => _suggestions = found);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final query = ref.watch(searchProvider);
    if (query == null) {
      // Opened directly (a reload on the web): start from the home screen.
      WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/home'));
      return const SizedBox.shrink();
    }
    if (query != _shown && !_loading) WidgetsBinding.instance.addPostFrameCallback((_) => _load(query));
    final controls = ref.watch(controlsProvider).value;
    final canSave = query.place.centre != null && (controls?.isOn('search.saved_alerts') ?? false) && (ref.watch(sessionProvider).value?.signedIn ?? false);
    final place = _placeLabel(t, query.place);
    final f = query.filters;
    final title = switch (f.category) {
      'LONG_TERM_RESIDENTIAL' => t.resultsTitleHomes(place),
      'COMMERCIAL' => t.resultsTitleShops(place),
      'SHORT_LET' => t.resultsTitleShortLets(place),
      _ => t.resultsTitleAll(place),
    };
    final sortName = switch (query.sort ?? (query.place.centre != null ? 'DISTANCE' : 'NEWEST')) {
      'DISTANCE' => t.sortNearest,
      'PRICE_ASC' => t.sortCheapest,
      'PRICE_DESC' => t.sortDearest,
      _ => t.sortNewest,
    };
    final empty = !_loading && !_failed && _items.isEmpty && _shown == query;
    final children = <Widget>[];
    if (empty) {
      children.addAll(_noResults(t, query));
    } else {
      children.addAll([
        Semantics(header: true, child: Text(title, style: AppText.display.copyWith(height: 34 / 28))),
        const SizedBox(height: 8),
        if (_shown == query && !_loading || _items.isNotEmpty) Text(t.resultsSubtitle(_total), style: AppText.body.copyWith(color: AppColors.ink600, height: 19.5 / 16)),
        const SizedBox(height: 20),
        Align(alignment: Alignment.centerLeft, child: _SortChip(label: t.sortLabel(sortName), query: query)),
        const SizedBox(height: 12),
        _QuickFilters(query: query),
        const SizedBox(height: 20),
        if (_failed) ...[AppNotice(kind: AppNoticeKind.error, title: t.searchFailed), const SizedBox(height: 12), AppButton(label: t.tryAgain, kind: AppButtonKind.outline, onPressed: () => _load(query))],
        for (var i = 0; i < _items.length; i++) ...[
          ResultCard(_items[i]),
          const SizedBox(height: 16),
          if (i == 1 && canSave) ...[_AlertsCard(place: place), const SizedBox(height: 16)],
        ],
        if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.green700))),
        if (_items.isNotEmpty && !_loading) ...[
          Center(child: Text(t.showingOf(_items.length, _total), style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14))),
          if (_cursor != null) ...[const SizedBox(height: 12), AppButton(label: t.showMoreHomes, kind: AppButtonKind.outline, onPressed: () => _load(query, more: true))],
          const SizedBox(height: 20),
          _WhyRent(),
        ],
      ]);
    }
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 12, 16, 12),
                  child: Row(
                    children: [
                      AppIconButton(icon: AppIcons.back, label: t.back, onPressed: () => context.canPop() ? context.pop() : context.go('/home')),
                      const SizedBox(width: 4),
                      Expanded(child: _SearchBox(text: searchBoxText(t, query.place), placeholder: false)),
                      const SizedBox(width: 8),
                      _FiltersButton(active: !f.isEmpty),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: children),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _noResults(AppTexts t, SearchQuery query) {
    final place = query.place;
    final text = place.centre != null
        ? t.noResultsTextNear(radiusText(t, place.radiusM), place.aroundMe ? t.aroundYou : place.label!)
        : t.noResultsTextArea(place.label ?? '');
    final controls = ref.read(controlsProvider).value;
    final canAlert = place.centre != null && (controls?.isOn('search.saved_alerts') ?? false) && (ref.read(sessionProvider).value?.signedIn ?? false);
    return [
      const SizedBox(height: 24),
      Align(
        alignment: Alignment.centerLeft,
        child: Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle),
          child: const AppIcon(AppIcons.search, color: AppColors.ink600),
        ),
      ),
      const SizedBox(height: 16),
      AppHeading(t.noResultsTitle, intro: text),
      const SizedBox(height: 16),
      for (final s in _suggestions) ...[
        AppButton(
          label: s.wider ? t.searchUpTo(radiusText(t, s.query.place.radiusM), s.count) : t.removeFilter(s.label, s.count),
          kind: AppButtonKind.outline,
          onPressed: () => ref.read(searchProvider.notifier).set(s.query),
        ),
        const SizedBox(height: 8),
      ],
      if (canAlert) ...[const SizedBox(height: 16), AppButton(label: t.alertMeWhenListed, onPressed: () => context.push('/search/save-area'))],
    ];
  }
}

class _Suggestion {
  const _Suggestion(this.label, this.query, this.count, {this.wider = false});
  final String label;
  final SearchQuery query;
  final int count;
  final bool wider;
}

class _FiltersButton extends StatelessWidget {
  const _FiltersButton({required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return Semantics(
      button: true,
      label: t.filters,
      child: Material(
        color: active ? AppColors.green50 : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: active ? AppColors.green700 : AppColors.border, width: active ? 2 : 1)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/search/filters'),
          child: SizedBox(width: 48, height: 48, child: Center(child: AppIcon(AppIcons.filter, color: active ? AppColors.green700 : AppColors.ink900))),
        ),
      ),
    );
  }
}

class _SortChip extends ConsumerWidget {
  const _SortChip({required this.label, required this.query});
  final String label;
  final SearchQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final options = [
      if (query.place.centre != null) ('DISTANCE', t.sortNearest),
      ('NEWEST', t.sortNewest),
      ('PRICE_ASC', t.sortCheapest),
      ('PRICE_DESC', t.sortDearest),
    ];
    return AppFilterChip(
      label: label,
      selected: false,
      onChanged: (_) => showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large))),
        builder: (sheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (code, name) in options)
                  AppButton(
                    label: name,
                    kind: AppButtonKind.text,
                    onPressed: () {
                      ref.read(searchProvider.notifier).setSort(code);
                      Navigator.of(sheet).pop();
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The row of chips under the title; each opens the filters screen, and a category chip also switches category.
class _QuickFilters extends ConsumerWidget {
  const _QuickFilters({required this.query});
  final SearchQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final f = query.filters;
    final cats = enabledCategories(ref.watch(controlsProvider).value);
    final currency = ref.watch(controlsProvider).value?.country?.currency ?? 'NGN';
    final locale = Localizations.localeOf(context).languageCode;
    void openFilters() => context.push('/search/filters');
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final c in cats) ...[
            AppFilterChip(
              label: c == 'LONG_TERM_RESIDENTIAL' ? t.catHomesShort : _categoryLabel(t, c),
              selected: f.category == c,
              onChanged: (on) => ref.read(searchProvider.notifier).setFilters(f.copyWith(category: () => on ? c : null, propertyType: () => null)),
            ),
            const SizedBox(width: 8),
          ],
          AppFilterChip(label: f.maxRent == null ? t.anyPrice : t.upToRent(_shortMoney(f.maxRent!, currency, locale)), selected: f.maxRent != null || f.minRent != null, onChanged: (_) => openFilters()),
          const SizedBox(width: 8),
          AppFilterChip(label: f.minBedrooms == null ? t.bedroomsFilter : t.bedroomsPlus(f.minBedrooms!), selected: f.minBedrooms != null, onChanged: (_) => openFilters()),
          const SizedBox(width: 8),
          AppFilterChip(label: f.furnished == null ? t.furnishedFilter : _furnishing(t, f.furnished!), selected: f.furnished != null, onChanged: (_) => openFilters()),
          const SizedBox(width: 8),
          AppFilterChip(label: t.moreFilters, selected: f.propertyType != null || f.verifiedOnly, onChanged: (_) => openFilters()),
        ],
      ),
    );
  }
}

String _furnishing(AppTexts t, String code) => switch (code) {
      'UNFURNISHED' => t.furnUNFURNISHED,
      'SEMI_FURNISHED' => t.furnSEMI_FURNISHED,
      'FURNISHED' => t.furnFURNISHED,
      _ => code,
    };

class _AlertsCard extends StatelessWidget {
  const _AlertsCard({required this.place});
  final String place;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppRadius.medium), border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [const AppIcon(AppIcons.bell), const SizedBox(width: 10), Expanded(child: Text(t.getAlertsTitle, style: AppText.subtitle.copyWith(height: 22 / 18)))]),
          const SizedBox(height: 10),
          Text(t.getAlertsText(place), style: AppText.body.copyWith(color: AppColors.ink600, height: 19 / 16)),
          const SizedBox(height: 12),
          AppButton(label: t.saveThisSearch, onPressed: () => context.push('/search/save-area')),
        ],
      ),
    );
  }
}

class _WhyRent extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    Widget row(AppIcons icon, String text) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [AppIcon(icon, color: AppColors.green700), const SizedBox(width: 10), Expanded(child: Text(text, style: AppText.body.copyWith(height: 19 / 16)))]),
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppRadius.medium), border: Border.all(color: AppColors.divider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.whyRentTitle, style: AppText.subtitle.copyWith(height: 22 / 18)),
          row(AppIcons.shieldCheck, t.whyRent1),
          row(AppIcons.home, t.whyRent2),
          row(AppIcons.money, t.whyRent3),
          row(AppIcons.image, t.whyRent4),
        ],
      ),
    );
  }
}

/// Screen 26, Filters.
class FiltersScreen extends ConsumerStatefulWidget {
  const FiltersScreen({super.key});

  @override
  ConsumerState<FiltersScreen> createState() => _FiltersScreenState();
}

final _propertyTypesProvider = FutureProvider<List<PropertyTypeOption>>((ref) async {
  final country = (await ref.watch(controlsProvider.future)).country;
  if (country == null) return const [];
  return ref.watch(searchApiProvider).propertyTypes(country.code);
});

class _FiltersScreenState extends ConsumerState<FiltersScreen> {
  late SearchFilters _f = ref.read(searchProvider)?.filters ?? const SearchFilters();
  late final _min = TextEditingController(text: _f.minRent == null ? '' : _major(_f.minRent!));
  late final _max = TextEditingController(text: _f.maxRent == null ? '' : _major(_f.maxRent!));
  int? _count;
  Timer? _debounce;
  String? _rentError;

  String _currency() => ref.read(controlsProvider).value?.country?.currency ?? 'NGN';
  String _major(BigInt minor) => NumberFormat.decimalPattern('en').format((minor ~/ BigInt.from(10).pow(_currencyDigits(_currency()))).toInt());

  @override
  void initState() {
    super.initState();
    Future.microtask(_recount);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  void _change(SearchFilters f) {
    setState(() => _f = f);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _recount);
  }

  void _rentChanged() {
    final cur = _currency();
    final min = _min.text.trim().isEmpty ? null : _toMinor(_min.text, cur);
    final max = _max.text.trim().isEmpty ? null : _toMinor(_max.text, cur);
    setState(() => _rentError = min != null && max != null && min > max ? context.texts.errorRentRange : null);
    _change(_f.copyWith(minRent: () => min, maxRent: () => max));
  }

  Future<void> _recount() async {
    final query = ref.read(searchProvider);
    if (query == null) return;
    try {
      final n = await ref.read(searchApiProvider).count(query.copyWith(filters: _f));
      if (mounted) setState(() => _count = n);
    } catch (_) {
      if (mounted) setState(() => _count = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final controls = ref.watch(controlsProvider).value;
    final cats = enabledCategories(controls);
    final types = (ref.watch(_propertyTypesProvider).value ?? const <PropertyTypeOption>[]).where((p) => _f.category == null || p.category == _f.category).toList();
    final furnishing = ((controls?.country?.settings['unitDetails'] as Map?)?['furnishing'] as List?)?.cast<String>() ?? const ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'];
    Widget group(String label, List<Widget> chips) => Padding(
          padding: const EdgeInsets.only(bottom: 18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: AppText.label.copyWith(height: 17 / 14)), const SizedBox(height: 8), Wrap(spacing: 8, runSpacing: 8, children: chips)]),
        );
    final digitsOnly = [FilteringTextInputFormatter.allow(RegExp(r'[0-9,]'))];
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              children: [
                SizedBox(
                  height: 56,
                  child: Row(
                    children: [
                      const SizedBox(width: 4),
                      AppIconButton(icon: AppIcons.close, label: t.close, onPressed: () => context.pop()),
                      const SizedBox(width: 4),
                      Expanded(child: Semantics(header: true, child: Text(t.filters, style: AppText.subtitle))),
                      TextButton(
                        onPressed: () {
                          _min.clear();
                          _max.clear();
                          _rentError = null;
                          _change(const SearchFilters());
                        },
                        style: TextButton.styleFrom(foregroundColor: AppColors.green700, minimumSize: const Size(48, 48), textStyle: AppText.label),
                        child: Text(t.clearAll),
                      ),
                      const SizedBox(width: 4),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    children: [
                      if (cats.length > 1)
                        group(t.lookingFor, [
                          for (final c in cats)
                            AppFilterChip(label: _categoryLabel(t, c), selected: _f.category == c, onChanged: (on) => _change(_f.copyWith(category: () => on ? c : null, propertyType: () => null))),
                        ]),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_f.category == 'SHORT_LET' ? t.pricePerNight : t.rentPerYear, style: AppText.label.copyWith(height: 17 / 14)),
                            const SizedBox(height: 8),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(child: AppTextField(label: t.lowest, hint: t.noMinimum, controller: _min, keyboardType: TextInputType.number, inputFormatters: digitsOnly, onChanged: (_) => _rentChanged())),
                                const SizedBox(width: 12),
                                Expanded(child: AppTextField(label: t.highest, hint: t.noMaximum, controller: _max, keyboardType: TextInputType.number, inputFormatters: digitsOnly, onChanged: (_) => _rentChanged(), error: _rentError)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      group(t.bedroomsFilter, [
                        AppFilterChip(label: t.bedroomsAny, selected: _f.minBedrooms == null, onChanged: (_) => _change(_f.copyWith(minBedrooms: () => null))),
                        for (var n = 1; n <= 4; n++) AppFilterChip(label: t.bedroomsAtLeast(n), selected: _f.minBedrooms == n, onChanged: (on) => _change(_f.copyWith(minBedrooms: () => on ? n : null))),
                      ]),
                      if (types.isNotEmpty)
                        group(t.propertyType, [
                          for (final p in types) AppFilterChip(label: p.label, selected: _f.propertyType == p.code, onChanged: (on) => _change(_f.copyWith(propertyType: () => on ? p.code : null))),
                        ]),
                      group(t.furnishing, [
                        for (final c in furnishing) AppFilterChip(label: _furnishing(t, c), selected: _f.furnished == c, onChanged: (on) => _change(_f.copyWith(furnished: () => on ? c : null))),
                      ]),
                      Semantics(
                        toggled: _f.verifiedOnly,
                        child: InkWell(
                          onTap: () => _change(_f.copyWith(verifiedOnly: !_f.verifiedOnly)),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(t.verifiedOnly, style: AppText.label.copyWith(height: 17 / 14)),
                                      const SizedBox(height: 2),
                                      Text(t.verifiedOnlyText, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                                    ],
                                  ),
                                ),
                                Switch(value: _f.verifiedOnly, activeTrackColor: AppColors.green700, onChanged: (v) => _change(_f.copyWith(verifiedOnly: v))),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.divider))),
                  padding: const EdgeInsets.all(16),
                  child: AppButton(
                    label: _count == null ? t.showMoreHomes : t.showHomes(_count!),
                    onPressed: _rentError != null
                        ? null
                        : () {
                            ref.read(searchProvider.notifier).setFilters(_f);
                            context.pop();
                          },
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

/// Screen 27, Search by area or landmark.
class PlaceSearchScreen extends ConsumerStatefulWidget {
  const PlaceSearchScreen({super.key});

  @override
  ConsumerState<PlaceSearchScreen> createState() => _PlaceSearchScreenState();
}

class _PlaceSearchScreenState extends ConsumerState<PlaceSearchScreen> {
  final _text = TextEditingController();
  Timer? _debounce;
  List<PlaceResult>? _places;
  List<AreaCount> _areas = const [];
  bool _failed = false;
  int _radius = 1000;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      try {
        final city = await ref.read(defaultCityProvider.future);
        final areas = await ref.read(searchApiProvider).popularAreas(city: city?.name, limit: 8);
        if (mounted) setState(() => _areas = areas);
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _text.dispose();
    super.dispose();
  }

  void _typed(String value) {
    setState(() {});
    _debounce?.cancel();
    if (value.trim().length < 2) {
      setState(() => _places = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final places = await ref.read(searchApiProvider).places(value.trim());
        if (mounted && _text.text == value) {
          setState(() {
            _places = places;
            _failed = false;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _failed = true);
      }
    });
  }

  void _go(SearchPlace place, String label) {
    final filters = ref.read(searchProvider)?.filters ?? const SearchFilters();
    final query = SearchQuery(place: place, filters: filters);
    ref.read(searchProvider.notifier).set(query);
    ref.read(recentSearchesProvider.notifier).add(label, query);
    context.pushReplacement('/search/results');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final landmark = ref.watch(controlsProvider).value?.isOn('search.landmark') ?? false;
    final recent = ref.watch(recentSearchesProvider).value ?? const <RecentSearch>[];
    final grey = AppText.label.copyWith(color: AppColors.ink600, height: 17 / 14);
    Widget row(AppIcons icon, String title, String subtitle, VoidCallback onTap) => Semantics(
          button: true,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Container(width: 40, height: 40, alignment: Alignment.center, decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle), child: AppIcon(icon, color: AppColors.ink600)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [Text(title, style: AppText.body.copyWith(height: 19.5 / 16)), if (subtitle.isNotEmpty) Text(subtitle, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14))],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
    final typed = _text.text.trim();
    final areaMatches = typed.length < 2 ? _areas : _areas.where((a) => a.area.toLowerCase().contains(typed.toLowerCase())).toList();
    String ago(DateTime at) {
      final d = DateTime.now().difference(at);
      return d.inDays >= 1 ? t.listedDaysAgo(d.inDays).replaceFirst(RegExp(r'^\S+\s'), '') : t.listedHoursAgo(d.inHours.clamp(1, 23)).replaceFirst(RegExp(r'^\S+\s'), '');
    }

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
                  child: Row(
                    children: [
                      AppIconButton(icon: AppIcons.back, label: t.back, onPressed: () => context.pop()),
                      const SizedBox(width: 4),
                      Expanded(
                        child: TextField(
                          controller: _text,
                          autofocus: true,
                          onChanged: _typed,
                          textInputAction: TextInputAction.search,
                          style: AppText.body,
                          cursorColor: AppColors.green700,
                          decoration: InputDecoration(
                            hintText: t.searchHint,
                            hintStyle: AppText.body.copyWith(color: AppColors.ink600),
                            filled: true,
                            fillColor: AppColors.surface,
                            isDense: true,
                            constraints: const BoxConstraints(minHeight: 48),
                            contentPadding: const EdgeInsets.symmetric(vertical: 12),
                            prefixIcon: const Padding(padding: EdgeInsets.only(left: 12, right: 8), child: AppIcon(AppIcons.search, color: AppColors.ink600)),
                            prefixIconConstraints: const BoxConstraints(minHeight: 48),
                            suffixIcon: typed.isEmpty ? null : AppIconButton(icon: AppIcons.close, label: t.clearSearch, onPressed: () {
                                    _text.clear();
                                    _typed('');
                                  }),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: AppColors.green700, width: 2)),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: AppColors.green700, width: 2)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      if (landmark) ...[
                        Text(t.howFar, style: grey),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          for (final m in const [500, 1000, 3000, 5000]) AppFilterChip(label: radiusText(t, m), selected: _radius == m, onChanged: (_) => setState(() => _radius = m)),
                        ]),
                        const SizedBox(height: 16),
                      ],
                      if (_failed) AppNotice(kind: AppNoticeKind.error, title: t.searchFailed),
                      if ((_places ?? const []).isNotEmpty && landmark || areaMatches.isNotEmpty) ...[
                        Text(t.places, style: grey),
                        const SizedBox(height: 4),
                        if (landmark)
                          for (final p in _places ?? const <PlaceResult>[])
                            row(AppIcons.location, p.name, p.description, () => _go(SearchPlace.landmark(p.name, p.location, radiusM: _radius), p.name)),
                        for (final a in areaMatches) row(AppIcons.map, a.area, a.city, () => _go(SearchPlace.area(a.area, city: a.city), a.area)),
                      ] else if (_places != null && typed.length >= 2)
                        Text(t.noPlacesFound, style: AppText.body.copyWith(color: AppColors.ink600)),
                      if (recent.isNotEmpty && typed.isEmpty) ...[
                        const Divider(height: 24, color: AppColors.divider),
                        Text(t.recentSearches, style: grey),
                        const SizedBox(height: 4),
                        for (final r in recent)
                          row(AppIcons.search, r.label, ago(r.at), () {
                            ref.read(searchProvider.notifier).set(r.query);
                            context.pushReplacement('/search/results');
                          }),
                      ],
                      const SizedBox(height: 12),
                      Text(t.landmarkHint, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
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

/// Screen 29, Save this area. The area is the circle the search used: around the user, or around a landmark.
class SaveAreaScreen extends ConsumerStatefulWidget {
  const SaveAreaScreen({super.key});

  @override
  ConsumerState<SaveAreaScreen> createState() => _SaveAreaScreenState();
}

class _SaveAreaScreenState extends ConsumerState<SaveAreaScreen> {
  late final _name = TextEditingController(text: ref.read(searchProvider)?.place.label ?? '');
  bool _alerts = true;
  bool _busy = false;
  String? _nameError;
  String? _failure;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save(SearchQuery query) async {
    final t = context.texts;
    if (_name.text.trim().isEmpty) return setState(() => _nameError = t.errorSearchName);
    setState(() {
      _busy = true;
      _failure = null;
      _nameError = null;
    });
    try {
      await ref.read(searchApiProvider).saveArea(name: _name.text.trim(), centre: query.place.centre!, radiusM: query.place.radiusM, filters: query.filters, alerts: _alerts);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t.areaSaved)));
      context.pop();
    } catch (e) {
      if (mounted) setState(() => _failure = e.toString().contains('TOO_MANY') ? t.errorTooManyAreas : t.somethingWentWrong);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final query = ref.watch(searchProvider);
    if (query == null || query.place.centre == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/home'));
      return const SizedBox.shrink();
    }
    final f = query.filters;
    final currency = ref.watch(controlsProvider).value?.country?.currency ?? 'NGN';
    final locale = Localizations.localeOf(context).languageCode;
    final summary = [
      if (f.category != null) _categoryLabel(t, f.category!),
      if (f.maxRent != null) t.upToRent(_shortMoney(f.maxRent!, currency, locale)),
      if (f.minRent != null && f.maxRent == null) t.fromRent(_shortMoney(f.minRent!, currency, locale)),
      if (f.minBedrooms != null) t.bedroomsPlus(f.minBedrooms!),
      if (f.furnished != null) _furnishing(t, f.furnished!),
      if (f.verifiedOnly) t.verifiedOnly,
    ];
    return AppScreen(
      title: t.saveThisArea,
      onBack: () => context.pop(),
      bottom: [AppButton(label: t.saveArea, onPressed: _busy ? null : () => _save(query))],
      children: [
        const SizedBox(height: 8),
        // The map picture of the area comes with the maps provider (decision 81); until then the area is described.
        AppNotice(
          kind: AppNoticeKind.info,
          title: t.withinOf(radiusText(t, query.place.radiusM), query.place.aroundMe ? t.aroundYou : query.place.label!),
          icon: AppIcons.location,
        ),
        const SizedBox(height: 16),
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        AppTextField(label: t.nameThisSearch, controller: _name, error: _nameError, textCapitalization: TextCapitalization.sentences),
        if (summary.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(t.matching, style: AppText.label.copyWith(height: 17 / 14)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [for (final s in summary) AppFilterChip(label: s, selected: true, onChanged: null)]),
        ],
        const SizedBox(height: 16),
        Semantics(
          toggled: _alerts,
          child: InkWell(
            onTap: () => setState(() => _alerts = !_alerts),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.alertMeHere, style: AppText.label.copyWith(height: 17 / 14)),
                      const SizedBox(height: 2),
                      Text(t.alertMeHereText, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    ],
                  ),
                ),
                Switch(value: _alerts, activeTrackColor: AppColors.green700, onChanged: (v) => setState(() => _alerts = v)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// Screen 10, Location permission: shown once, before the phone first asks.
class LocationPermissionScreen extends ConsumerWidget {
  const LocationPermissionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    Widget point(String text) => Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const AppIcon(AppIcons.check, size: 20, color: AppColors.success), const SizedBox(width: 10), Expanded(child: Text(text, style: AppText.body.copyWith(height: 19.5 / 16)))]),
        );
    return AppScreen(
      title: '',
      onBack: () => context.pop(),
      bottom: [
        AppButton(
          label: t.allowLocation,
          onPressed: () async {
            await ref.read(locationReaderProvider).markExplained();
            if (!context.mounted) return;
            context.pop();
            await _findAndSearch(context, ref);
          },
        ),
        AppButton(
          label: t.searchByAreaInstead,
          kind: AppButtonKind.text,
          onPressed: () {
            ref.read(locationReaderProvider).markExplained();
            context.pushReplacement('/search/place');
          },
        ),
      ],
      children: [
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: AppColors.infoTint, shape: BoxShape.circle),
            child: const AppIcon(AppIcons.locationFilled, color: AppColors.verified, cut: AppColors.infoTint),
          ),
        ),
        const SizedBox(height: 16),
        AppHeading(t.locationTitle, intro: t.locationText),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
          decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(AppRadius.medium)),
          child: Column(children: [point(t.locationPoint1), point(t.locationPoint2), point(t.locationPoint3)]),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
