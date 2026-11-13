import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_client.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/fields.dart';
import '../design/notice.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';
import '../session/session.dart';
import 'account_errors.dart';
import 'accounts_api.dart';
import 'sign_up_screens.dart' show ResendCountdown, backToProperties;

/// Screen 5, Confirm your email: shown straight after sign-up. When the sign-up code went by email, it asks for
/// the phone number to be confirmed instead, with the same layout.
class ConfirmContactScreen extends ConsumerStatefulWidget {
  const ConfirmContactScreen({super.key, required this.phone, this.justCreated = false});

  /// True to confirm the phone number; false for the email address.
  final bool phone;
  final bool justCreated;

  @override
  ConsumerState<ConfirmContactScreen> createState() => _ConfirmContactScreenState();
}

class _ConfirmContactScreenState extends ConsumerState<ConfirmContactScreen> {
  bool _busy = false;
  String? _failure;

  Future<void> _send(Me me) async {
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(accountsApiProvider).sendContactCode(widget.phone ? Contact.phone(me.phone ?? '') : Contact.email(me.email ?? ''));
      if (mounted) context.push('/confirm/${widget.phone ? 'phone' : 'email'}/code');
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'ALREADY_CONFIRMED') {
        await ref.read(sessionProvider.notifier).reload();
        if (mounted) context.go('/home');
      } else {
        setState(() => _failure = accountErrorText(context.texts, e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final me = ref.watch(sessionProvider).value?.me;
    final value = (widget.phone ? me?.phone : me?.email) ?? '';
    final wide = AppWide.of(context);
    final heading = AppHeading(
      widget.justCreated ? t.welcomeReady(me?.firstName ?? '') : (widget.phone ? t.confirmYourPhone : t.confirmYourEmail),
      intro: widget.phone ? t.confirmPhoneIntro : t.confirmEmailIntro,
    );
    final send = AppButton(
      label: widget.phone ? t.sendCodeToPhone : t.sendCodeToEmail,
      icon: widget.phone ? AppIcons.phone : AppIcons.mail,
      iconFirst: true,
      onPressed: _busy || me == null ? null : () => _send(me),
    );
    final failure = _failure == null ? const <Widget>[] : [AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)];
    if (wide) {
      final w600 = AppText.label.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 19 / 14);
      return AppScreen(
        onBackToProperties: backToProperties(ref),
        side: _NextSteps(phone: widget.phone),
        bottom: [send],
        footer: AppFooterLink(link: t.doItLater, onPressed: () => context.go('/home')),
        children: [
          Row(
            children: [
              const AppIconTile(AppIcons.check, solid: true),
              const SizedBox(width: 14),
              if (widget.justCreated)
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 7, 14, 6),
                  decoration: BoxDecoration(color: AppColors.green50, borderRadius: BorderRadius.circular(20)),
                  child: Text(t.accountCreated, style: w600.copyWith(color: AppColors.green700)),
                ),
            ],
          ),
          const SizedBox(height: 20),
          heading,
          const SizedBox(height: 20),
          Text(widget.phone ? t.phoneNumber : t.emailAddress, style: w600),
          const SizedBox(height: 6),
          Container(
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(
              children: [
                Expanded(child: Text(value, style: AppText.body.copyWith(height: 21 / 16))),
                AppIcon(widget.phone ? AppIcons.phone : AppIcons.mail, color: AppColors.ink600),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ...failure,
          AppNotice(kind: AppNoticeKind.info, title: t.untilThenTitle, message: t.untilThenText, icon: AppIcons.eye),
          const SizedBox(height: 20),
        ],
      );
    }
    return AppScreen(
      bottom: [
        send,
        AppButton(label: t.doItLater, kind: AppButtonKind.text, onPressed: () => context.go('/home')),
      ],
      children: [
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: AppColors.successTint, shape: BoxShape.circle),
            child: const AppIcon(AppIcons.check, color: AppColors.success),
          ),
        ),
        const SizedBox(height: 16),
        heading,
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.medium),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
                child: AppIcon(widget.phone ? AppIcons.phone : AppIcons.mail, color: AppColors.green700, cut: AppColors.green50),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.phone ? t.phoneNumber : t.emailAddress, style: AppText.label.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    const SizedBox(height: 2),
                    Text(value, style: AppText.body.copyWith(height: 20 / 16)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...failure,
        AppNotice(kind: AppNoticeKind.info, title: t.untilThenTitle, message: t.untilThenText),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// The dark panel beside the card on the website: what the user can do next, with this step marked.
class _NextSteps extends StatelessWidget {
  const _NextSteps({required this.phone});

  final bool phone;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    Widget row(AppIcons icon, String title, String text, {bool here = false}) => Container(
          margin: const EdgeInsets.only(top: 14),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.ink600, borderRadius: BorderRadius.circular(16)),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: here ? AppColors.green700 : AppColors.ink500, borderRadius: BorderRadius.circular(12)),
                child: AppIcon(icon, color: AppColors.surface, cut: here ? AppColors.green700 : AppColors.ink500),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.body.copyWith(color: AppColors.surface, fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 21 / 16)),
                    const SizedBox(height: 2),
                    Text(text, style: AppText.bodySmall.copyWith(color: AppColors.divider, height: 19 / 14)),
                  ],
                ),
              ),
            ],
          ),
        );
    return Container(
      width: 400,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(color: AppColors.ink900, borderRadius: BorderRadius.circular(28)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t.nextTitle, style: AppText.title.copyWith(color: AppColors.surface, height: 29 / 22)),
          row(phone ? AppIcons.phone : AppIcons.mail, phone ? t.nextConfirmPhone : t.nextConfirmEmail, t.nextYouAreHere, here: true),
          row(AppIcons.heart, t.nextSave, t.nextSaveText),
          row(AppIcons.bell, t.nextAlerts, t.nextAlertsText),
          row(AppIcons.shieldCheck, t.nextVerify, phone ? t.nextVerifyTextPhone : t.nextVerifyTextEmail),
        ],
      ),
    );
  }
}

