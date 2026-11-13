import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_localizations/flutter_localizations.dart' show GlobalWidgetsLocalizations;

import '../../l10n/app_texts.dart';

export '../../l10n/app_texts.dart';

/// Flutter's own words (such as "Copy" and "Paste" on a text field) do not come in Pidgin, so Pidgin borrows the
/// English ones. Without this, the app would fail to open in a language Flutter does not carry.
class _BorrowedMaterial extends LocalizationsDelegate<MaterialLocalizations> {
  const _BorrowedMaterial();
  @override
  bool isSupported(Locale locale) => !kMaterialSupportedLanguages.contains(locale.languageCode);
  @override
  Future<MaterialLocalizations> load(Locale locale) => DefaultMaterialLocalizations.load(locale);
  @override
  bool shouldReload(_BorrowedMaterial old) => false;
}

class _BorrowedCupertino extends LocalizationsDelegate<CupertinoLocalizations> {
  const _BorrowedCupertino();
  @override
  bool isSupported(Locale locale) => !kCupertinoSupportedLanguages.contains(locale.languageCode);
  @override
  Future<CupertinoLocalizations> load(Locale locale) => DefaultCupertinoLocalizations.load(locale);
  @override
  bool shouldReload(_BorrowedCupertino old) => false;
}

/// Everything the app needs to show its words in the chosen language.
const List<LocalizationsDelegate<dynamic>> appLocalizationsDelegates = [
  AppTexts.delegate,
  _BorrowedMaterial(),
  _BorrowedCupertino(),
  GlobalMaterialLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
];

/// The languages the app has words for. Which of them a user may choose comes from the country's settings.
const List<Locale> appLocales = AppTexts.supportedLocales;

/// Short way to reach the app's words: `context.texts.tabSearch`.
extension AppTextsOf on BuildContext {
  AppTexts get texts => AppTexts.of(this);
}
