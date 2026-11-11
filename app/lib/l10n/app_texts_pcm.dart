// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_texts.dart';

// ignore_for_file: type=lint

/// The translations for Nigerian Pidgin (`pcm`).
class AppTextsPcm extends AppTexts {
  AppTextsPcm([String locale = 'pcm']) : super(locale);

  @override
  String get appName => 'FindHouseQuick';

  @override
  String get tabSearch => 'Search';

  @override
  String get tabSaved => 'Saved';

  @override
  String get tabProperties => 'Properties';

  @override
  String get tabMessages => 'Messages';

  @override
  String get tabInspections => 'Inspections';

  @override
  String get tabMe => 'Me';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get noConnectionTitle => 'No internet connection';

  @override
  String get noConnectionMessage =>
      'Check your data or Wi-Fi. We will try again when you are back online.';

  @override
  String get somethingWentWrong => 'Something went wrong. Please try again.';

  @override
  String get tryAgain => 'Try again';

  @override
  String get back => 'Back';

  @override
  String get language => 'Language';

  @override
  String get languageEn => 'English';

  @override
  String get languagePcm => 'Pidgin';

  @override
  String get welcomeHeadline => 'Find your next home, quick.';

  @override
  String get welcomeIntro =>
      'Houses, flats and shops to rent, from landlords and agents whose identity we have checked.';

  @override
  String get welcomeReason1Title => 'Checked landlords and agents';

  @override
  String get welcomeReason1Text =>
      'Every lister proves who they are before they can list.';

  @override
  String get welcomeReason2Title => 'Search around you';

  @override
  String get welcomeReason2Text =>
      'See what is available near your office, school or street.';

  @override
  String get welcomeReason3Title => 'Talk and call inside the app';

  @override
  String get welcomeReason3Text =>
      'Your phone number stays private until you choose to share it.';

  @override
  String get createAnAccount => 'Create an account';

  @override
  String get signIn => 'Sign in';

  @override
  String get lookAroundFirst => 'Look around first';

  @override
  String stepOf(int step, int total) {
    return 'Step $step of $total';
  }

  @override
  String get whoTitle => 'How will you use FindHouseQuick?';

  @override
  String get whoHint => 'Choose all that apply.';

  @override
  String get typeTenant => 'Tenant';

  @override
  String get typeTenantText => 'I want to rent a home, shop or short let.';

  @override
  String get typeLandlord => 'Landlord';

  @override
  String get typeLandlordText => 'I own property I want to let.';

  @override
  String get typeAgent => 'Agent';

  @override
  String get typeAgentText =>
      'A landlord has authorised me to let their property.';

  @override
  String get continueLabel => 'Continue';

  @override
  String get detailsTitle => 'Your details';

  @override
  String get detailsIntro =>
      'Use your real name, as it is on your ID. You will need it when you verify your identity.';

  @override
  String get firstName => 'First name';

  @override
  String get surname => 'Surname';

  @override
  String get phoneNumber => 'Phone number';

  @override
  String get phoneHelper => 'We send codes here by SMS';

  @override
  String get emailAddress => 'Email address';

  @override
  String get emailHelper => 'We send receipts and codes here';

  @override
  String get password => 'Password';

  @override
  String get passwordHelper => 'At least 8 characters';

  @override
  String get sendCodeBy => 'Send my sign-up code by';

  @override
  String get sendBySms => 'SMS to my phone';

  @override
  String get sendByEmail => 'Email';

  @override
  String get confirmOtherAfter =>
      'We will ask you to confirm the other one straight after.';

  @override
  String get consentBefore => 'I agree to the ';

  @override
  String get consentTerms => 'terms of use';

  @override
  String get consentBetween => ' and the ';

  @override
  String get consentPrivacy => 'privacy policy';

  @override
  String get consentAfter =>
      ', including how my identity documents are stored.';

  @override
  String get sendCode => 'Send code';

  @override
  String get errorFirstName => 'Please enter your first name';

  @override
  String get errorSurname => 'Please enter your surname';

  @override
  String get errorPhone => 'Please enter your phone number';

  @override
  String get errorEmail => 'Please enter a valid email address';

  @override
  String get errorPassword => 'Use at least 8 characters';

  @override
  String get errorConsent =>
      'Please agree to the terms of use and the privacy policy to continue';

  @override
  String get errorChooseOne => 'Please choose at least one';

  @override
  String get enterTheCode => 'Enter the code';

  @override
  String codeSentSms(String phone) {
    return 'We sent a 6-digit code by SMS to $phone. It expires in 10 minutes.';
  }

