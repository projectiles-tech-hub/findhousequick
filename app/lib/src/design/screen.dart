import 'package:flutter/material.dart';

import '../l10n/languages.dart';
import 'app_icon.dart';
import 'buttons.dart';
import 'tokens.dart';
import 'wide.dart';

/// The frame of a screen, in both of its designed layouts.
///
/// **Phone:** a white page, an app bar 56 high with a back button and a title, the content with 16 at the edges,
/// and the buttons held at the bottom. The content scrolls when it is taller than the screen.
///
/// **Website (768 and over):** the page background, a header with the logo and "Back to properties", and the
/// content in a white card 500 wide with the buttons at the end of it. From 1100 wide, [side] is shown beside the
/// card. With [panel], the content is a panel over a dimmed page, with a close button, as drawn for sign-in.
class AppScreen extends StatelessWidget {
  const AppScreen({
    super.key,
    this.title,
    this.onBack,
    this.top,
    required this.children,
    this.bottom = const [],
    this.side,
    this.footer,
    this.panel = false,
    this.onClose,
    this.onBackToProperties,
  });

  /// The app bar title on the phone. Without it (and without [top]) the screen has no app bar.
  final String? title;

  /// Shows the back button on the phone. Leave empty on a screen the user must not leave backwards.
  final VoidCallback? onBack;

  /// Takes the place of the app bar on the phone, such as the logo row of the welcome screen.
  final Widget? top;
  final List<Widget> children;

  /// The buttons: held at the bottom on the phone, at the end of the card on the website.
  final List<Widget> bottom;

  /// Website only, from 1100 wide: what stands beside the card.
  final Widget? side;

  /// Website only: the last row of the card, such as "Already have an account? Sign in".
  final Widget? footer;

  /// Website only: show the content as a panel over a dimmed page.
  final bool panel;
  final VoidCallback? onClose;

  /// Website only: where "Back to properties" in the header leads.
  final VoidCallback? onBackToProperties;

  @override
  Widget build(BuildContext context) => AppWide.of(context) ? _wide(context) : _phone(context);

  Widget _phone(BuildContext context) {
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
    );
  }

  Widget _wide(BuildContext context) {
    final t = context.texts;
    final width = MediaQuery.sizeOf(context).width;
    final edge = width >= 1366 ? (width - 1200) / 2 : 24.0;
    final inner = panel ? 32.0 : 36.0;
    final card = Container(
      width: panel ? 460 : (AppWide.sideBySideOf(context) ? 500 : 520),
      padding: EdgeInsets.fromLTRB(inner, panel ? 28 : 36, inner, panel ? 24 : 32),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(28)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ...children,
          if (bottom.isNotEmpty) const SizedBox(height: 4),
          for (var i = 0; i < bottom.length; i++) ...[SizedBox(height: i == 0 ? 0 : 16), bottom[i]],
          if (footer != null) ...[const SizedBox(height: 16), footer!],
        ],
      ),
    );
    final header = Container(
      height: 76,
      color: panel ? AppColors.surface : null,
      padding: EdgeInsets.symmetric(horizontal: edge),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.green700, borderRadius: BorderRadius.circular(10)),
            child: const AppIcon(AppIcons.homeFilled, color: AppColors.surface, cut: AppColors.surface),
          ),
          const SizedBox(width: 10),
          Text(t.appName, style: AppText.title.copyWith(fontSize: 21, height: 28 / 21)),
          const Spacer(),
          if (!panel && onBackToProperties != null)
            Material(
              color: AppColors.surface,
              shape: const StadiumBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onBackToProperties,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                  child: Row(
                    children: [
                      const AppIcon(AppIcons.back, color: AppColors.green700),
                      const SizedBox(width: 8),
                      Text(t.backToProperties, style: AppText.body.copyWith(color: AppColors.green700, fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 21 / 16)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    final body = LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  card,
                  if (!panel && side != null && AppWide.sideBySideOf(context)) ...[const SizedBox(width: 64), side!],
                ],
              ),
            ),
          ),
        ),
      ),
    );
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: panel
            // The page behind is dimmed; the panel sits over it. The page itself belongs to the public website.
            ? Stack(
                children: [
                  Positioned.fill(child: Column(children: [header, const Expanded(child: SizedBox())])),
                  Positioned.fill(child: GestureDetector(onTap: onClose, child: Container(color: AppColors.ink900.withValues(alpha: 0.55)))),
                  Positioned.fill(child: body),
                ],
              )
            : Column(children: [header, Expanded(child: body)]),
      ),
    );
  }
}

