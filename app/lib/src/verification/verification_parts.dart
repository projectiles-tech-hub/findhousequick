import 'package:flutter/material.dart';

import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/tokens.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';

/// The round tinted icon at the top of a result screen.
class ResultIcon extends StatelessWidget {
  const ResultIcon(this.icon, {super.key, required this.tint, required this.ink});

  final AppIcons icon;
  final Color tint;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    final wide = AppWide.of(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 64,
        height: 64,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(wide ? 20 : 32)),
        child: AppIcon(icon, color: ink, cut: tint),
      ),
    );
  }
}

/// A grey box with a small heading and a list under it: tips, or what the user can now do.
class PointsBox extends StatelessWidget {
  const PointsBox({super.key, required this.title, required this.points, this.icons});

  final String title;
  final List<String> points;

  /// An icon for each point; without them each point has a green dot.
  final List<AppIcons>? icons;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(AppWide.of(context) ? 14 : AppRadius.medium)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.label.copyWith(height: 17 / 14)),
          for (var i = 0; i < points.length; i++)
            Padding(
              padding: EdgeInsets.only(top: icons == null ? 8 : 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (icons != null)
                    AppIcon(icons![i])
                  else
                    Padding(
                      padding: const EdgeInsets.only(top: 7),
                      child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.green700, shape: BoxShape.circle)),
                    ),
                  SizedBox(width: icons == null ? 10 : 12),
                  Expanded(child: Text(points[i], style: AppText.body.copyWith(height: icons == null ? 20 / 16 : 24 / 16))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Screen 13, Verify to continue: slides up when someone who is not yet verified tries something that needs it.
/// Returns true when the user chose "Verify now".
Future<bool> showVerifySheet(BuildContext context, {required String title, required String idType}) async {
  final chosen = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    barrierColor: AppColors.ink900.withValues(alpha: 0.55),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large))),
    builder: (sheet) {
      final t = sheet.texts;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: AppColors.infoTint, shape: BoxShape.circle),
                  child: const AppIcon(AppIcons.shieldCheck, color: AppColors.verified),
                ),
              ),
              const SizedBox(height: 16),
              Semantics(header: true, child: Text(title, style: AppText.title.copyWith(height: 27 / 22))),
              const SizedBox(height: 12),
              Text(t.sheetVerifyText(idType), style: AppText.body.copyWith(color: AppColors.ink600, height: 19.5 / 16)),
              const SizedBox(height: 20),
              AppButton(label: t.verifyNow, onPressed: () => Navigator.of(sheet).pop(true)),
              const SizedBox(height: 12),
              AppButton(label: t.notNow, kind: AppButtonKind.text, onPressed: () => Navigator.of(sheet).pop(false)),
            ],
          ),
        ),
      );
    },
  );
  return chosen ?? false;
}
