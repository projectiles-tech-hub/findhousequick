import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What the user has entered so far while creating an account. Kept in memory only, and cleared once the account exists.
class SignUpDraft {
  const SignUpDraft({
    this.types = const {},
    this.firstName = '',
    this.lastName = '',
    this.phone = '',
    this.email = '',
    this.password = '',
    this.codeByEmail = false,
    this.agreed = false,
    this.invitationCode,
  });

  /// TENANT, LANDLORD, AGENT.
  final Set<String> types;
  final String firstName;
  final String lastName;

  /// As typed, without the dialling code.
  final String phone;
  final String email;
  final String password;

  /// Whether the sign-up code goes to the email address (otherwise by SMS).
  final bool codeByEmail;
  final bool agreed;

  /// From a scout's invitation link (decision 70).
  final String? invitationCode;

  SignUpDraft copyWith({
    Set<String>? types,
    String? firstName,
    String? lastName,
    String? phone,
    String? email,
    String? password,
    bool? codeByEmail,
    bool? agreed,
    String? Function()? invitationCode,
  }) =>
      SignUpDraft(
        types: types ?? this.types,
        firstName: firstName ?? this.firstName,
        lastName: lastName ?? this.lastName,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        password: password ?? this.password,
        codeByEmail: codeByEmail ?? this.codeByEmail,
        agreed: agreed ?? this.agreed,
        invitationCode: invitationCode == null ? this.invitationCode : invitationCode(),
      );
}

class SignUpNotifier extends Notifier<SignUpDraft> {
  @override
  SignUpDraft build() => const SignUpDraft();

  void update(SignUpDraft Function(SignUpDraft) change) => state = change(state);
  void clear() => state = const SignUpDraft();
}

final signUpProvider = NotifierProvider<SignUpNotifier, SignUpDraft>(SignUpNotifier.new);
