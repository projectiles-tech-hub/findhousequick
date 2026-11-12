import 'dart:async';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../accounts/account_errors.dart';
import '../accounts/sign_up_screens.dart' show backToProperties;
import '../api/api_client.dart';
import '../controls/controls.dart';
import '../design/app_icon.dart';
import '../design/buttons.dart';
import '../design/chips.dart';
import '../design/choice.dart';
import '../design/fields.dart';
import '../design/notice.dart';
import '../design/screen.dart';
import '../design/tokens.dart';
import '../design/wide.dart';
import '../l10n/languages.dart';
import '../providers.dart';
import '../session/session.dart';
import 'verification_api.dart';
import 'verification_parts.dart';

String _kinds(AppTexts t, List<String> types) {
  final names = [
    if (types.contains('TENANT')) t.typeTenant,
    if (types.contains('LANDLORD')) t.typeLandlord,
    if (types.contains('AGENT')) t.typeAgent,
  ];
  return names.isEmpty ? t.typeTenant : names.join(', ');
}

String _verificationError(AppTexts t, Object e) {
  if (e is ApiException) {
    switch (e.code) {
      case 'TOO_MANY_CHECKS':
        return t.errorTooManyChecks;
      case 'IDENTITY_PROVIDER_UNAVAILABLE':
        return t.errorProviderDown;
      case 'IDENTITY_CHECK_UNAVAILABLE':
        return '${t.identityUnavailableTitle}. ${t.identityUnavailableText}';
    }
  }
  return accountErrorText(t, e);
}

/// The user's newest identity check, for the hub; empty when none was started.
final latestCheckProvider = FutureProvider.autoDispose<IdentityCheck?>((ref) => ref.watch(verificationApiProvider).latestCheck());

/// Screen 12, Your verification: the three levels, which are done, and what comes next.
class VerificationHubScreen extends ConsumerWidget {
  const VerificationHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.texts;
    final me = ref.watch(sessionProvider).value?.me;
    final country = ref.watch(controlsProvider).value?.country;
    final check = ref.watch(latestCheckProvider).value;
    final level = me?.verificationLevel ?? 0;
    final lister = me?.listsProperties ?? false;
    final idType = country?.acceptedIdTypes.firstOrNull ?? '';
    final open = check != null && !check.passed && (check.pending || check.withTeam || check.wantsDocument);
    Widget? level1Button;
    if (me != null && level < 1) {
      final phone = !me.phoneConfirmed;
      level1Button = AppButton(label: phone ? t.confirmYourPhone : t.confirmYourEmail, onPressed: () => context.push('/confirm/${phone ? 'phone' : 'email'}'));
    }
    return AppScreen(
      title: t.verification,
      onBack: () => context.canPop() ? context.pop() : context.go('/home'),
      onBackToProperties: backToProperties(ref),
      children: [
        if (!AppWide.of(context)) const SizedBox(height: 8),
        AppHeading(t.yourVerification, intro: t.accountKindIntro(_kinds(t, me?.types ?? const []))),
        const SizedBox(height: 16),
        _LevelCard(number: 1, title: t.level1Title, text: t.level1Text, unlocks: t.level1Unlocks, state: level >= 1 ? _LevelState.done : _LevelState.next, button: level1Button),
        const SizedBox(height: 12),
        _LevelCard(
          number: 2,
          title: t.level2Title,
          text: t.level2Text(idType),
          unlocks: lister ? t.level2UnlocksLister : t.level2UnlocksTenant,
          state: level >= 2 ? _LevelState.done : (level == 1 ? (open && !check.pending ? _LevelState.waiting : _LevelState.next) : _LevelState.later),
          button: level != 1
              ? null
              : open
                  ? AppButton(label: t.seeMyCheck, kind: AppButtonKind.outline, onPressed: () => context.push('/verification/check/${check.id}'))
                  : AppButton(label: t.verifyMyIdentity, onPressed: () => context.push('/verification/identity')),
        ),
        const SizedBox(height: 12),
        _LevelCard(
          number: 3,
          title: t.level3Title,
          text: t.level3Text,
          unlocks: lister ? t.level3UnlocksLister : t.level3UnlocksTenant,
          state: level >= 3 ? _LevelState.done : _LevelState.later,
        ),
        if (me != null && me.types.contains('AGENT') && level >= 2) ...[
          const SizedBox(height: 16),
          AppButton(label: t.companyDetails, kind: AppButtonKind.outline, onPressed: () => context.push('/verification/company')),
        ],
        const SizedBox(height: 16),
      ],
    );
  }
}

