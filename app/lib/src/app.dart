import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'accounts/confirm_contact_screens.dart';
import 'accounts/sign_in_screens.dart';
import 'accounts/sign_up_screens.dart';
import 'accounts/welcome_screen.dart';
import 'design/gallery_screen.dart';
import 'design/tokens.dart';
import 'design/wide.dart';
import 'design/app_icon.dart';
import 'home/home_screen.dart';
import 'home/main_shell.dart';
import 'search/search_screens.dart';
import 'l10n/languages.dart';
import 'l10n/locale.dart';
import 'session/session.dart';
import 'theme/theme.dart';
import 'property/property_screen.dart';
import 'verification/verification_screens.dart';

/// Set with --dart-define=PARTS_GALLERY=true to open the page of shared parts at /parts. Off in every released build.
const _partsGallery = bool.fromEnvironment('PARTS_GALLERY');

/// The pages of the app and their addresses. The website links to /sign-up and /sign-in (web/src/lib/links.ts).
GoRouter buildRouter({String initialLocation = '/'}) => GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(path: '/', builder: (context, state) => const _StartGate()),
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => MainShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (context, state) => const SearchHomeScreen())]),
            StatefulShellBranch(routes: [GoRoute(path: '/saved', builder: (context, state) => ComingTab(title: context.texts.tabSaved, icon: AppIcons.heart))]),
            StatefulShellBranch(routes: [GoRoute(path: '/messages', builder: (context, state) => ComingTab(title: context.texts.tabMessages, icon: AppIcons.chat))]),
            StatefulShellBranch(routes: [GoRoute(path: '/inspections', builder: (context, state) => ComingTab(title: context.texts.tabInspections, icon: AppIcons.calendar))]),
            // Until the Me screen is built (part 6), the Me tab keeps the temporary screen with Verification and Sign out.
            StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (context, state) => const HomeScreen())]),
          ],
        ),
        GoRoute(path: '/search/results', builder: (context, state) => const ResultsScreen()),
        GoRoute(path: '/search/filters', builder: (context, state) => const FiltersScreen()),
        GoRoute(path: '/search/place', builder: (context, state) => const PlaceSearchScreen()),
        GoRoute(path: '/search/save-area', builder: (context, state) => const SaveAreaScreen()),
        GoRoute(path: '/search/location', builder: (context, state) => const LocationPermissionScreen()),
        // The same address as the public website's page for the listing, so a shared link opens in either.
        GoRoute(path: '/homes/:id', builder: (context, state) => PropertyScreen(listingId: state.pathParameters['id']!)),
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
    if (session.value?.signedIn == true) {
      WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/home'));
      return const Scaffold(backgroundColor: AppColors.surface);
    }
    return const WelcomeScreen();
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
