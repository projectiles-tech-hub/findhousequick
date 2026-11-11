import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../providers.dart';
import 'token_store.dart';

/// The signed-in user, as the server describes them (GET /me).
class Me {
  const Me({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.types,
    required this.verificationLevel,
    required this.phoneConfirmed,
    required this.emailConfirmed,
    this.phone,
    this.email,
    this.countryCode,
    this.language,
    this.nextAction,
  });

  final String id;
  final String firstName;
  final String lastName;

  /// TENANT, LANDLORD, AGENT, SCOUT; a user can hold several.
  final List<String> types;
  final int verificationLevel;
  final bool phoneConfirmed;
  final bool emailConfirmed;
  final String? phone;
  final String? email;
  final String? countryCode;
  final String? language;

  /// What the user must do to reach the next level, e.g. CONFIRM_EMAIL; empty at the top level.
  final String? nextAction;

  bool get listsProperties => types.contains('LANDLORD') || types.contains('AGENT');

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        id: j['id'] as String,
        firstName: (j['firstName'] as String?) ?? '',
        lastName: (j['lastName'] as String?) ?? '',
        types: ((j['types'] as List?) ?? const []).cast<String>(),
        verificationLevel: (j['verificationLevel'] as num?)?.toInt() ?? 0,
        phoneConfirmed: j['phoneConfirmed'] == true,
        emailConfirmed: j['emailConfirmed'] == true,
        phone: j['phone'] as String?,
        email: j['email'] as String?,
        countryCode: j['countryCode'] as String?,
        language: j['language'] as String?,
        nextAction: (j['next'] as Map?)?['action'] as String?,
      );
}

/// Whether someone is signed in on this device, and who.
class SessionState {
  const SessionState.signedOut()
      : me = null,
        signedIn = false;
  const SessionState.signedIn(this.me) : signedIn = true;

  final bool signedIn;

  /// Empty while signed in but the server could not be reached to say who (for example with no connection).
  final Me? me;
}

/// Keeps the session: restores it when the app opens, starts it after sign-in or sign-up, and ends it on sign-out
/// or when the server says it has ended.
class SessionNotifier extends AsyncNotifier<SessionState> {
  @override
  Future<SessionState> build() async {
    final api = ref.watch(apiClientProvider);
    api.onSessionEnded = () => state = const AsyncData(SessionState.signedOut());
    final tokens = await ref.watch(tokenStoreProvider).read();
    if (tokens == null) return const SessionState.signedOut();
    try {
      return SessionState.signedIn(Me.fromJson(await api.getJson('/me')));
    } on ApiException catch (e) {
      if (e.statusCode == 401) return const SessionState.signedOut();
      // No connection: stay signed in; screens that need the server will say so.
      return const SessionState.signedIn(null);
    }
  }

  /// Takes the answer to a successful sign-in or sign-up (tokens and the user) and starts the session.
  Future<void> start(Map<String, dynamic> sessionJson) async {
    await ref.read(tokenStoreProvider).write(Tokens.fromJson(sessionJson));
    final user = sessionJson['user'];
    state = AsyncData(SessionState.signedIn(user is Map<String, dynamic> ? Me.fromJson(user) : null));
  }

  /// Asks the server again who the user is, after something about them changed (a confirmed email, a new level).
  Future<void> reload() async {
    final me = Me.fromJson(await ref.read(apiClientProvider).getJson('/me'));
    state = AsyncData(SessionState.signedIn(me));
  }

  /// Signs this device out. The keys are removed from the phone even if the server cannot be reached.
  Future<void> signOut() async {
    try {
      await ref.read(apiClientProvider).postJson('/auth/logout');
    } on ApiException {
      // Nothing more to do: the keys are removed below, and the server ends the session when they run out.
    }
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(SessionState.signedOut());
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