/// The code step of confirming a phone number or email address. It follows the layout of screen 4 (Enter the
/// code) without the sign-up steps.
class ConfirmContactCodeScreen extends ConsumerStatefulWidget {
  const ConfirmContactCodeScreen({super.key, required this.phone});

  final bool phone;

  @override
  ConsumerState<ConfirmContactCodeScreen> createState() => _ConfirmContactCodeScreenState();
}

class _ConfirmContactCodeScreenState extends ConsumerState<ConfirmContactCodeScreen> with ResendCountdown {
  String _code = '';
  int _attempt = 0;
  bool _busy = false;
  String? _codeError;
  String? _failure;

  @override
  void initState() {
    super.initState();
    Future.microtask(startCountdown);
  }

  Contact _contact(Me me) => widget.phone ? Contact.phone(me.phone ?? '') : Contact.email(me.email ?? '');

  Future<void> _resend(Me me) async {
    setState(() => _failure = null);
    try {
      await ref.read(accountsApiProvider).sendContactCode(_contact(me));
      if (mounted) startCountdown();
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    }
  }

  Future<void> _confirm(Me me) async {
    final t = context.texts;
    if (_code.length != 6) return setState(() => _codeError = t.errorCode);
    setState(() {
      _busy = true;
      _failure = null;
      _codeError = null;
    });
    try {
      await ref.read(accountsApiProvider).confirmContact(_contact(me), _code);
      await ref.read(sessionProvider.notifier).reload();
      if (mounted) context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (e is ApiException && e.code == 'INVALID_CODE') {
          _codeError = t.errorInvalidCode;
          // Empty the boxes and put the cursor back in them, ready for another try.
          _code = '';
          _attempt++;
        } else {
          _failure = accountErrorText(t, e);
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final me = ref.watch(sessionProvider).value?.me;
    final sentTo = widget.phone ? t.codeSentSms(me?.phone ?? '') : t.codeSentEmail(me?.email ?? '');
    return AppScreen(
      title: widget.phone ? t.confirmYourPhone : t.confirmYourEmail,
      onBack: () => context.canPop() ? context.pop() : context.go('/home'),
      onBackToProperties: backToProperties(ref),
      bottom: [AppButton(label: t.confirm, onPressed: _busy || me == null ? null : () => _confirm(me))],
      children: [
        if (AppWide.of(context)) ...[AppIconTile(widget.phone ? AppIcons.phone : AppIcons.mail), const SizedBox(height: 20)] else const SizedBox(height: 8),
        AppHeading(t.enterTheCode, intro: sentTo),
        const SizedBox(height: 16),
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        AppCodeField(
          key: ValueKey(_attempt),
          label: t.code,
          autofocus: true,
          error: _codeError,
          helper: secondsLeft > 0 ? t.sendAgainIn(countdownText) : null,
          onChanged: (v) => setState(() {
            _code = v;
            _codeError = null;
          }),
        ),
        if (secondsLeft <= 0) AppLinkButton(label: t.sendCodeAgain, onPressed: me == null ? null : () => _resend(me)),
      ],
    );
  }
}
