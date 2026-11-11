import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The language the user chose on this device. Empty means "follow the phone's language".
class LocaleNotifier extends Notifier<Locale?> {
  static const _key = 'language.v1';

  @override
  Locale? build() {
    SharedPreferences.getInstance().then((prefs) {
      final saved = prefs.getString(_key);
      if (saved != null && saved.isNotEmpty) state = Locale(saved);
    });
    return null;
  }

  Future<void> choose(String languageCode) async {
    state = Locale(languageCode);
    (await SharedPreferences.getInstance()).setString(_key, languageCode);
  }
}

final localeProvider = NotifierProvider<LocaleNotifier, Locale?>(LocaleNotifier.new);
