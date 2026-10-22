import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'home/home_screen.dart';
import 'theme/theme.dart';

final _router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
  ],
);

class FindHouseQuickApp extends StatelessWidget {
  const FindHouseQuickApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FindHouseQuick',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
