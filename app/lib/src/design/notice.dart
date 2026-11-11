import 'package:flutter/widgets.dart';

import 'app_icon.dart';
import 'tokens.dart';

enum AppNoticeKind { error, warning, success, info }

/// A notice on a screen. It always says what happened and what to do next.
class AppNotice extends StatelessWidget {
  const AppNotice({super.key, required this.kind, required this.title, this.message});

  final AppNoticeKind kind;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (kind) {
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
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadius.medium)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIcon(icon, color: fg, cut: bg),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppText.label),
                  if (message != null) ...[const SizedBox(height: 2), Text(message!, style: AppText.bodySmall)],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
