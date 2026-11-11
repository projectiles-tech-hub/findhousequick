import 'package:flutter/widgets.dart';

/// The approved design values, read from the "00 Design system" page of the design file (decisions 68 and 69).
/// Screens use these names; no screen writes a colour, size or corner of its own.
abstract final class AppColors {
  static const green700 = Color(0xFF0B6B3A); // main action
  static const green800 = Color(0xFF08502B); // pressed
  static const green50 = Color(0xFFE7F3EC); // tint
  static const amber500 = Color(0xFFF2A900);
  static const amber100 = Color(0xFFFDF0CC);
  static const ink900 = Color(0xFF111827); // text
  static const ink600 = Color(0xFF4B5563); // secondary text
  static const ink400 = Color(0xFF9CA3AF); // disabled only
  static const border = Color(0xFFB8BEC7);
  static const divider = Color(0xFFE5E7EB);
  static const background = Color(0xFFF6F6F3);
  static const surface = Color(0xFFFFFFFF);
  static const success = Color(0xFF15803D);
  static const successTint = Color(0xFFE3F4E8);
  static const warning = Color(0xFFB45309);
  static const warningTint = Color(0xFFFEF3E2);
  static const error = Color(0xFFB91C1C);
  static const errorPressed = Color(0xFF8F1717);
  static const errorTint = Color(0xFFFDE8E8);
  static const verified = Color(0xFF1D4ED8);
  static const infoTint = Color(0xFFE6EDFD);
}

/// Spacing goes in steps of 4. Screen edges have 16 on phones.
abstract final class AppSpace {
  static const double s4 = 4;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s48 = 48;
  static const double screenEdge = 16;

  /// Smallest tappable area, even when the icon inside is 24.
  static const double touch = 48;
}

abstract final class AppRadius {
  static const double small = 8; // chips, fields
  static const double medium = 12; // buttons, cards
  static const double large = 16; // sheets
}

/// Source Sans 3 (decision 69). Nothing smaller than 14 is used; reading text is 16.
abstract final class AppText {
  static const family = 'Source Sans 3';

  static TextStyle _style(double size, double line, FontWeight weight) => TextStyle(
        fontFamily: family,
        fontSize: size,
        height: line / size,
        fontWeight: weight,
        fontVariations: [FontVariation('wght', weight.value.toDouble())],
        color: AppColors.ink900,
        letterSpacing: 0,
      );

  static final display = _style(28, 36, FontWeight.w700);
  static final title = _style(22, 30, FontWeight.w700);
  static final subtitle = _style(18, 26, FontWeight.w500);
  static final price = _style(20, 26, FontWeight.w700);
  static final body = _style(16, 24, FontWeight.w400);
  static final bodySmall = _style(14, 20, FontWeight.w400);
  static final button = _style(16, 20, FontWeight.w500);
  static final label = _style(14, 20, FontWeight.w500);
}
