import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'accounts/confirm_contact_screens.dart';
import 'accounts/sign_in_screens.dart';
import 'accounts/sign_up_screens.dart';
import 'accounts/welcome_screen.dart';
import 'design/gallery_screen.dart';
import 'design/tokens.dart';
import 'design/wide.dart';
import 'home/home_screen.dart';
import 'l10n/languages.dart';
import 'l10n/locale.dart';
import 'session/session.dart';
import 'theme/theme.dart';
import 'verification/verification_screens.dart';

/// Set with --dart-define=PARTS_GALLERY=true to open the page of shared parts at /parts. Off in every released build.
const _partsGallery = bool.fromEnvironment('PARTS_GALLERY');

/// The pages of the app and their addresses. The website links to /sign-up and /sign-in (web/src/lib/links.ts).
GoRouter buildRouter({String initialLocation = '/'}) => GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(path: '/', builder: (context, state) => const _StartGate()),
        GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
        GoRoute(
          path: '/sign-up',
          builder: (context, state) => WhoAreYouScreen(preselect: state.uri.queryParameters['as'], invitationCode: state.uri.queryParameters['invitation']),
          routes: [
            GoRoute(path: 'details', builder: (context, state) => const YourDetailsScreen()),
            GoRoute(path: 'code', builder: (context, state) => const SignUpCodeScreen()),
          ],
        ),
        GoRoute(
          path: '/confirm/:what',
          builder: (context, state) =>
              ConfirmContactScreen(phone: state.pathParameters['what'] == 'phone', justCreated: state.uri.queryParameters['new'] == '1'),
          routes: [
            GoRoute(path: 'code', builder: (context, state) => ConfirmContactCodeScreen(phone: state.pathParameters['what'] == 'phone')),
          ],
        ),
        GoRoute(
          path: '/sign-in',
          builder: (context, state) => SignInScreen(passwordChanged: state.uri.queryParameters['changed'] == '1'),
          routes: [
            GoRoute(
              path: 'code',
              // Opened without the contact (for example after a page reload on the web): start again at sign-in.
              redirect: (context, state) => state.extra is SignInContact ? null : '/sign-in',
              builder: (context, state) => SignInCodeScreen(who: state.extra! as SignInContact),
            ),
          ],
        ),
        GoRoute(
          path: '/forgot-password',
          builder: (context, state) => ForgotPasswordScreen(start: state.extra is SignInContact ? state.extra! as SignInContact : null),
        ),
        GoRoute(
          path: '/reset-password',
          redirect: (context, state) => state.extra is SignInContact ? null : '/forgot-password',
          builder: (context, state) => NewPasswordScreen(who: state.extra! as SignInContact),
        ),
        GoRoute(
          path: '/verification',
          builder: (context, state) => const VerificationHubScreen(),
          routes: [
            GoRoute(path: 'identity', builder: (context, state) => const VerifyIdentityScreen()),
            GoRoute(path: 'check/:id', builder: (context, state) => IdentityCheckScreen(checkId: state.pathParameters['id']!)),
            GoRoute(path: 'company', builder: (context, state) => const CompanyDetailsScreen()),
          ],
        ),
        if (_partsGallery) GoRoute(path: '/parts', builder: (context, state) => const GalleryScreen()),
      ],
    );

/// Where the app opens: the welcome screen for someone not signed in, otherwise the start screen.
class _StartGate extends ConsumerWidget {
  const _StartGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session.isLoading && !session.hasValue) {
      return const Scaffold(backgroundColor: AppColors.surface, body: Center(child: CircularProgressIndicator(color: AppColors.green700)));
    }
    return session.value?.signedIn == true ? const HomeScreen() : const WelcomeScreen();
  }
}

class FindHouseQuickApp extends ConsumerStatefulWidget {
  const FindHouseQuickApp({super.key, this.initialLocation = '/'});

  /// The page to open on; tests use it to start on a given screen.
  final String initialLocation;

  @override
  ConsumerState<FindHouseQuickApp> createState() => _FindHouseQuickAppState();
}

class _FindHouseQuickAppState extends ConsumerState<FindHouseQuickApp> {
  late final GoRouter _router = buildRouter(initialLocation: widget.initialLocation);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FindHouseQuick',
      theme: AppTheme.light(),
      locale: ref.watch(localeProvider),
      localizationsDelegates: appLocalizationsDelegates,
      supportedLocales: appLocales,
      routerConfig: _router,
      // Tells every screen whether it is in its phone layout or its website layout (decision 74).
      builder: (context, child) => AppWide.forWidth(context, child!),
      debugShowCheckedModeBanner: false,
    );
  }
}
