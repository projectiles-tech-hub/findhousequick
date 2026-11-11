import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'design/gallery_screen.dart';
import 'home/home_screen.dart';
import 'l10n/languages.dart';
import 'theme/theme.dart';

/// Set with --dart-define=PARTS_GALLERY=true to open the page of shared parts at /parts. Off in every released build.
const _partsGallery = bool.fromEnvironment('PARTS_GALLERY');

final _router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
    if (_partsGallery) GoRoute(path: '/parts', builder: (context, state) => const GalleryScreen()),
  ],
);

class FindHouseQuickApp extends StatelessWidget {
  const FindHouseQuickApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FindHouseQuick',
      theme: AppTheme.light(),
      localizationsDelegates: appLocalizationsDelegates,
      supportedLocales: appLocales,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