enum _LevelState { done, next, waiting, later }

class _LevelCard extends StatelessWidget {
  const _LevelCard({required this.number, required this.title, required this.text, required this.unlocks, required this.state, this.button});

  final int number;
  final String title;
  final String text;
  final String unlocks;
  final _LevelState state;
  final Widget? button;

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final current = state == _LevelState.next || state == _LevelState.waiting;
    final (circle, ink) = switch (state) {
      _LevelState.done => (AppColors.success, AppColors.surface),
      _LevelState.later => (AppColors.divider, AppColors.ink600),
      _ => (AppColors.green700, AppColors.surface),
    };
    final tag = switch (state) {
      _LevelState.done => AppTag(label: t.tagDone, kind: AppTagKind.approved),
      _LevelState.next => AppTag(label: t.tagNext, kind: AppTagKind.waiting),
      _LevelState.waiting => AppTag(label: t.tagWaiting, kind: AppTagKind.waiting),
      _LevelState.later => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(AppRadius.small)),
          child: Text(t.tagLater, style: AppText.label.copyWith(color: AppColors.ink600)),
        ),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.medium),
        border: current ? Border.all(color: AppColors.green700, width: 2) : Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: circle, shape: BoxShape.circle),
                child: state == _LevelState.done ? AppIcon(AppIcons.check, color: ink) : Text('$number', style: AppText.label.copyWith(color: ink)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.subtitle.copyWith(height: 22 / 18)),
                    Text(text, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // The tag keeps its own width, up to a limit; longer words (as in another language) wrap inside it.
              ConstrainedBox(constraints: const BoxConstraints(maxWidth: 124), child: tag),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIcon(state == _LevelState.done ? AppIcons.check : AppIcons.plus, size: 20, color: AppColors.ink600),
              const SizedBox(width: 8),
              Expanded(child: Text(unlocks, style: AppText.bodySmall.copyWith(height: 17 / 14))),
            ],
          ),
          if (button != null) ...[const SizedBox(height: 10), button!],
        ],
      ),
    );
  }
}

/// Screen 14, Verify your identity: the ID number, what to expect from the face check, and consent.
class VerifyIdentityScreen extends ConsumerStatefulWidget {
  const VerifyIdentityScreen({super.key});

  @override
  ConsumerState<VerifyIdentityScreen> createState() => _VerifyIdentityScreenState();
}

