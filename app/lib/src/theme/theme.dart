import 'package:flutter/material.dart';

/// Placeholder brand colours until the FindHouseQuick brand is designed (Release 0 brand workstream).
class AppTheme {
  static const _seed = Color(0xFF1F3864);

  static ThemeData light() => ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _seed),
        useMaterial3: true,
      );

  static ThemeData dark() => ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _seed, brightness: Brightness.dark),
        useMaterial3: true,
      );
}
