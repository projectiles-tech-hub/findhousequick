import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../providers.dart';

/// A phone number or an email address, and how a code reaches it.
class Contact {
  const Contact.phone(this.value) : isPhone = true;
  const Contact.email(this.value) : isPhone = false;

  final String value;
  final bool isPhone;

  /// What the API calls the way a code is sent.
  String get channel => isPhone ? 'SMS' : 'EMAIL';
  Map<String, String> get asField => {isPhone ? 'phone' : 'email': value};
}

/// The account requests of the API: codes, sign-up, sign-in and password reset. Every rule is the server's.
class AccountsApi {
  AccountsApi(this._api);
  final ApiClient _api;

  /// [purpose] is REGISTER, LOGIN or RESET_PASSWORD. The answer never says whether the contact has an account.
  Future<void> sendCode(Contact to, String purpose) =>
      _api.postJson('/auth/otp', body: {...to.asField, 'purpose': purpose}, signedIn: false);

  Future<Map<String, dynamic>> register({
    required String phone,
    required String email,
    required Contact codeSentTo,
    required String code,
    required String password,
    required String firstName,
    required String lastName,
    required String countryCode,
    required List<String> types,
    required String language,
    required String termsVersion,
    required String privacyVersion,
    String? invitationCode,
  }) =>
      _api.postJson(
        '/auth/register',
        signedIn: false,
        body: {
          'phone': phone,
          'email': email,
          'signUpWith': codeSentTo.channel,
          'otp': code,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          'countryCode': countryCode,
          'types': types,
          'language': language,
          'invitationCode': ?invitationCode,
          'consent': {'termsVersion': termsVersion, 'privacyVersion': privacyVersion},
        },
      );

  /// Give exactly one of [password] or [code].
  Future<Map<String, dynamic>> signIn(Contact contact, {String? password, String? code}) =>
      _api.postJson('/auth/login', signedIn: false, body: {...contact.asField, 'password': ?password, 'otp': ?code});

  Future<void> resetPassword(Contact contact, {required String code, required String newPassword}) =>
      _api.postJson('/auth/password-reset', signedIn: false, body: {...contact.asField, 'otp': code, 'newPassword': newPassword});

  /// Sends a code to confirm the signed-in user's phone number or email address.
  Future<void> sendContactCode(Contact contact) => _api.postJson('/me/contacts/code', body: {'channel': contact.channel, 'value': contact.value});

  Future<Map<String, dynamic>> confirmContact(Contact contact, String code) =>
      _api.postJson('/me/contacts/confirm', body: {'channel': contact.channel, 'value': contact.value, 'code': code});
}

final accountsApiProvider = Provider<AccountsApi>((ref) => AccountsApi(ref.watch(apiClientProvider)));

/// Joins the country's dialling code and what the user typed. The server tidies spaces and a leading 0 itself.
String fullPhone(String dialCode, String typed) {
  final t = typed.trim();
  return t.startsWith('+') ? t : '$dialCode $t';
}

/// Hides the middle of a phone number for showing on screen: "+234 803 ••• 4567".
String maskPhone(String dialCode, String typed) {
  var digits = typed.replaceAll(RegExp(r'[^0-9]'), '');
  if (typed.trim().startsWith('+')) return typed.trim();
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length < 8) return '$dialCode $digits';
  return '$dialCode ${digits.substring(0, 3)} ••• ${digits.substring(digits.length - 4)}';
}

bool looksLikeEmail(String s) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s.trim());
