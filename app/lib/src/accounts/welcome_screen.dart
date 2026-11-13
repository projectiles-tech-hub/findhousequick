import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/choice.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../l10n/languages.dart';
import '../l10n/locale.dart';

String languageName(AppTexts t, String code) => switch (code) { 'en' => t.languageEn, 'pcm' => t.languagePcm, _ => code };

/// Screen 1, Welcome: what the platform is, and the three ways in.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final languages = ref.watch(controlsProvider).value?.country?.languages ?? const <String>[];
    final current = Localizations.localeOf(context).languageCode;
    Widget reason(AppIcons icon, String title, String text) => Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
                child: AppIcon(icon, color: AppColors.green700, cut: AppColors.green50),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.label.copyWith(height: 17 / 14)),
                    const SizedBox(height: 2),
                    Text(text, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                  ],
                ),
              ),
            ],
          ),
        );
    return AppScreen(
      top: SizedBox(
        height: 56,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppColors.green700, borderRadius: BorderRadius.circular(8)),
                // In the logo the home icon is all one colour: its door is not cut out.
                child: const AppIcon(AppIcons.homeFilled, color: AppColors.surface, cut: AppColors.surface),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(t.appName, style: AppText.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (languages.length > 1) _LanguageButton(languages: languages, current: current),
            ],
          ),
        ),
      ),
      bottom: [
        AppButton(label: t.createAnAccount, onPressed: () => context.push('/sign-up')),
        AppButton(label: t.signIn, kind: AppButtonKind.outline, onPressed: () => context.push('/sign-in')),
        AppButton(label: t.lookAroundFirst, kind: AppButtonKind.text, onPressed: () => context.go('/home')),
      ],
      children: [
        const SizedBox(height: 24),
        Semantics(header: true, child: Text(t.welcomeHeadline, style: AppText.display.copyWith(height: 34 / 28))),
        const SizedBox(height: 20),
        Text(t.welcomeIntro, style: AppText.body.copyWith(color: AppColors.ink600, height: 19.5 / 16)),
        const SizedBox(height: 20),
        reason(AppIcons.shieldCheck, t.welcomeReason1Title, t.welcomeReason1Text),
        reason(AppIcons.location, t.welcomeReason2Title, t.welcomeReason2Text),
        reason(AppIcons.chat, t.welcomeReason3Title, t.welcomeReason3Text),
      ],
    );
  }
}

class _LanguageButton extends ConsumerWidget {
  const _LanguageButton({required this.languages, required this.current});

  final List<String> languages;
  final String current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    return Semantics(
      button: true,
      label: '${t.language}: ${languageName(t, current)}',
      child: Material(
        color: AppColors.surface,
        shape: const StadiumBorder(side: BorderSide(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => showModalBottomSheet<void>(
            context: context,
            backgroundColor: AppColors.surface,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large))),
            builder: (sheet) => SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.language, style: AppText.subtitle),
                    const SizedBox(height: 8),
                    for (final code in languages)
                      AppRadio<String>(
                        label: languageName(t, code),
                        value: code,
                        groupValue: current,
                        onChanged: (v) {
                          ref.read(localeProvider.notifier).choose(v);
                          Navigator.of(sheet).pop();
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
          // 40 high as drawn; the row it sits in gives it a 48 tap area.
          child: ExcludeSemantics(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const AppIcon(AppIcons.globe),
                  const SizedBox(width: 4),
                  Text(languageName(t, current), style: AppText.label.copyWith(height: 17 / 14)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
