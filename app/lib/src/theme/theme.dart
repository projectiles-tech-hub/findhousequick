import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// The app's look, built from the approved design values. There is one look; the designs have no dark version.
class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: AppColors.green700).copyWith(
      primary: AppColors.green700,
      onPrimary: AppColors.surface,
      secondary: AppColors.amber500,
      surface: AppColors.surface,
      onSurface: AppColors.ink900,
      error: AppColors.error,
      onError: AppColors.surface,
      outline: AppColors.border,
      outlineVariant: AppColors.divider,
    );
    return ThemeData(
      useMaterial3: true,
      // The same sizes on every device: Flutter would otherwise squeeze buttons and fields on desktop and the web.
      visualDensity: VisualDensity.standard,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: AppText.family,
      dividerColor: AppColors.divider,
      textTheme: TextTheme(
        displaySmall: AppText.display,
        headlineSmall: AppText.title,
        titleLarge: AppText.title,
        titleMedium: AppText.subtitle,
        bodyLarge: AppText.body,
        bodyMedium: AppText.body,
        bodySmall: AppText.bodySmall,
        labelLarge: AppText.button,
        labelMedium: AppText.label,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.ink900,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: AppText.subtitle,
      ),
    );
  }
}
