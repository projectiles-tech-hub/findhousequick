import 'package:flutter/widgets.dart';

import 'app_icon.dart';
import 'tokens.dart';
import 'wide.dart';

enum AppNoticeKind { error, warning, success, info }

/// A notice on a screen. It always says what happened and what to do next.
class AppNotice extends StatelessWidget {
  const AppNotice({super.key, required this.kind, required this.title, this.message, this.icon});

  final AppNoticeKind kind;
  final String title;
  final String? message;

  /// Another icon in place of the usual one for this kind of notice.
  final AppIcons? icon;

  @override
  Widget build(BuildContext context) {
    final wide = AppWide.of(context);
    final (bg, fg, usual) = switch (kind) {
      AppNoticeKind.error => (AppColors.errorTint, AppColors.error, AppIcons.close),
      AppNoticeKind.warning => (AppColors.warningTint, AppColors.warning, AppIcons.bell),
      AppNoticeKind.success => (AppColors.successTint, AppColors.success, AppIcons.check),
      AppNoticeKind.info => (AppColors.infoTint, AppColors.verified, AppIcons.help),
    };
    return Semantics(
      container: true,
      liveRegion: kind == AppNoticeKind.error,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(wide ? 14 : AppRadius.medium)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIcon(icon ?? usual, color: fg, cut: bg),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // In the website layouts a notice has a larger, bolder title, and the blue one has blue words.
                  Text(
                    title,
                    style: wide
                        ? AppText.body.copyWith(fontWeight: FontWeight.w700, fontVariations: const [FontVariation('wght', 700)], height: 21 / 16, color: kind == AppNoticeKind.info ? fg : AppColors.ink900)
                        : AppText.label,
                  ),
                  if (message != null) ...[
                    const SizedBox(height: 2),
                    Text(message!, style: wide ? AppText.body.copyWith(fontSize: 15, height: 20 / 15, color: kind == AppNoticeKind.info ? fg : AppColors.ink900) : AppText.bodySmall),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
