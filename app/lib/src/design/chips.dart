import 'package:flutter/material.dart';

import 'app_icon.dart';
import 'tokens.dart';

/// A filter chip for search results: green with a tick when on, white with a border when off.
class AppFilterChip extends StatelessWidget {
  const AppFilterChip({super.key, required this.label, required this.selected, required this.onChanged});

  final String label;
  final bool selected;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.green700 : AppColors.surface,
        shape: StadiumBorder(side: selected ? BorderSide.none : const BorderSide(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onChanged == null ? null : () => onChanged!(!selected),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: AppSpace.touch),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (selected) ...[
                    const AppIcon(AppIcons.check, color: AppColors.surface),
                    const SizedBox(width: 6),
                  ],
                  Flexible(child: Text(label, style: AppText.label.copyWith(color: selected ? AppColors.surface : AppColors.ink900))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum AppTagKind { notApproved, approved, waiting, verified }

/// A small tag showing the state of a check, or the verified badge. Never colour alone: each has words, and most an icon.
class AppTag extends StatelessWidget {
  const AppTag({super.key, required this.label, required this.kind});

  final String label;
  final AppTagKind kind;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (kind) {
      AppTagKind.notApproved => (AppColors.errorTint, AppColors.error, AppIcons.close),
      AppTagKind.approved => (AppColors.successTint, AppColors.success, AppIcons.check),
      AppTagKind.waiting => (AppColors.warningTint, AppColors.warning, null),
      AppTagKind.verified => (AppColors.infoTint, AppColors.verified, AppIcons.shieldCheck),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadius.small)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[AppIcon(icon, size: 18, color: fg, cut: bg), const SizedBox(width: 4)],
          Flexible(child: Text(label, style: AppText.label.copyWith(color: fg))),
        ],
      ),
    );
  }
}