/// The heading row of a panel: the title and introduction, with the round close button at the right.
class AppPanelHeading extends StatelessWidget {
  const AppPanelHeading({super.key, required this.title, this.intro, this.onClose});

  final String title;
  final String? intro;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(title, style: AppText.display.copyWith(height: 37 / 28))),
              if (intro != null) ...[const SizedBox(height: 4), Text(intro!, style: AppText.body.copyWith(color: AppColors.ink600, height: 21 / 16))],
            ],
          ),
        ),
        if (onClose != null) ...[
          const SizedBox(width: 16),
          AppIconButton(icon: AppIcons.close, label: context.texts.close, onPressed: onClose, background: AppColors.background),
        ],
      ],
    );
  }
}

/// The rounded square holding an icon at the top of a website card: soft green, or solid green with a white icon.
class AppIconTile extends StatelessWidget {
  const AppIconTile(this.icon, {super.key, this.solid = false});

  final AppIcons icon;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final bg = solid ? AppColors.green700 : AppColors.green50;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 64,
        height: 64,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: AppIcon(icon, color: solid ? AppColors.surface : AppColors.green700, cut: bg),
      ),
    );
  }
}

/// Two choices side by side in one rounded bar, the chosen one on a white tile ("Phone number" or "Email").
class AppSegmented extends StatelessWidget {
  const AppSegmented({super.key, required this.labels, required this.selected, required this.onChanged});

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                button: true,
                selected: i == selected,
                child: Material(
                  color: i == selected ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => onChanged(i),
                    child: Container(
                      height: 44,
                      alignment: Alignment.center,
                      child: Text(
                        labels[i],
                        style: AppText.body.copyWith(
                          fontSize: 15,
                          height: 20 / 15,
                          fontWeight: FontWeight.w600,
                          fontVariations: const [FontVariation('wght', 600)],
                          color: i == selected ? AppColors.ink900 : AppColors.ink600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The last row of a card on the website: grey words and a link, centred ("Already have an account? Sign in").
class AppFooterLink extends StatelessWidget {
  const AppFooterLink({super.key, this.words, required this.link, required this.onPressed});

  final String? words;
  final String link;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4,
      children: [
        if (words != null) Text(words!, style: AppText.body.copyWith(color: AppColors.ink600, height: 21 / 16)),
        TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.green700,
            minimumSize: const Size(48, 48),
            padding: const EdgeInsets.symmetric(horizontal: 8),
            textStyle: AppText.button.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)]),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium)),
          ),
          child: Text(link),
        ),
      ],
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
    final wide = AppWide.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: wide ? AppText.display.copyWith(fontSize: 30, height: 35 / 30) : AppText.title.copyWith(height: 27 / 22))),
        if (intro != null) ...[
          SizedBox(height: wide ? 6 : 16),
          Text(intro!, style: AppText.body.copyWith(color: AppColors.ink600, height: (wide ? 21 : 19.5) / 16)),
        ],
      ],
    );
  }
}

/// "Step 2 of 3" with a bar of segments under it.
class AppStepProgress extends StatelessWidget {
  const AppStepProgress({super.key, required this.step, required this.total, this.caption});

  final int step;
  final int total;

  /// The name of the step, shown at the right in the website layout.
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: context.texts.stepOf(step, total),
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (AppWide.of(context))
              Row(
                children: [
                  Expanded(child: Text(context.texts.stepOf(step, total), style: AppText.label.copyWith(color: AppColors.green700, fontWeight: FontWeight.w700, fontVariations: const [FontVariation('wght', 700)], height: 19 / 14))),
                  if (caption != null) Text(caption!, style: AppText.bodySmall.copyWith(color: AppColors.ink500, height: 19 / 14)),
                ],
              )
            else
              Text(context.texts.stepOf(step, total), style: AppText.label.copyWith(color: AppColors.ink600, height: 17 / 14)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (var i = 1; i <= total; i++) ...[
                  if (i > 1) SizedBox(width: AppWide.of(context) ? 6 : 4),
                  Expanded(
                    child: Container(
                      height: AppWide.of(context) ? 6 : 4,
                      decoration: BoxDecoration(color: i <= step ? AppColors.green700 : AppColors.divider, borderRadius: BorderRadius.circular(3)),
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
  const AppLinkButton({super.key, required this.label, required this.onPressed, this.alignment = Alignment.centerLeft});

  final String label;
  final VoidCallback? onPressed;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.green700,
          disabledForegroundColor: AppColors.ink400,
          minimumSize: const Size(48, 52),
          padding: EdgeInsets.zero,
          textStyle: AppWide.of(context) ? AppText.button.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)]) : AppText.button,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium)),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
        child: Text(label),
      ),
    );
  }
}
