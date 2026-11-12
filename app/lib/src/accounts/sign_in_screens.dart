import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_client.dart';
import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/chips.dart';
import '../design/fields.dart';
import '../design/notice.dart';
import '../design/screen.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';
import '../session/session.dart';
import 'account_errors.dart';
import 'accounts_api.dart';
import 'sign_up_screens.dart' show ResendCountdown, backToProperties;

/// The phone number or email address being used to sign in or reset a password, carried from one screen to the next.
class SignInContact {
  const SignInContact({required this.byEmail, required this.typed});
  final bool byEmail;
  final String typed;

  Contact toContact(String dialCode) => byEmail ? Contact.email(typed.trim()) : Contact.phone(fullPhone(dialCode, typed));
  String shown(String dialCode) => byEmail ? typed.trim() : maskPhone(dialCode, typed);
}

/// The two chips "Phone number" and "Email", and the field for the one chosen.
class _ContactPicker extends StatelessWidget {
  const _ContactPicker({
    required this.byEmail,
    required this.onByEmail,
    required this.phone,
    required this.email,
    required this.country,
    this.error,
    this.phoneHelper,
    this.emailHelper,
    this.between,
  });

  final bool byEmail;
  final ValueChanged<bool> onByEmail;
  final TextEditingController phone;
  final TextEditingController email;
  final CountryInfo? country;
  final String? error;
  final String? phoneHelper;
  final String? emailHelper;

  /// Shown between the choice and the field, such as the notice that sign-in is paused in the website layout.
  final Widget? between;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Chips on the phone; one bar with two halves on the website.
        if (AppWide.of(context))
          AppSegmented(labels: [t.chipPhone, t.chipEmail], selected: byEmail ? 1 : 0, onChanged: (i) => onByEmail(i == 1))
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              AppFilterChip(label: t.chipPhone, selected: !byEmail, onChanged: (_) => onByEmail(false)),
              AppFilterChip(label: t.chipEmail, selected: byEmail, onChanged: (_) => onByEmail(true)),
            ],
          ),
        const SizedBox(height: 16),
        if (between != null) ...[between!, const SizedBox(height: 16)],
        if (byEmail)
          AppTextField(
            label: t.emailAddress,
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.username, AutofillHints.email],
            error: error,
            helper: emailHelper,
          )
        else
          AppPhoneField(label: t.phoneNumber, dialCode: country?.dialCode ?? '', flag: country?.flag, controller: phone, error: error, helper: phoneHelper),
      ],
    );
  }
}

bool _contactOk(bool byEmail, String phone, String email) =>
    byEmail ? looksLikeEmail(email) : phone.replaceAll(RegExp(r'[^0-9]'), '').length >= 7;