class _VerifyIdentityScreenState extends ConsumerState<VerifyIdentityScreen> {
  final _number = TextEditingController();
  bool _agreed = false;
  bool _checked = false;
  bool _busy = false;
  String? _failure;
  String? _numberError;

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  Future<void> _start(CountryInfo country, String idType) async {
    final t = context.texts;
    final ok = idNumberLooksRight(_number.text, country.idNumberPattern(idType));
    setState(() {
      _checked = true;
      _numberError = ok ? null : t.errorIdNumber;
    });
    if (!ok || !_agreed) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final check = await ref.read(verificationApiProvider).startCheck(idType: idType, idNumber: _number.text.trim());
      // The camera step (screen 15) belongs to the identity partner's own component, which opens here once a
      // partner is connected. Until then the app goes straight to waiting for the result.
      if (mounted) context.pushReplacement('/verification/check/${check.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      final held = e.details?['check'];
      if ((e.code == 'ID_ALREADY_LINKED' || e.code == 'CHECK_UNDER_REVIEW') && held is Map && held['id'] is String) {
        context.pushReplacement('/verification/check/${held['id']}');
      } else if (e.code == 'ALREADY_VERIFIED') {
        await ref.read(sessionProvider.notifier).reload();
        if (mounted) context.go('/verification');
      } else if (e.code == 'INVALID_ID_NUMBER') {
        setState(() => _numberError = t.errorIdNumber);
      } else {
        setState(() => _failure = _verificationError(t, e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final country = ref.watch(controlsProvider).value?.country;
    final idType = country?.acceptedIdTypes.firstOrNull;
    final available = country != null && country.identityCheckAvailable && idType != null;
    final wide = AppWide.of(context);
    void back() => context.canPop() ? context.pop() : context.go('/verification');
    if (country != null && !available) {
      return AppScreen(
        title: t.verifyYourIdentity,
        onBack: back,
        onBackToProperties: backToProperties(ref),
        bottom: [AppButton(label: t.keepLookingAround, kind: AppButtonKind.outline, onPressed: () => context.go('/home'))],
        children: [
          SizedBox(height: wide ? 0 : 32),
          const ResultIcon(AppIcons.shieldCheck, tint: AppColors.infoTint, ink: AppColors.verified),
          const SizedBox(height: 16),
          AppHeading(t.identityUnavailableTitle, intro: t.identityUnavailableText),
          const SizedBox(height: 16),
        ],
      );
    }
    final type = idType ?? '';
    return AppScreen(
      title: t.verifyYourIdentity,
      onBack: back,
      onBackToProperties: backToProperties(ref),
      bottom: [AppButton(label: t.continueToFaceCheck, icon: AppIcons.forward, onPressed: _busy || !available ? null : () => _start(country, type))],
      children: [
        if (!wide) const SizedBox(height: 8),
        const AppStepProgress(step: 1, total: 2),
        const SizedBox(height: 16),
        AppHeading(t.yourId(type), intro: t.verifyIntro),
        const SizedBox(height: 16),
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        AppTextField(
          label: type == 'NIN' ? t.idLabelNin : t.idLabelOther(type),
          controller: _number,
          helper: type == 'NIN' ? t.idHelperNin : t.idHelperOther,
          error: _numberError,
          keyboardType: type == 'NIN' ? TextInputType.number : TextInputType.text,
          onChanged: (_) {
            if (_numberError != null) setState(() => _numberError = null);
          },
        ),
        const SizedBox(height: 16),
        PointsBox(title: t.forTheFaceCheck, points: [t.tipGoodLight, t.tipNoCap, t.tipEyeLevel], icons: const [AppIcons.eye, AppIcons.person, AppIcons.camera]),
        const SizedBox(height: 16),
        AppCheckbox(label: t.identityConsent(type), value: _agreed, onChanged: (v) => setState(() => _agreed = v), rich: TextSpan(text: t.identityConsent(type), style: AppText.body.copyWith(height: 19.5 / 16))),
        if (_checked && !_agreed) ...[
          const SizedBox(height: 4),
          Semantics(liveRegion: true, child: Text(t.errorIdentityConsent, style: AppText.bodySmall.copyWith(color: AppColors.error))),
        ],
        const SizedBox(height: 8),
      ],
    );
  }
}

/// Screens 16 to 20: what the check is doing and how it ended. One address shows whichever of them matches the
/// check's state on the server, so coming back later, or reloading the page, always shows the truth:
/// Checking (16), You're verified (17), The face check didn't work (18), Add an ID document (19) and
/// With our verification team (20).
class IdentityCheckScreen extends ConsumerStatefulWidget {
  const IdentityCheckScreen({super.key, required this.checkId});

  final String checkId;

  @override
  ConsumerState<IdentityCheckScreen> createState() => _IdentityCheckScreenState();
}

class _IdentityCheckScreenState extends ConsumerState<IdentityCheckScreen> {
  IdentityCheck? _check;
  Timer? _timer;
  String? _failure;
  int _asked = 0;

  // The document form (screen 19).
  List<DocumentType>? _types;
  String? _type;
  Uint8List? _photo;
  String? _photoType;
  bool _sending = false;
  bool _formChecked = false;
  late final String _uploadKey = 'id-doc-${widget.checkId}-${DateTime.now().microsecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final check = await ref.read(verificationApiProvider).check(widget.checkId);
      if (!mounted) return;
      setState(() {
        _check = check;
        _failure = null;
      });
      if (check.passed) await ref.read(sessionProvider.notifier).reload();
      if (check.wantsDocument && _types == null) unawaited(_loadTypes());
      // While it is still being checked, ask again: every 4 seconds at first, then every 15.
      _timer?.cancel();
      if (check.pending && mounted) _timer = Timer(Duration(seconds: ++_asked <= 15 ? 4 : 15), _load);
    } catch (e) {
      if (!mounted) return;
      setState(() => _failure = _verificationError(context.texts, e));
      _timer?.cancel();
      _timer = Timer(const Duration(seconds: 15), _load);
    }
  }

  Future<void> _loadTypes() async {
    // The country's settings may still be on their way when the screen opens.
    final country = (await ref.read(controlsProvider.future)).country;
    if (country == null || !mounted) return;
    try {
      final types = await ref.read(verificationApiProvider).idDocumentTypes(country.code, country.idDocumentTypes);
      if (mounted) setState(() => _types = types);
    } catch (_) {
      // Shown without their names if the list cannot be fetched; the codes still work.
      if (mounted) setState(() => _types = [for (final c in country.idDocumentTypes) DocumentType(c, c)]);
    }
  }

  Future<void> _pick(ImageSource source) async {
    final t = context.texts;
    try {
      final file = await ImagePicker().pickImage(source: source, maxWidth: 2400, maxHeight: 2400, imageQuality: 88);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final type = photoContentType(bytes);
      if (!mounted) return;
      setState(() {
        if (type == null || bytes.length > 20 * 1024 * 1024) {
          _failure = t.errorPhotoType;
        } else {
          _photo = bytes;
          _photoType = type;
          _failure = null;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _failure = t.somethingWentWrong);
    }
  }

  Future<void> _choosePhoto() async {
    final t = context.texts;
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large))),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppButton(label: t.takeAPhoto, onPressed: () => Navigator.of(sheet).pop(ImageSource.camera)),
              const SizedBox(height: 8),
              AppButton(label: t.chooseFromGallery, kind: AppButtonKind.outline, onPressed: () => Navigator.of(sheet).pop(ImageSource.gallery)),
            ],
          ),
        ),
      ),
    );
    if (source != null) await _pick(source);
  }

  Future<void> _sendDocument() async {
    setState(() => _formChecked = true);
    if (_type == null || _photo == null) return;
    setState(() {
      _sending = true;
      _failure = null;
    });
    try {
      final check = await ref.read(verificationApiProvider).addDocument(
            checkId: widget.checkId,
            documentTypeCode: _type!,
            bytes: _photo!,
            contentType: _photoType!,
            idempotencyKey: _uploadKey,
          );
      if (mounted) setState(() => _check = check);
    } catch (e) {
      if (mounted) setState(() => _failure = _verificationError(context.texts, e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _help() => launchUrl(Uri.parse('${ref.read(appConfigProvider).webUrl}/help'), mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final check = _check;
    final wide = AppWide.of(context);
    final top = SizedBox(height: wide ? 0 : 32);
    final failure = _failure == null ? const <Widget>[] : [AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)];
    final lister = ref.watch(sessionProvider).value?.me?.listsProperties ?? false;
    void back() => context.canPop() ? context.pop() : context.go('/verification');
    AppScreen frame({required List<Widget> children, List<Widget> bottom = const []}) =>
        AppScreen(title: t.verifyYourIdentity, onBack: back, onBackToProperties: backToProperties(ref), bottom: bottom, children: children);
    final lookAround = AppButton(label: t.keepLookingAround, kind: AppButtonKind.outline, onPressed: () => context.go('/home'));
    final help = AppButton(label: t.getHelp, kind: AppButtonKind.text, onPressed: _help);

    // 16 Checking (also shown while the check is first being fetched).
    if (check == null || check.pending) {
      return frame(
        bottom: [lookAround],
        children: [
          top,
          const ResultIcon(AppIcons.search, tint: AppColors.infoTint, ink: AppColors.verified),
          const SizedBox(height: 16),
          AppHeading(t.checkingTitle, intro: t.checkingText),
          const SizedBox(height: 16),
          ...failure,
          if (check != null) AppNotice(kind: AppNoticeKind.info, title: t.idEnding(check.idType, check.last4), message: t.checkedAgainstRecords),
          const SizedBox(height: 16),
        ],
      );
    }
    // 17 You're verified.
    if (check.passed) {
      return frame(
        bottom: [AppButton(label: lister ? t.continueLabel : t.startLooking, onPressed: () => context.go('/home'))],
        children: [
          top,
          const ResultIcon(AppIcons.shieldCheckFilled, tint: AppColors.successTint, ink: AppColors.success),
          const SizedBox(height: 16),
          AppHeading(t.verifiedTitle, intro: t.verifiedText),
          const SizedBox(height: 16),
          PointsBox(title: t.youCanNow, points: lister ? [t.canList, t.canTalkTenants, t.canBook] : [t.canMessage, t.canBook, t.canSave]),
          const SizedBox(height: 16),
        ],
      );
    }
    // 19 Add an ID document.
    if (check.wantsDocument) {
      final types = _types ?? const <DocumentType>[];
      return frame(
        bottom: [AppButton(label: t.sendForChecking, onPressed: _sending ? null : _sendDocument)],
        children: [
          if (!wide) const SizedBox(height: 8),
          AppHeading(t.addIdTitle, intro: t.addIdText(check.idType)),
          const SizedBox(height: 16),
          ...failure,
          Text(t.whichDocument, style: AppText.label.copyWith(height: 17 / 14)),
          for (final type in types) AppRadio<String>(label: type.label, value: type.code, groupValue: _type, onChanged: (v) => setState(() => _type = v)),
          if (_formChecked && _type == null) Text(t.errorChooseDocument, style: AppText.bodySmall.copyWith(color: AppColors.error)),
          const SizedBox(height: 14),
          Semantics(
            button: true,
            label: _photo == null ? '${t.takePhotoFront}, ${t.orChooseGallery}' : t.photoChosen,
            child: Material(
              color: AppColors.green50,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.medium), side: const BorderSide(color: AppColors.green700, width: 2)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: _sending ? null : _choosePhoto,
                child: SizedBox(
                  height: 168,
                  child: _photo != null
                      ? Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.memory(_photo!, fit: BoxFit.cover, excludeFromSemantics: true),
                            Align(
                              alignment: Alignment.bottomCenter,
                              child: Container(
                                width: double.infinity,
                                color: AppColors.ink900.withValues(alpha: 0.7),
                                padding: const EdgeInsets.all(8),
                                child: ExcludeSemantics(child: Text(t.photoChosen, textAlign: TextAlign.center, style: AppText.label.copyWith(color: AppColors.surface))),
                              ),
                            ),
                          ],
                        )
                      : ExcludeSemantics(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                alignment: Alignment.center,
                                decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
                                child: const AppIcon(AppIcons.camera, color: AppColors.green700),
                              ),
                              const SizedBox(height: 12),
                              Text(t.takePhotoFront, style: AppText.button.copyWith(color: AppColors.green700)),
                              const SizedBox(height: 2),
                              Text(t.orChooseGallery, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14)),
                            ],
                          ),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _formChecked && _photo == null ? t.errorChoosePhoto : t.showCorners,
            style: AppText.bodySmall.copyWith(color: _formChecked && _photo == null ? AppColors.error : AppColors.ink600, height: 17 / 14),
          ),
          const SizedBox(height: 16),
        ],
      );
    }
    // 18 The face check didn't work.
    if (check.faceFailed) {
      return frame(
        bottom: [AppButton(label: t.tryAgain, onPressed: () => context.pushReplacement('/verification/identity')), help],
        children: [
          top,
          const ResultIcon(AppIcons.camera, tint: AppColors.warningTint, ink: AppColors.warning),
          const SizedBox(height: 16),
          AppHeading(t.faceFailedTitle, intro: t.faceFailedText),
          const SizedBox(height: 16),
          PointsBox(title: t.tipsNextTry, points: [t.tipWindow, t.tipNoCap, t.tipStill]),
          const SizedBox(height: 16),
        ],
      );
    }
    // 20 With our verification team.
    if (check.withTeam) {
      return frame(
        bottom: [lookAround, help],
        children: [
          top,
          const ResultIcon(AppIcons.person, tint: AppColors.infoTint, ink: AppColors.verified),
          const SizedBox(height: 16),
          AppHeading(t.teamTitle, intro: t.teamText(check.idType)),
          const SizedBox(height: 16),
          AppNotice(kind: AppNoticeKind.info, title: t.nothingMoreTitle, message: t.nothingMoreText),
          const SizedBox(height: 16),
        ],
      );
    }
    // Any other ending (a fault at the provider, or a check replaced by a newer one): start again.
    return frame(
      bottom: [AppButton(label: t.tryAgain, onPressed: () => context.pushReplacement('/verification/identity')), help],
      children: [
        top,
        const ResultIcon(AppIcons.help, tint: AppColors.warningTint, ink: AppColors.warning),
        const SizedBox(height: 16),
        AppHeading(t.checkProblemTitle, intro: t.checkProblemText),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// Screen 21, Company details, for agents who work through a firm (decision 50).
class CompanyDetailsScreen extends ConsumerStatefulWidget {
  const CompanyDetailsScreen({super.key});

  @override
  ConsumerState<CompanyDetailsScreen> createState() => _CompanyDetailsScreenState();
}

class _CompanyDetailsScreenState extends ConsumerState<CompanyDetailsScreen> {
  final _name = TextEditingController();
  final _number = TextEditingController();
  AgentProfile? _profile;
  bool _loaded = false;
  bool _busy = false;
  String? _nameError;
  String? _failure;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      try {
        final profile = await ref.read(verificationApiProvider).agentProfile();
        if (!mounted) return;
        setState(() {
          _profile = profile;
          _name.text = profile?.businessName ?? '';
          _number.text = profile?.registrationNumber ?? '';
          _loaded = true;
        });
      } catch (e) {
        if (mounted) {
          setState(() {
            _failure = _verificationError(context.texts, e);
            _loaded = true;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _number.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final t = context.texts;
    if (_name.text.trim().isEmpty) return setState(() => _nameError = t.errorBusinessName);
    setState(() {
      _busy = true;
      _failure = null;
      _nameError = null;
    });
    try {
      final number = _number.text.trim();
      final profile = await ref.read(verificationApiProvider).saveAgentProfile(businessName: _name.text.trim(), registrationNumber: number.isEmpty ? null : number);
      if (mounted) setState(() => _profile = profile);
    } on ApiException catch (e) {
      if (mounted) setState(() => _failure = e.code == 'VERIFICATION_REQUIRED' ? t.companyNeedsLevel2 : _verificationError(t, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.texts;
    final profile = _profile;
    final (tag, words) = switch (profile?.status) {
      'PASSED' => (AppTag(label: t.tagApproved, kind: AppTagKind.approved), t.companyApproved),
      'FAILED' => (AppTag(label: t.tagNotApproved, kind: AppTagKind.notApproved), t.companyNotApproved),
      _ => (AppTag(label: t.tagWaiting, kind: AppTagKind.waiting), t.companyWaiting),
    };
    return AppScreen(
      title: t.companyDetails,
      onBack: () => context.canPop() ? context.pop() : context.go('/verification'),
      onBackToProperties: backToProperties(ref),
      bottom: [AppButton(label: t.saveCompanyDetails, onPressed: _busy || !_loaded ? null : _save)],
      children: [
        if (!AppWide.of(context)) const SizedBox(height: 8),
        AppHeading(t.yourCompany, intro: t.companyIntro),
        const SizedBox(height: 16),
        if (_failure != null) ...[AppNotice(kind: AppNoticeKind.error, title: _failure!), const SizedBox(height: 16)],
        if (profile != null) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppRadius.medium), border: Border.all(color: AppColors.border)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [tag, const SizedBox(height: 4), Text(words, style: AppText.bodySmall.copyWith(color: AppColors.ink600, height: 17 / 14))],
            ),
          ),
          const SizedBox(height: 16),
        ],
        AppTextField(label: t.businessName, controller: _name, error: _nameError, textCapitalization: TextCapitalization.words, textInputAction: TextInputAction.next),
        const SizedBox(height: 16),
        AppTextField(label: t.registrationNumber, controller: _number, helper: t.registrationHelper, textCapitalization: TextCapitalization.characters),
        const SizedBox(height: 16),
      ],
    );
  }
}