  @override
  String codeSentEmail(String email) {
    return 'We sent a 6-digit code by email to $email. It expires in 10 minutes.';
  }

  @override
  String get code => 'Code';

  @override
  String sendAgainIn(String time) {
    return 'Send the code again in $time';
  }

  @override
  String get sendCodeAgain => 'Send the code again';

  @override
  String get wrongNumberChange => 'Wrong number? Change it';

  @override
  String get wrongEmailChange => 'Wrong email? Change it';

  @override
  String get sendByEmailInstead => 'Send the code by email instead';

  @override
  String get sendBySmsInstead => 'Send the code by SMS instead';

  @override
  String get createMyAccount => 'Create my account';

  @override
  String get errorCode => 'Please enter the 6-digit code';

  @override
  String get errorInvalidCode =>
      'The code is wrong or has expired. Please ask for a new one.';

  @override
  String get errorPhoneTaken =>
      'This phone number is already used by another account.';

  @override
  String get errorEmailTaken =>
      'This email address is already used by another account.';

  @override
  String get errorTooManyCodes =>
      'Too many codes requested. Please wait and try again.';

  @override
  String get errorWrongCredentials =>
      'The phone number or email address, password or code is not correct.';

  @override
  String get errorSuspended =>
      'This account has been suspended. Please contact support.';

  @override
  String get errorRegistrationsPaused =>
      'New registrations are paused at the moment. Please try again later.';

  @override
  String get errorInvitation =>
      'This invitation link is not valid or has already been used. You can still create your account: press the button again.';

  @override
  String welcomeReady(String name) {
    return 'Welcome, $name. Your account is ready.';
  }

  @override
  String get confirmEmailIntro =>
      'One more step: confirm your email address. Then you can save homes, set alerts for areas you like, and move on to verifying your identity.';

  @override
  String get confirmPhoneIntro =>
      'One more step: confirm your phone number. Then you can save homes, set alerts for areas you like, and move on to verifying your identity.';

  @override
  String get untilThenTitle => 'Until then, you can only look around';

  @override
  String get untilThenText =>
      'Listings, the map and prices are open to you now.';

  @override
  String get sendCodeToEmail => 'Send code to my email';

  @override
  String get sendCodeToPhone => 'Send code to my phone';

  @override
  String get doItLater => 'Do it later';

  @override
  String get confirmYourEmail => 'Confirm your email';

  @override
  String get confirmYourPhone => 'Confirm your phone number';

  @override
  String get confirm => 'Confirm';

  @override
  String get welcomeBack => 'Welcome back';

  @override
  String get signInIntro => 'Sign in with your phone number or email address.';

  @override
  String get chipPhone => 'Phone number';

  @override
  String get chipEmail => 'Email';

  @override
  String get forgotPasswordLink => 'Forgot your password?';

  @override
  String get getCodeInstead => 'Get a sign-in code instead';

  @override
  String get newHere => 'New here? Create an account';

  @override
  String get pausedTitle => 'Password sign-in is paused for 15 minutes';

  @override
  String get pausedHelper => '5 wrong passwords in a row';

  @override
  String get getSignInCode => 'Get a sign-in code';

  @override
  String get setNewPassword => 'Set a new password';

  @override
  String get errorPasswordEmpty => 'Please enter your password';

  @override
  String get resetPassword => 'Reset password';

  @override
  String get forgotTitle => 'Forgot your password?';

  @override
  String get forgotIntro =>
      'Choose where to get a code: your phone or your email. If an account uses it, we will send a 6-digit code there.';

  @override
  String get codeComesBySms => 'The code comes by SMS';

  @override
  String get codeComesByEmail => 'The code comes by email';

  @override
  String newPasswordIntro(String contact) {
    return 'Enter the code we sent to $contact, then choose a new password.';
  }

  @override
  String get newPassword => 'New password';

  @override
  String get signedOutEverywhereTitle => 'You will be signed out everywhere';

  @override
  String get signedOutEverywhereText =>
      'For your safety, every phone and computer signed in to your account is signed out. Then sign in with your new password.';

  @override
  String get saveNewPassword => 'Save new password';

  @override
  String get passwordChangedTitle => 'Your password has been changed';

  @override
  String get passwordChangedText => 'Sign in with your new password.';

  @override
  String get signOut => 'Sign out';

  @override
  String get pausedTextPhone =>
      'This keeps your account safe. You can still sign in now with a code sent to your phone, or set a new password.';

  @override
  String get pausedTextEmail =>
      'This keeps your account safe. You can still sign in now with a code sent to your email, or set a new password.';
}