/// Screens 6 and 7, Sign in, and Sign in paused after five wrong passwords in a row.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key, this.passwordChanged = false});

  /// Shows a notice that the password was just changed (after screen 9).
  final bool passwordChanged;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _byEmail = false;
  bool _busy = false;
  bool _paused = false;
  String? _contactError;
  String? _passwordError;
  String? _failure;

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  SignInContact get _who => SignInContact(byEmail: _byEmail, typed: _byEmail ? _email.text : _phone.text);

  bool _checkContact() {
    final t = context.texts;
    final ok = _contactOk(_byEmail, _phone.text, _email.text);
    setState(() => _contactError = ok ? null : (_byEmail ? t.errorEmail : t.errorPhone));
    return ok;
  }

  Future<void> _signIn(CountryInfo country) async {
    final t = context.texts;
    final contactOk = _checkContact();
    setState(() => _passwordError = _password.text.isEmpty ? t.errorPasswordEmpty : null);
    if (!contactOk || _password.text.isEmpty) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final session = await ref.read(accountsApiProvider).signIn(_who.toContact(country.dialCode ?? ''), password: _password.text);
      await ref.read(sessionProvider.notifier).start(session);
      if (mounted) context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (e is ApiException && e.code == 'PASSWORD_LOCKED') {
          _paused = true;
          _passwordError = t.pausedHelper;
        } else {
          _failure = accountErrorText(t, e);
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _codeInstead(CountryInfo country) async {
    if (!_checkContact()) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(accountsApiProvider).sendCode(_who.toContact(country.dialCode ?? ''), 'LOGIN');
      if (mounted) context.push('/sign-in/code', extra: _who);
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final country = ref.watch(controlsProvider).value?.country;
    final ready = !_busy && country != null;
    final wide = AppWide.of(context);
    void close() => context.canPop() ? context.pop() : context.go('/');
    final paused = AppNotice(kind: AppNoticeKind.error, title: t.pausedTitle, message: _byEmail ? t.pausedTextEmail : t.pausedTextPhone);
    final changed = AppNotice(kind: AppNoticeKind.success, title: t.passwordChangedTitle, message: t.passwordChangedText);
    final form = AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ContactPicker(
            byEmail: _byEmail,
            onByEmail: (v) => setState(() {
              _byEmail = v;
              _contactError = null;
            }),
            phone: _phone,
            email: _email,
            country: country,
            error: _contactError,
            phoneHelper: wide ? t.phoneCodeHelper : null,
            between: wide && _paused ? paused : null,
          ),
          const SizedBox(height: 16),
          AppPasswordField(
            label: t.password,
            controller: _password,
            showLabel: t.showPassword,
            hideLabel: t.hidePassword,
            helper: wide ? t.passwordHelper : null,
            error: _passwordError,
            onChanged: (_) {
              if (_passwordError != null && !_paused) setState(() => _passwordError = null);
            },
            onSubmitted: (_) => ready && !_paused ? _signIn(country) : null,
          ),
        ],
      ),
    );
    final forgot = AppLinkButton(
      label: t.forgotPasswordLink,
      alignment: wide ? Alignment.centerRight : Alignment.centerLeft,
      onPressed: () => context.push('/forgot-password', extra: _who),
    );
    final failure = _failure == null ? const <Widget>[] : [AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)];
    final buttons = _paused
        ? [
            AppButton(label: t.getSignInCode, onPressed: ready ? () => _codeInstead(country) : null),
            AppButton(label: t.setNewPassword, kind: AppButtonKind.outline, onPressed: () => context.push('/forgot-password', extra: _who)),
          ]
        : [
            AppButton(label: t.signIn, onPressed: ready ? () => _signIn(country) : null),
            AppButton(label: t.getCodeInstead, kind: AppButtonKind.outline, icon: AppIcons.phone, iconFirst: true, onPressed: ready ? () => _codeInstead(country) : null),
            if (!wide) AppButton(label: t.newHere, kind: AppButtonKind.text, onPressed: () => context.push('/sign-up')),
          ];
    if (wide) {
      // On the website, sign-in is a panel over the dimmed page.
      return AppScreen(
        panel: true,
        onClose: close,
        bottom: buttons,
        footer: _paused ? null : AppFooterLink(words: t.newHereShort, link: t.createAnAccount, onPressed: () => context.push('/sign-up')),
        children: [
          AppPanelHeading(title: t.welcomeBack, intro: t.signInIntroWide, onClose: close),
          const SizedBox(height: 16),
          if (widget.passwordChanged && !_paused && _failure == null) ...[changed, const SizedBox(height: 16)],
          ...failure,
          form,
          if (!_paused) forgot,
          const SizedBox(height: 12),
        ],
      );
    }
    return AppScreen(
      title: t.signIn,
      onBack: close,
      bottom: buttons,
      children: [
        const SizedBox(height: 8),
        AppHeading(t.welcomeBack, intro: _paused ? null : t.signInIntro),
        const SizedBox(height: 16),
        if (_paused) ...[paused, const SizedBox(height: 16)] else if (widget.passwordChanged && _failure == null) ...[changed, const SizedBox(height: 16)],
        ...failure,
        form,
        if (!_paused) ...[const SizedBox(height: 16), forgot],
        const SizedBox(height: 8),
      ],
    );
  }
}

/// Signing in with a code sent by SMS or email. It follows the layout of screen 4 (Enter the code).
class SignInCodeScreen extends ConsumerStatefulWidget {
  const SignInCodeScreen({super.key, required this.who});

  final SignInContact who;

  @override
  ConsumerState<SignInCodeScreen> createState() => _SignInCodeScreenState();
}

class _SignInCodeScreenState extends ConsumerState<SignInCodeScreen> with ResendCountdown {
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

  Future<void> _resend(CountryInfo country) async {
    setState(() => _failure = null);
    try {
      await ref.read(accountsApiProvider).sendCode(widget.who.toContact(country.dialCode ?? ''), 'LOGIN');
      if (mounted) startCountdown();
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    }
  }

