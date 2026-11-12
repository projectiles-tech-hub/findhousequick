import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/choice.dart';
import '../design/fields.dart';
import '../design/notice.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';
import '../listings/listing_collage.dart';
import '../providers.dart';
import '../session/session.dart';
import 'account_errors.dart';
import 'accounts_api.dart';
import 'sign_up_draft.dart';

/// Opens the public website's list of homes: where "Back to properties" in the website header leads.
VoidCallback backToProperties(WidgetRef ref) => () => launchUrl(Uri.parse('${ref.read(appConfigProvider).webUrl}/homes'), webOnlyWindowName: '_self');

/// Screen 2, Who are you: tenant, landlord, agent; more than one may be chosen.
class WhoAreYouScreen extends ConsumerStatefulWidget {
  const WhoAreYouScreen({super.key, this.preselect, this.invitationCode});

  /// From a link on the website, e.g. "landlord".
  final String? preselect;
  final String? invitationCode;

  @override
  ConsumerState<WhoAreYouScreen> createState() => _WhoAreYouScreenState();
}

class _WhoAreYouScreenState extends ConsumerState<WhoAreYouScreen> {
  bool _showError = false;

  @override
  void initState() {
    super.initState();
    final type = widget.preselect?.toUpperCase();
    final code = widget.invitationCode;
    if ((type != null && const {'TENANT', 'LANDLORD', 'AGENT'}.contains(type)) || (code != null && code.isNotEmpty)) {
      Future.microtask(() {
        ref.read(signUpProvider.notifier).update((d) => d.copyWith(
              types: type != null && const {'TENANT', 'LANDLORD', 'AGENT'}.contains(type) && d.types.isEmpty ? {type} : d.types,
              invitationCode: code != null && code.isNotEmpty ? () => code : null,
            ));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final draft = ref.watch(signUpProvider);
    void toggle(String type) {
      final types = {...draft.types};
      types.contains(type) ? types.remove(type) : types.add(type);
      ref.read(signUpProvider.notifier).update((d) => d.copyWith(types: types));
      setState(() => _showError = false);
    }

    final wide = AppWide.of(context);
    final gap = SizedBox(height: wide ? 20 : 16);
    return AppScreen(
      title: t.createAnAccount,
      onBack: () => context.canPop() ? context.pop() : context.go('/'),
      onBackToProperties: backToProperties(ref),
      side: const ListingCollage(),
      footer: AppFooterLink(words: t.alreadyHaveAccount, link: t.signIn, onPressed: () => context.push('/sign-in')),
      bottom: [
        AppButton(
          label: t.continueLabel,
          icon: AppIcons.forward,
          onPressed: () => draft.types.isEmpty ? setState(() => _showError = true) : context.push('/sign-up/details'),
        ),
      ],
      children: [
        if (!wide) const SizedBox(height: 8),
        AppStepProgress(step: 1, total: 3, caption: t.stepAboutYou),
        gap,
        AppHeading(t.whoTitle, intro: wide ? t.whoHintWide : t.whoHint),
        gap,
        _TypeTile(icon: AppIcons.search, title: t.typeTenant, text: t.typeTenantText, selected: draft.types.contains('TENANT'), onTap: () => toggle('TENANT')),
        gap,
        _TypeTile(icon: AppIcons.home, title: t.typeLandlord, text: t.typeLandlordText, selected: draft.types.contains('LANDLORD'), onTap: () => toggle('LANDLORD')),
        gap,
        _TypeTile(icon: AppIcons.person, title: t.typeAgent, text: t.typeAgentText, selected: draft.types.contains('AGENT'), onTap: () => toggle('AGENT')),
        if (_showError) ...[
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(t.errorChooseOne, style: AppText.bodySmall.copyWith(color: AppColors.error))),
        ],
        const SizedBox(height: 16),
      ],
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({required this.icon, required this.title, required this.text, required this.selected, required this.onTap});

  final AppIcons icon;
  final String title;
  final String text;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final wide = AppWide.of(context);
    // Phone: a round tile, white when chosen. Website: a square tile, green with a white icon when chosen.
    final circle = wide ? (selected ? AppColors.green700 : AppColors.background) : (selected ? AppColors.surface : AppColors.green50);
    final ink = wide ? (selected ? AppColors.surface : AppColors.ink600) : AppColors.green700;
    final bold = AppText.subtitle.copyWith(fontSize: 17, height: 23 / 17, fontWeight: FontWeight.w700, fontVariations: const [FontVariation('wght', 700)]);
    return Semantics(
      checked: selected,
      button: true,
      child: Material(
        color: selected ? AppColors.green50 : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(wide ? 16 : AppRadius.medium),
          side: selected ? const BorderSide(color: AppColors.green700, width: 2) : BorderSide(color: wide ? AppColors.divider : AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: wide ? 48 : 44,
                  height: wide ? 48 : 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: circle, borderRadius: BorderRadius.circular(wide ? 14 : 22)),
                  child: AppIcon(icon, color: ink, cut: circle),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: wide ? bold : AppText.subtitle.copyWith(height: 22 / 18)),
                      const SizedBox(height: 2),
                      Text(text, style: wide ? AppText.body.copyWith(fontSize: 15, height: 20 / 15, color: AppColors.ink600) : AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: selected ? AppColors.green700 : AppColors.surface,
                    border: selected ? null : Border.all(color: wide ? AppColors.border : AppColors.ink600, width: 2),
                  ),
                  child: selected ? const AppIcon(AppIcons.check, size: 18, color: AppColors.surface) : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Screen 3, Your details: name, phone, email, password, where the code goes, and consent.
class YourDetailsScreen extends ConsumerStatefulWidget {
  const YourDetailsScreen({super.key});

  @override
  ConsumerState<YourDetailsScreen> createState() => _YourDetailsScreenState();
}

class _YourDetailsScreenState extends ConsumerState<YourDetailsScreen> {
  late final TextEditingController _first, _last, _phone, _email, _password;
  bool _checked = false;
  bool _busy = false;
  String? _failure;

  @override
  void initState() {
    super.initState();
    final d = ref.read(signUpProvider);
    _first = TextEditingController(text: d.firstName);
    _last = TextEditingController(text: d.lastName);
    _phone = TextEditingController(text: d.phone);
    _email = TextEditingController(text: d.email);
    _password = TextEditingController(text: d.password);
  }

  @override
  void dispose() {
    for (final c in [_first, _last, _phone, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _phoneOk => _phone.text.replaceAll(RegExp(r'[^0-9]'), '').length >= 7;

  Future<void> _send(CountryInfo country) async {
    final notifier = ref.read(signUpProvider.notifier);
    notifier.update((d) => d.copyWith(
          firstName: _first.text.trim(),
          lastName: _last.text.trim(),
          phone: _phone.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
        ));
    final d = ref.read(signUpProvider);
    setState(() => _checked = true);
    if (d.firstName.isEmpty || d.lastName.isEmpty || !_phoneOk || !looksLikeEmail(d.email) || d.password.length < 8 || !d.agreed) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final to = d.codeByEmail ? Contact.email(d.email) : Contact.phone(fullPhone(country.dialCode ?? '', d.phone));
      await ref.read(accountsApiProvider).sendCode(to, 'REGISTER');
      if (mounted) context.push('/sign-up/code');
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final draft = ref.watch(signUpProvider);
    final country = ref.watch(controlsProvider).value?.country;
    final notifier = ref.read(signUpProvider.notifier);
    final web = ref.watch(appConfigProvider).webUrl;
    final link = AppText.body.copyWith(color: AppColors.green700, fontWeight: FontWeight.w500, decoration: TextDecoration.underline);
    TapGestureRecognizer open(String path) => TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('$web$path'), mode: LaunchMode.externalApplication);
    final wide = AppWide.of(context);
    final gap = SizedBox(height: wide ? 20 : 16);
    final firstName = AppTextField(
      label: t.firstName,
      controller: _first,
      helper: wide ? t.asOnYourId : null,
      error: _checked && _first.text.trim().isEmpty ? t.errorFirstName : null,
      autofillHints: const [AutofillHints.givenName],
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
    );
    final surname = AppTextField(
      label: t.surname,
      controller: _last,
      helper: wide ? t.asOnYourId : null,
      error: _checked && _last.text.trim().isEmpty ? t.errorSurname : null,
      autofillHints: const [AutofillHints.familyName],
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
    );
    final smsChoice = AppRadio<bool>(label: t.sendBySms, value: false, groupValue: draft.codeByEmail, onChanged: (v) => notifier.update((d) => d.copyWith(codeByEmail: v)));
    final emailChoice = AppRadio<bool>(label: t.sendByEmail, value: true, groupValue: draft.codeByEmail, onChanged: (v) => notifier.update((d) => d.copyWith(codeByEmail: v)));
    final consent = AppCheckbox(
      label: '${t.consentBefore}${t.consentTerms}${t.consentBetween}${t.consentPrivacy}${t.consentAfter}',
      value: draft.agreed,
      onChanged: (v) => notifier.update((d) => d.copyWith(agreed: v)),
      rich: TextSpan(
        style: wide ? AppText.body.copyWith(fontSize: 15, height: 19.5 / 15) : AppText.body.copyWith(height: 19.5 / 16),
        children: [
          TextSpan(text: t.consentBefore),
          TextSpan(text: t.consentTerms, style: link, recognizer: open('/terms')),
          TextSpan(text: t.consentBetween),
          TextSpan(text: t.consentPrivacy, style: link, recognizer: open('/privacy')),
          TextSpan(text: t.consentAfter),
        ],
      ),
    );
    return AppScreen(
      title: t.createAnAccount,
      onBack: () => context.canPop() ? context.pop() : context.go('/sign-up'),
      onBackToProperties: backToProperties(ref),
      side: const ListingCollage(),
      footer: AppFooterLink(words: t.alreadyHaveAccount, link: t.signIn, onPressed: () => context.push('/sign-in')),
      bottom: [AppButton(label: t.sendCode, icon: AppIcons.forward, onPressed: _busy || country == null ? null : () => _send(country))],
      children: [
        if (!wide) const SizedBox(height: 8),
        AppStepProgress(step: 2, total: 3, caption: t.stepYourDetails),
        gap,
        AppHeading(t.detailsTitle, intro: t.detailsIntro),
        gap,
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Side by side on the website, one under the other on the phone.
              if (wide)
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: firstName), const SizedBox(width: 12), Expanded(child: surname)])
              else ...[firstName, gap, surname],
              gap,
              AppPhoneField(
                label: t.phoneNumber,
                dialCode: country?.dialCode ?? '',
                flag: country?.flag,
                controller: _phone,
                helper: t.phoneHelper,
                error: _checked && !_phoneOk ? t.errorPhone : null,
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: t.emailAddress,
                controller: _email,
                helper: t.emailHelper,
                error: _checked && !looksLikeEmail(_email.text) ? t.errorEmail : null,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 16),
              AppPasswordField(
                label: t.password,
                controller: _password,
                showLabel: t.showPassword,
                hideLabel: t.hidePassword,
                newPassword: true,
                helper: t.passwordHelper,
                error: _checked && _password.text.length < 8 ? t.errorPassword : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(t.sendCodeBy, style: AppText.label.copyWith(height: 17 / 14)),
        const SizedBox(height: 4),
        if (wide) Row(children: [Flexible(child: smsChoice), const SizedBox(width: 24), Flexible(child: emailChoice)]) else ...[smsChoice, emailChoice],
        const SizedBox(height: 4),
        Text(t.confirmOtherAfter, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
        const SizedBox(height: 16),
        // On the website the agreement sits in a tinted box.
        if (wide)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(14)),
            child: consent,
          )
        else
          consent,
        if (_checked && !draft.agreed) ...[
          const SizedBox(height: 4),
          Semantics(liveRegion: true, child: Text(t.errorConsent, style: AppText.bodySmall.copyWith(color: AppColors.error))),
        ],
        const SizedBox(height: 8),
      ],
    );
  }
}

/// Counts down the wait before another code may be asked for (the server allows one a minute).
mixin ResendCountdown<T extends StatefulWidget> on State<T> {
  Timer? _timer;
  int secondsLeft = 0;

  void startCountdown([int seconds = 60]) {
    _timer?.cancel();
    setState(() => secondsLeft = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => secondsLeft -= 1);
      if (secondsLeft <= 0) timer.cancel();
    });
  }

  String get countdownText => '${secondsLeft ~/ 60}:${(secondsLeft % 60).toString().padLeft(2, '0')}';

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

/// Screen 4, Enter the code: the last step of sign-up. Creates the account and signs the user in.
class SignUpCodeScreen extends ConsumerStatefulWidget {
  const SignUpCodeScreen({super.key});

  @override
  ConsumerState<SignUpCodeScreen> createState() => _SignUpCodeScreenState();
}

class _SignUpCodeScreenState extends ConsumerState<SignUpCodeScreen> with ResendCountdown {
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

  Contact _target(SignUpDraft d, CountryInfo country) => d.codeByEmail ? Contact.email(d.email) : Contact.phone(fullPhone(country.dialCode ?? '', d.phone));

  Future<void> _resend(CountryInfo country, {bool switchChannel = false}) async {
    if (switchChannel) ref.read(signUpProvider.notifier).update((d) => d.copyWith(codeByEmail: !d.codeByEmail));
    setState(() {
      _failure = null;
      _codeError = null;
    });
    try {
      await ref.read(accountsApiProvider).sendCode(_target(ref.read(signUpProvider), country), 'REGISTER');
      if (mounted) startCountdown();
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    }
  }

  Future<void> _create(CountryInfo country) async {
    final t = context.texts;
    if (_code.length != 6) return setState(() => _codeError = t.errorCode);
    final d = ref.read(signUpProvider);
    setState(() {
      _busy = true;
      _failure = null;
      _codeError = null;
    });
    try {
      final language = Localizations.localeOf(context).languageCode;
      final session = await ref.read(accountsApiProvider).register(
            phone: fullPhone(country.dialCode ?? '', d.phone),
            email: d.email,
            codeSentTo: _target(d, country),
            code: _code,
            password: d.password,
            firstName: d.firstName,
            lastName: d.lastName,
            countryCode: country.code,
            types: d.types.toList(),
            language: country.languages.contains(language) ? language : country.defaultLanguage,
            termsVersion: country.termsVersion,
            privacyVersion: country.privacyVersion,
            invitationCode: d.invitationCode,
          );
      await ref.read(sessionProvider.notifier).start(session);
      final confirmNext = d.codeByEmail ? 'phone' : 'email';
      ref.read(signUpProvider.notifier).clear();
      if (mounted) context.go('/confirm/$confirmNext?new=1');
    } catch (e) {
      if (!mounted) return;
      final reason = e is ApiException ? e.code : null;
      // A refused invitation does not stop sign-up: the code is dropped, so pressing the button again works.
      if (reason == 'INVALID_INVITATION') ref.read(signUpProvider.notifier).update((d) => d.copyWith(invitationCode: () => null));
      setState(() {
        if (reason == 'INVALID_CODE') {
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
    final d = ref.watch(signUpProvider);
    final country = ref.watch(controlsProvider).value?.country;
    final sentTo = d.codeByEmail ? t.codeSentEmail(d.email) : t.codeSentSms(maskPhone(country?.dialCode ?? '', d.phone));
    final wide = AppWide.of(context);
    final gap = SizedBox(height: wide ? 20 : 16);
    final change = AppLinkButton(
      label: d.codeByEmail ? t.wrongEmailChange : t.wrongNumberChange,
      onPressed: () => context.canPop() ? context.pop() : context.go('/sign-up/details'),
    );
    final other = AppLinkButton(
      label: wide ? (d.codeByEmail ? t.sendBySmsInsteadShort : t.sendByEmailInsteadShort) : (d.codeByEmail ? t.sendBySmsInstead : t.sendByEmailInstead),
      alignment: wide ? Alignment.centerRight : Alignment.centerLeft,
      onPressed: country == null ? null : () => _resend(country, switchChannel: true),
    );
    return AppScreen(
      title: t.createAnAccount,
      onBack: () => context.canPop() ? context.pop() : context.go('/sign-up/details'),
      onBackToProperties: backToProperties(ref),
      side: const ListingCollage(),
      bottom: [AppButton(label: t.createMyAccount, icon: AppIcons.forward, onPressed: _busy || country == null ? null : () => _create(country))],
      children: [
        if (!wide) const SizedBox(height: 8),
        AppStepProgress(step: 3, total: 3, caption: d.codeByEmail ? t.stepConfirmEmail : t.stepConfirmPhone),
        gap,
        if (wide) ...[AppIconTile(d.codeByEmail ? AppIcons.mail : AppIcons.phone), gap],
        AppHeading(t.enterTheCode, intro: sentTo),
        gap,
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        AppCodeField(
          // A new field after the channel changes, so an old code is not left in the boxes.
          key: ValueKey('${d.codeByEmail} $_attempt'),
          label: t.code,
          autofocus: true,
          error: _codeError,
          helper: secondsLeft > 0 ? t.sendAgainIn(countdownText) : null,
          onChanged: (v) => setState(() {
            _code = v;
            _codeError = null;
          }),
        ),
        if (secondsLeft <= 0) AppLinkButton(label: t.sendCodeAgain, onPressed: country == null ? null : () => _resend(country)),
        gap,
        if (wide) Row(children: [Expanded(child: change), Expanded(child: other)]) else ...[change, other],
        if (wide) const SizedBox(height: 12),
      ],
    );
  }
}
