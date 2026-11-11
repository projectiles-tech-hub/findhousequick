import 'package:flutter/material.dart';

import 'app_icon.dart';
import 'tokens.dart';
import 'wide.dart';

enum AppButtonKind { main, outline, text, danger }

/// A button as designed: 52 high, corners of 12. There is only one main button on a screen.
/// The words wrap onto a second line rather than being cut off, so longer wording still fits.
class AppButton extends StatelessWidget {
  const AppButton({super.key, required this.label, required this.onPressed, this.kind = AppButtonKind.main, this.expand = true, this.icon, this.iconFirst = false});

  final String label;

  /// Leave empty to show the button as disabled.
  final VoidCallback? onPressed;
  final AppButtonKind kind;

  /// Fill the width it is given. Set to false for a button that is only as wide as its words.
  final bool expand;

  /// An icon beside the words. The website layouts use one on their main buttons; the phone layouts do not show it.
  final AppIcons? icon;

  /// Puts the icon before the words rather than after them.
  final bool iconFirst;

  @override
  Widget build(BuildContext context) {
    Color? pick(Set<WidgetState> s, {required Color? normal, required Color? pressed, required Color? disabled}) {
      if (s.contains(WidgetState.disabled)) return disabled;
      if (s.contains(WidgetState.pressed)) return pressed;
      return normal;
    }

    final (bg, fg, side) = switch (kind) {
      AppButtonKind.main => (
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.green700, pressed: AppColors.green800, disabled: AppColors.divider)),
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.surface, pressed: AppColors.surface, disabled: AppColors.ink400)),
          null,
        ),
      AppButtonKind.danger => (
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.error, pressed: AppColors.errorPressed, disabled: AppColors.divider)),
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.surface, pressed: AppColors.surface, disabled: AppColors.ink400)),
          null,
        ),
      AppButtonKind.outline => (
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.surface, pressed: AppColors.green50, disabled: AppColors.surface)),
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.green700, pressed: AppColors.green700, disabled: AppColors.ink400)),
          WidgetStateProperty.resolveWith(
            (s) => BorderSide(color: s.contains(WidgetState.disabled) ? AppColors.divider : AppColors.green700, width: 2),
          ),
        ),
      AppButtonKind.text => (
          WidgetStateProperty.resolveWith((s) => pick(s, normal: Colors.transparent, pressed: AppColors.green50, disabled: Colors.transparent)),
          WidgetStateProperty.resolveWith((s) => pick(s, normal: AppColors.green700, pressed: AppColors.green700, disabled: AppColors.ink400)),
          null,
        ),
    };

    final wide = AppWide.of(context);
    final words = Text(label, textAlign: TextAlign.center, maxLines: 2);
    final button = TextButton(
      onPressed: onPressed,
      style: ButtonStyle(
        backgroundColor: bg,
        foregroundColor: fg,
        side: side,
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        minimumSize: const WidgetStatePropertyAll(Size(64, 52)),
        padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16, vertical: 16)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(wide ? 14 : AppRadius.medium))),
        textStyle: WidgetStatePropertyAll(wide ? AppText.button.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)]) : AppText.button),
        tapTargetSize: MaterialTapTargetSize.padded,
      ),
      child: !wide || icon == null
          ? words
          : Builder(builder: (context) {
              // The icon takes the colour of the words, whatever state the button is in.
              final ink = DefaultTextStyle.of(context).style.color ?? AppColors.surface;
              final picture = AppIcon(icon!, color: ink, cut: Colors.transparent);
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: iconFirst ? [picture, const SizedBox(width: 8), Flexible(child: words)] : [Flexible(child: words), const SizedBox(width: 8), picture],
              );
            }),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A round icon button, 48 across for an easy tap. [tinted] puts it on a soft green circle.
class AppIconButton extends StatelessWidget {
  const AppIconButton({super.key, required this.icon, required this.label, required this.onPressed, this.tinted = false, this.background});

  final AppIcons icon;

  /// What the button does, for screen readers and as a hint on long press.
  final String label;
  final VoidCallback? onPressed;
  final bool tinted;

  /// A circle of another colour behind the icon, such as white for the save button on a photo.
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final fill = background ?? (tinted ? AppColors.green50 : Colors.transparent);
    final ink = onPressed == null ? AppColors.ink400 : (tinted ? AppColors.green700 : AppColors.ink900);
    return Semantics(
      button: true,
      label: label,
      enabled: onPressed != null,
      child: Tooltip(
        message: label,
        excludeFromSemantics: true,
        child: Material(
          color: fill,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            child: SizedBox(width: AppSpace.touch, height: AppSpace.touch, child: Center(child: AppIcon(icon, color: ink, cut: fill))),
          ),
        ),
      ),
    );
  }
}