  Future<void> _signIn(CountryInfo country) async {
    final t = context.texts;
    if (_code.length != 6) return setState(() => _codeError = t.errorCode);
    setState(() {
      _busy = true;
      _failure = null;
      _codeError = null;
    });
    try {
      final session = await ref.read(accountsApiProvider).signIn(widget.who.toContact(country.dialCode ?? ''), code: _code);
      await ref.read(sessionProvider.notifier).start(session);
      if (mounted) context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        // A wrong code and an unknown account get the same answer from the server, on purpose.
        if (e is ApiException && (e.code == 'WRONG_CREDENTIALS' || e.code == 'INVALID_CODE')) {
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
    final country = ref.watch(controlsProvider).value?.country;
    final shown = widget.who.shown(country?.dialCode ?? '');
    final wide = AppWide.of(context);
    void back() => context.canPop() ? context.pop() : context.go('/sign-in');
    final sent = widget.who.byEmail ? t.codeSentEmail(shown) : t.codeSentSms(shown);
    return AppScreen(
      title: t.signIn,
      onBack: back,
      panel: true,
      onClose: back,
      bottom: [AppButton(label: t.signIn, onPressed: _busy || country == null ? null : () => _signIn(country))],
      children: [
        if (!wide) const SizedBox(height: 8),
        if (wide) AppPanelHeading(title: t.enterTheCode, intro: sent, onClose: back) else AppHeading(t.enterTheCode, intro: sent),
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
        if (secondsLeft <= 0) AppLinkButton(label: t.sendCodeAgain, onPressed: country == null ? null : () => _resend(country)),
      ],
    );
  }
}

/// Screen 8, Forgot password: choose where the code goes.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.start});

  /// What was already typed on the sign-in screen.
  final SignInContact? start;

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  late final _phone = TextEditingController(text: widget.start?.byEmail == false ? widget.start!.typed : '');
  late final _email = TextEditingController(text: widget.start?.byEmail == true ? widget.start!.typed : '');
  late bool _byEmail = widget.start?.byEmail ?? false;
  bool _busy = false;
  String? _contactError;
  String? _failure;

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _send(CountryInfo country) async {
    final t = context.texts;
    if (!_contactOk(_byEmail, _phone.text, _email.text)) return setState(() => _contactError = _byEmail ? t.errorEmail : t.errorPhone);
    final who = SignInContact(byEmail: _byEmail, typed: _byEmail ? _email.text : _phone.text);
    setState(() {
      _busy = true;
      _failure = null;
      _contactError = null;
    });
    try {
      await ref.read(accountsApiProvider).sendCode(who.toContact(country.dialCode ?? ''), 'RESET_PASSWORD');
      if (mounted) context.push('/reset-password', extra: who);
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(t, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final country = ref.watch(controlsProvider).value?.country;
    return AppScreen(
      title: t.resetPassword,
      onBack: () => context.canPop() ? context.pop() : context.go('/sign-in'),
      onBackToProperties: backToProperties(ref),
      footer: AppFooterLink(words: t.rememberedIt, link: t.backToSignIn, onPressed: () => context.canPop() ? context.pop() : context.go('/sign-in')),
      bottom: [AppButton(label: t.sendCode, onPressed: _busy || country == null ? null : () => _send(country))],
      children: [
        if (!AppWide.of(context)) const SizedBox(height: 8),
        AppHeading(t.forgotTitle, intro: t.forgotIntro),
        const SizedBox(height: 16),
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        _ContactPicker(
          byEmail: _byEmail,
          onByEmail: (v) => setState(() {
            _byEmail = v;
            _contactError = null;
          }),
          phone: _phone,
          email: _email,
          country: country,
          error: _contactError,
          phoneHelper: t.codeComesBySms,
          emailHelper: t.codeComesByEmail,
        ),
      ],
    );
  }
}

/// Screen 9, Set a new password: the code and the new password together.
class NewPasswordScreen extends ConsumerStatefulWidget {
  const NewPasswordScreen({super.key, required this.who});

  final SignInContact who;

  @override
  ConsumerState<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends ConsumerState<NewPasswordScreen> with ResendCountdown {
  final _password = TextEditingController();
  String _code = '';
  int _attempt = 0;
  bool _busy = false;
  String? _codeError;
  String? _passwordError;
  String? _failure;

  @override
  void initState() {
    super.initState();
    Future.microtask(startCountdown);
  }

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _resend(CountryInfo country) async {
    setState(() => _failure = null);
    try {
      await ref.read(accountsApiProvider).sendCode(widget.who.toContact(country.dialCode ?? ''), 'RESET_PASSWORD');
      if (mounted) startCountdown();
    } catch (e) {
      if (mounted) setState(() => _failure = accountErrorText(context.texts, e));
    }
  }

  Future<void> _save(CountryInfo country) async {
    final t = context.texts;
    setState(() {
      _codeError = _code.length == 6 ? null : t.errorCode;
      _passwordError = _password.text.length >= 8 ? null : t.errorPassword;
    });
    if (_codeError != null || _passwordError != null) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(accountsApiProvider).resetPassword(widget.who.toContact(country.dialCode ?? ''), code: _code, newPassword: _password.text);
      if (mounted) context.go('/sign-in?changed=1');
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
    final country = ref.watch(controlsProvider).value?.country;
    return AppScreen(
      title: t.resetPassword,
      onBack: () => context.canPop() ? context.pop() : context.go('/forgot-password'),
      onBackToProperties: backToProperties(ref),
      bottom: [AppButton(label: t.saveNewPassword, onPressed: _busy || country == null ? null : () => _save(country))],
      children: [
        if (!AppWide.of(context)) const SizedBox(height: 8),
        AppHeading(t.setNewPassword, intro: t.newPasswordIntro(widget.who.shown(country?.dialCode ?? ''))),
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
        if (secondsLeft <= 0) AppLinkButton(label: t.sendCodeAgain, onPressed: country == null ? null : () => _resend(country)),
        const SizedBox(height: 16),
        AppPasswordField(
          label: t.newPassword,
          controller: _password,
          showLabel: t.showPassword,
          hideLabel: t.hidePassword,
          newPassword: true,
          helper: t.passwordHelper,
          error: _passwordError,
        ),
        const SizedBox(height: 16),
        AppNotice(kind: AppNoticeKind.info, title: t.signedOutEverywhereTitle, message: t.signedOutEverywhereText),
        const SizedBox(height: 16),
      ],
    );
  }
}
