import 'package:flutter/widgets.dart';

/// Whether the screen is being shown in its website layout (768 wide and over, decision 74) rather than its phone
/// layout. The website designs use the same parts with their own measurements: rounder corners, heavier labels and
/// larger headings. Each part reads this and draws itself accordingly, so a screen is written once.
class AppWide extends InheritedWidget {
  const AppWide({super.key, required this.wide, required this.sideBySide, required super.child});

  /// 768 and over: the website layout.
  final bool wide;

  /// 1100 and over: room for the picture beside the card, as drawn at 1366.
  final bool sideBySide;

  static bool of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppWide>()?.wide ?? false;
  static bool sideBySideOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppWide>()?.sideBySide ?? false;

  /// Wraps the app so every screen knows which layout it is in.
  static Widget forWidth(BuildContext context, Widget child) {
    final width = MediaQuery.sizeOf(context).width;
    return AppWide(wide: width >= 768, sideBySide: width >= 1100, child: child);
  }

  @override
  bool updateShouldNotify(AppWide old) => wide != old.wide || sideBySide != old.sideBySide;
}
