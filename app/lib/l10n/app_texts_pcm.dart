// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_texts.dart';

// ignore_for_file: type=lint

/// The translations for Nigerian Pidgin (`pcm`).
class AppTextsPcm extends AppTexts {
  AppTextsPcm([String locale = 'pcm']) : super(locale);

  @override
  String get appName => 'FindHouseQuick';

  @override
  String get tabSearch => 'Search';

  @override
  String get tabSaved => 'Saved';

  @override
  String get tabProperties => 'Properties';

  @override
  String get tabMessages => 'Messages';

  @override
  String get tabInspections => 'Inspections';

  @override
  String get tabMe => 'Me';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get noConnectionTitle => 'No internet connection';

  @override
  String get noConnectionMessage =>
      'Check your data or Wi-Fi. We will try again when you are back online.';

  @override
  String get somethingWentWrong => 'Something went wrong. Please try again.';

  @override
  String get tryAgain => 'Try again';
}
