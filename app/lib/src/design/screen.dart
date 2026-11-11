import 'package:flutter/material.dart';

import '../l10n/languages.dart';
import 'app_icon.dart';
import 'buttons.dart';
import 'tokens.dart';

/// The frame of a phone screen as designed: a white page, an app bar 56 high with a back button and a title, the
/// content with 16 at the edges, and the buttons held at the bottom. The content scrolls when it is taller than
/// the screen, for example with the keyboard open.
///
/// On a wide screen the same content is shown in a column 480 wide until the wide layouts are built.
class AppScreen extends StatelessWidget {
  const AppScreen({super.key, this.title, this.onBack, this.top, required this.children, this.bottom = const []});

  /// The app bar title. Without it (and without [top]) the screen has no app bar.
  final String? title;

  /// Shows the back button. Leave empty on a screen the user must not leave backwards.
  final VoidCallback? onBack;

  /// Takes the place of the app bar, such as the logo row of the welcome screen.
  final Widget? top;
  final List<Widget> children;

  /// The buttons at the bottom, with 8 between them.
  final List<Widget> bottom;

  @override
  Widget build(BuildContext context) {
    final bar = top ??
        (title == null
            ? const SizedBox(height: 56)
            : SizedBox(
                height: 56,
                child: Row(
                  children: [
                    const SizedBox(width: 4),
                    if (onBack != null) AppIconButton(icon: AppIcons.back, label: context.texts.back, onPressed: onBack) else const SizedBox(width: 12),
                    const SizedBox(width: 4),
                    Expanded(child: Semantics(header: true, child: Text(title!, style: AppText.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis))),
                  ],
                ),
              ));
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              children: [
                bar,
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, box) => SingleChildScrollView(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: box.maxHeight),
                        child: IntrinsicHeight(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: AppSpace.screenEdge),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                              ),
                              const Spacer(),
                              if (bottom.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.all(AppSpace.screenEdge),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      for (var i = 0; i < bottom.length; i++) ...[if (i > 0) const SizedBox(height: 8), bottom[i]],
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The page heading (22 bold) with the grey introduction under it.
class AppHeading extends StatelessWidget {
  const AppHeading(this.title, {super.key, this.intro});

  final String title;
  final String? intro;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: AppText.title.copyWith(height: 27 / 22))),
        if (intro != null) ...[const SizedBox(height: 16), Text(intro!, style: AppText.body.copyWith(color: AppColors.ink600, height: 19.5 / 16))],
      ],
    );
  }
}

/// "Step 2 of 3" with a bar of segments under it.
class AppStepProgress extends StatelessWidget {
  const AppStepProgress({super.key, required this.step, required this.total});

  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: context.texts.stepOf(step, total),
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(context.texts.stepOf(step, total), style: AppText.label.copyWith(color: AppColors.ink600, height: 17 / 14)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (var i = 1; i <= total; i++) ...[
                  if (i > 1) const SizedBox(width: 4),
                  Expanded(
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(color: i <= step ? AppColors.green700 : AppColors.divider, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A text-only button set to the left edge, as used for links under a form ("Forgot your password?").
class AppLinkButton extends StatelessWidget {
  const AppLinkButton({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.green700,
          disabledForegroundColor: AppColors.ink400,
          minimumSize: const Size(48, 52),
          padding: EdgeInsets.zero,
          textStyle: AppText.button,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium)),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
        child: Text(label),
      ),
    );
  }
}
