import '../api/api_client.dart';
import '../l10n/languages.dart';

/// Turns a refusal from the server into words in the user's language. Reasons the app does not know are shown as
/// the server wrote them.
String accountErrorText(AppTexts t, Object error) {
  if (error is! ApiException) return t.somethingWentWrong;
  if (error.offline) return '${t.noConnectionTitle}. ${t.noConnectionMessage}';
  return switch (error.code) {
    'INVALID_CODE' => t.errorInvalidCode,
    'PHONE_TAKEN' => t.errorPhoneTaken,
    'EMAIL_TAKEN' => t.errorEmailTaken,
    'TOO_MANY_REQUESTS' => t.errorTooManyCodes,
    'WRONG_CREDENTIALS' => t.errorWrongCredentials,
    'ACCOUNT_SUSPENDED' => t.errorSuspended,
    'INVALID_INVITATION' => t.errorInvitation,
    'FEATURE_UNAVAILABLE' when error.feature == 'platform.new_registrations' => t.errorRegistrationsPaused,
    _ => error.statusCode != null && error.statusCode! < 500 ? error.message : t.somethingWentWrong,
  };
}
