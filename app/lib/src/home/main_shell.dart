import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../design/app_icon.dart';
import '../design/bottom_bar.dart';
import '../design/main_tabs.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../l10n/languages.dart';
import '../session/session.dart';

/// The main screens with the bottom bar (Search, Saved or Properties, Messages, Inspections, Me). Someone looking
/// around without an account sees the search screens without the bar, as in screen 11.
class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider).value;
    final signedIn = session?.signedIn ?? false;
    return Scaffold(
      body: shell,
      bottomNavigationBar: !signedIn
          ? null
          : AppBottomBar(
              tabs: mainTabs(context.texts, listsProperties: session?.me?.listsProperties ?? false),
              current: shell.currentIndex,
              onTap: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
            ),
    );
  }
}

/// A tab whose screens are built in a later part of step 6 (ADR 0014). It says so plainly rather than showing an
/// unfinished screen.
class ComingTab extends StatelessWidget {
  const ComingTab({super.key, required this.title, required this.icon, this.actions = const []});

  final String title;
  final AppIcons icon;

  /// Buttons that already work, such as Verification and Sign out on the Me tab until it is built.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Semantics(header: true, child: Text(title, style: AppText.title.copyWith(height: 27 / 22))),
            const SizedBox(height: 32),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle),
                child: AppIcon(icon, color: AppColors.ink600),
              ),
            ),
            const SizedBox(height: 16),
            AppHeading(t.beingBuiltTitle, intro: t.beingBuiltText),
            for (final a in actions) ...[const SizedBox(height: 12), a],
          ],
        ),
      ),
    );
  }
}
