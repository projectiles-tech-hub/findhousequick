import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_texts_en.dart';
import 'app_texts_pcm.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppTexts
/// returned by `AppTexts.of(context)`.
///
/// Applications need to include `AppTexts.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_texts.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppTexts.localizationsDelegates,
///   supportedLocales: AppTexts.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppTexts.supportedLocales
/// property.
abstract class AppTexts {
  AppTexts(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppTexts of(BuildContext context) {
    return Localizations.of<AppTexts>(context, AppTexts)!;
  }

  static const LocalizationsDelegate<AppTexts> delegate = _AppTextsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('pcm'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'FindHouseQuick'**
  String get appName;

  /// No description provided for @tabSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get tabSearch;

  /// No description provided for @tabSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get tabSaved;

  /// No description provided for @tabProperties.
  ///
  /// In en, this message translates to:
  /// **'Properties'**
  String get tabProperties;

  /// No description provided for @tabMessages.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get tabMessages;

  /// No description provided for @tabInspections.
  ///
  /// In en, this message translates to:
  /// **'Inspections'**
  String get tabInspections;

  /// No description provided for @tabMe.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get tabMe;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @noConnectionTitle.
  ///
  /// In en, this message translates to:
  /// **'No internet connection'**
  String get noConnectionTitle;

  /// No description provided for @noConnectionMessage.
  ///
  /// In en, this message translates to:
  /// **'Check your data or Wi-Fi. We will try again when you are back online.'**
  String get noConnectionMessage;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWentWrong;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageEn.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEn;

  /// No description provided for @languagePcm.
  ///
  /// In en, this message translates to:
  /// **'Pidgin'**
  String get languagePcm;

  /// No description provided for @welcomeHeadline.
  ///
  /// In en, this message translates to:
  /// **'Find your next home, quick.'**
  String get welcomeHeadline;

  /// No description provided for @welcomeIntro.
  ///
  /// In en, this message translates to:
  /// **'Houses, flats and shops to rent, from landlords and agents whose identity we have checked.'**
  String get welcomeIntro;

  /// No description provided for @welcomeReason1Title.
  ///
  /// In en, this message translates to:
  /// **'Checked landlords and agents'**
  String get welcomeReason1Title;

  /// No description provided for @welcomeReason1Text.
  ///
  /// In en, this message translates to:
  /// **'Every lister proves who they are before they can list.'**
  String get welcomeReason1Text;

  /// No description provided for @welcomeReason2Title.
  ///
  /// In en, this message translates to:
  /// **'Search around you'**
  String get welcomeReason2Title;

  /// No description provided for @welcomeReason2Text.
  ///
  /// In en, this message translates to:
  /// **'See what is available near your office, school or street.'**
  String get welcomeReason2Text;

  /// No description provided for @welcomeReason3Title.
  ///
  /// In en, this message translates to:
  /// **'Talk and call inside the app'**
  String get welcomeReason3Title;

  /// No description provided for @welcomeReason3Text.
  ///
  /// In en, this message translates to:
  /// **'Your phone number stays private until you choose to share it.'**
  String get welcomeReason3Text;

  /// No description provided for @createAnAccount.
  ///
  /// In en, this message translates to:
  /// **'Create an account'**
  String get createAnAccount;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @lookAroundFirst.
  ///
  /// In en, this message translates to:
  /// **'Look around first'**
  String get lookAroundFirst;

  /// No description provided for @stepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {step} of {total}'**
  String stepOf(int step, int total);

  /// No description provided for @whoTitle.
  ///
  /// In en, this message translates to:
  /// **'How will you use FindHouseQuick?'**
  String get whoTitle;

  /// No description provided for @whoHint.
  ///
  /// In en, this message translates to:
  /// **'Choose all that apply.'**
  String get whoHint;

  /// No description provided for @typeTenant.
  ///
  /// In en, this message translates to:
  /// **'Tenant'**
  String get typeTenant;

  /// No description provided for @typeTenantText.
  ///
  /// In en, this message translates to:
  /// **'I want to rent a home, shop or short let.'**
  String get typeTenantText;

  /// No description provided for @typeLandlord.
  ///
  /// In en, this message translates to:
  /// **'Landlord'**
  String get typeLandlord;

  /// No description provided for @typeLandlordText.
  ///
  /// In en, this message translates to:
  /// **'I own property I want to let.'**
  String get typeLandlordText;

  /// No description provided for @typeAgent.
  ///
  /// In en, this message translates to:
  /// **'Agent'**
  String get typeAgent;

  /// No description provided for @typeAgentText.
  ///
  /// In en, this message translates to:
  /// **'A landlord has authorised me to let their property.'**
  String get typeAgentText;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @detailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Your details'**
  String get detailsTitle;

  /// No description provided for @detailsIntro.
  ///
  /// In en, this message translates to:
  /// **'Use your real name, as it is on your ID. You will need it when you verify your identity.'**
  String get detailsIntro;

  /// No description provided for @firstName.
  ///
  /// In en, this message translates to:
  /// **'First name'**
  String get firstName;

  /// No description provided for @surname.
  ///
  /// In en, this message translates to:
  /// **'Surname'**
  String get surname;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get phoneNumber;

  /// No description provided for @phoneHelper.
  ///
  /// In en, this message translates to:
  /// **'We send codes here by SMS'**
  String get phoneHelper;

  /// No description provided for @emailAddress.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get emailAddress;

  /// No description provided for @emailHelper.
  ///
  /// In en, this message translates to:
  /// **'We send receipts and codes here'**
  String get emailHelper;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @passwordHelper.
  ///
  /// In en, this message translates to:
  /// **'At least 8 characters'**
  String get passwordHelper;

  /// No description provided for @sendCodeBy.
  ///
  /// In en, this message translates to:
  /// **'Send my sign-up code by'**
  String get sendCodeBy;

  /// No description provided for @sendBySms.
  ///
  /// In en, this message translates to:
  /// **'SMS to my phone'**
  String get sendBySms;

  /// No description provided for @sendByEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get sendByEmail;

  /// No description provided for @confirmOtherAfter.
  ///
  /// In en, this message translates to:
  /// **'We will ask you to confirm the other one straight after.'**
  String get confirmOtherAfter;

  /// No description provided for @consentBefore.
  ///
  /// In en, this message translates to:
  /// **'I agree to the '**
  String get consentBefore;

  /// No description provided for @consentTerms.
  ///
  /// In en, this message translates to:
  /// **'terms of use'**
  String get consentTerms;

  /// No description provided for @consentBetween.
  ///
  /// In en, this message translates to:
  /// **' and the '**
  String get consentBetween;

  /// No description provided for @consentPrivacy.
  ///
  /// In en, this message translates to:
  /// **'privacy policy'**
  String get consentPrivacy;

  /// No description provided for @consentAfter.
  ///
  /// In en, this message translates to:
  /// **', including how my identity documents are stored.'**
  String get consentAfter;

  /// No description provided for @sendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get sendCode;

  /// No description provided for @errorFirstName.
  ///
  /// In en, this message translates to:
  /// **'Please enter your first name'**
  String get errorFirstName;

  /// No description provided for @errorSurname.
  ///
  /// In en, this message translates to:
  /// **'Please enter your surname'**
  String get errorSurname;

  /// No description provided for @errorPhone.
  ///
  /// In en, this message translates to:
  /// **'Please enter your phone number'**
  String get errorPhone;

  /// No description provided for @errorEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email address'**
  String get errorEmail;

  /// No description provided for @errorPassword.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters'**
  String get errorPassword;

  /// No description provided for @errorConsent.
  ///
  /// In en, this message translates to:
  /// **'Please agree to the terms of use and the privacy policy to continue'**
  String get errorConsent;

  /// No description provided for @errorChooseOne.
  ///
  /// In en, this message translates to:
  /// **'Please choose at least one'**
  String get errorChooseOne;

  /// No description provided for @enterTheCode.
  ///
  /// In en, this message translates to:
  /// **'Enter the code'**
  String get enterTheCode;

  /// No description provided for @codeSentSms.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6-digit code by SMS to {phone}. It expires in 10 minutes.'**
  String codeSentSms(String phone);

  /// No description provided for @codeSentEmail.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6-digit code by email to {email}. It expires in 10 minutes.'**
  String codeSentEmail(String email);

  /// No description provided for @code.
  ///
  /// In en, this message translates to:
  /// **'Code'**
  String get code;

  /// No description provided for @sendAgainIn.
  ///
  /// In en, this message translates to:
  /// **'Send the code again in {time}'**
  String sendAgainIn(String time);

  /// No description provided for @sendCodeAgain.
  ///
  /// In en, this message translates to:
  /// **'Send the code again'**
  String get sendCodeAgain;

  /// No description provided for @wrongNumberChange.
  ///
  /// In en, this message translates to:
  /// **'Wrong number? Change it'**
  String get wrongNumberChange;

  /// No description provided for @wrongEmailChange.
  ///
  /// In en, this message translates to:
  /// **'Wrong email? Change it'**
  String get wrongEmailChange;

  /// No description provided for @sendByEmailInstead.
  ///
  /// In en, this message translates to:
  /// **'Send the code by email instead'**
  String get sendByEmailInstead;

  /// No description provided for @sendBySmsInstead.
  ///
  /// In en, this message translates to:
  /// **'Send the code by SMS instead'**
  String get sendBySmsInstead;

  /// No description provided for @createMyAccount.
  ///
  /// In en, this message translates to:
  /// **'Create my account'**
  String get createMyAccount;

  /// No description provided for @errorCode.
  ///
  /// In en, this message translates to:
  /// **'Please enter the 6-digit code'**
  String get errorCode;

  /// No description provided for @errorInvalidCode.
  ///
  /// In en, this message translates to:
  /// **'The code is wrong or has expired. Please ask for a new one.'**
  String get errorInvalidCode;

  /// No description provided for @errorPhoneTaken.
  ///
  /// In en, this message translates to:
  /// **'This phone number is already used by another account.'**
  String get errorPhoneTaken;

  /// No description provided for @errorEmailTaken.
  ///
  /// In en, this message translates to:
  /// **'This email address is already used by another account.'**
  String get errorEmailTaken;

  /// No description provided for @errorTooManyCodes.
  ///
  /// In en, this message translates to:
  /// **'Too many codes requested. Please wait and try again.'**
  String get errorTooManyCodes;

  /// No description provided for @errorWrongCredentials.
  ///
  /// In en, this message translates to:
  /// **'The phone number or email address, password or code is not correct.'**
  String get errorWrongCredentials;

  /// No description provided for @errorSuspended.
  ///
  /// In en, this message translates to:
  /// **'This account has been suspended. Please contact support.'**
  String get errorSuspended;

  /// No description provided for @errorRegistrationsPaused.
  ///
  /// In en, this message translates to:
  /// **'New registrations are paused at the moment. Please try again later.'**
  String get errorRegistrationsPaused;

  /// No description provided for @errorInvitation.
  ///
  /// In en, this message translates to:
  /// **'This invitation link is not valid or has already been used. You can still create your account: press the button again.'**
  String get errorInvitation;

  /// No description provided for @welcomeReady.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}. Your account is ready.'**
  String welcomeReady(String name);

  /// No description provided for @confirmEmailIntro.
  ///
  /// In en, this message translates to:
  /// **'One more step: confirm your email address. Then you can save homes, set alerts for areas you like, and move on to verifying your identity.'**
  String get confirmEmailIntro;

  /// No description provided for @confirmPhoneIntro.
  ///
  /// In en, this message translates to:
  /// **'One more step: confirm your phone number. Then you can save homes, set alerts for areas you like, and move on to verifying your identity.'**
  String get confirmPhoneIntro;

  /// No description provided for @untilThenTitle.
  ///
  /// In en, this message translates to:
  /// **'Until then, you can only look around'**
  String get untilThenTitle;

  /// No description provided for @untilThenText.
  ///
  /// In en, this message translates to:
  /// **'Listings, the map and prices are open to you now.'**
  String get untilThenText;

  /// No description provided for @sendCodeToEmail.
  ///
  /// In en, this message translates to:
  /// **'Send code to my email'**
  String get sendCodeToEmail;

  /// No description provided for @sendCodeToPhone.
  ///
  /// In en, this message translates to:
  /// **'Send code to my phone'**
  String get sendCodeToPhone;

  /// No description provided for @doItLater.
  ///
  /// In en, this message translates to:
  /// **'Do it later'**
  String get doItLater;

  /// No description provided for @confirmYourEmail.
  ///
  /// In en, this message translates to:
  /// **'Confirm your email'**
  String get confirmYourEmail;

  /// No description provided for @confirmYourPhone.
  ///
  /// In en, this message translates to:
  /// **'Confirm your phone number'**
  String get confirmYourPhone;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get welcomeBack;

  /// No description provided for @signInIntro.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your phone number or email address.'**
  String get signInIntro;

  /// No description provided for @chipPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get chipPhone;

  /// No description provided for @chipEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get chipEmail;

  /// No description provided for @forgotPasswordLink.
  ///
  /// In en, this message translates to:
  /// **'Forgot your password?'**
  String get forgotPasswordLink;

  /// No description provided for @getCodeInstead.
  ///
  /// In en, this message translates to:
  /// **'Get a sign-in code instead'**
  String get getCodeInstead;

  /// No description provided for @newHere.
  ///
  /// In en, this message translates to:
  /// **'New here? Create an account'**
  String get newHere;

  /// No description provided for @pausedTitle.
  ///
  /// In en, this message translates to:
  /// **'Password sign-in is paused for 15 minutes'**
  String get pausedTitle;

  /// No description provided for @pausedHelper.
  ///
  /// In en, this message translates to:
  /// **'5 wrong passwords in a row'**
  String get pausedHelper;

  /// No description provided for @getSignInCode.
  ///
  /// In en, this message translates to:
  /// **'Get a sign-in code'**
  String get getSignInCode;

  /// No description provided for @setNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Set a new password'**
  String get setNewPassword;

  /// No description provided for @errorPasswordEmpty.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get errorPasswordEmpty;

  /// No description provided for @resetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get resetPassword;

  /// No description provided for @forgotTitle.
  ///
  /// In en, this message translates to:
  /// **'Forgot your password?'**
  String get forgotTitle;

  /// No description provided for @forgotIntro.
  ///
  /// In en, this message translates to:
  /// **'Choose where to get a code: your phone or your email. If an account uses it, we will send a 6-digit code there.'**
  String get forgotIntro;

  /// No description provided for @codeComesBySms.
  ///
  /// In en, this message translates to:
  /// **'The code comes by SMS'**
  String get codeComesBySms;

  /// No description provided for @codeComesByEmail.
  ///
  /// In en, this message translates to:
  /// **'The code comes by email'**
  String get codeComesByEmail;

  /// No description provided for @newPasswordIntro.
  ///
  /// In en, this message translates to:
  /// **'Enter the code we sent to {contact}, then choose a new password.'**
  String newPasswordIntro(String contact);

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get newPassword;

  /// No description provided for @signedOutEverywhereTitle.
  ///
  /// In en, this message translates to:
  /// **'You will be signed out everywhere'**
  String get signedOutEverywhereTitle;

  /// No description provided for @signedOutEverywhereText.
  ///
  /// In en, this message translates to:
  /// **'For your safety, every phone and computer signed in to your account is signed out. Then sign in with your new password.'**
  String get signedOutEverywhereText;

  /// No description provided for @saveNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Save new password'**
  String get saveNewPassword;

  /// No description provided for @passwordChangedTitle.
  ///
  /// In en, this message translates to:
  /// **'Your password has been changed'**
  String get passwordChangedTitle;

  /// No description provided for @passwordChangedText.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your new password.'**
  String get passwordChangedText;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @pausedTextPhone.
  ///
  /// In en, this message translates to:
  /// **'This keeps your account safe. You can still sign in now with a code sent to your phone, or set a new password.'**
  String get pausedTextPhone;

  /// No description provided for @pausedTextEmail.
  ///
  /// In en, this message translates to:
  /// **'This keeps your account safe. You can still sign in now with a code sent to your email, or set a new password.'**
  String get pausedTextEmail;
}

class _AppTextsDelegate extends LocalizationsDelegate<AppTexts> {
  const _AppTextsDelegate();

  @override
  Future<AppTexts> load(Locale locale) {
    return SynchronousFuture<AppTexts>(lookupAppTexts(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'pcm'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppTextsDelegate old) => false;
}

AppTexts lookupAppTexts(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppTextsEn();
    case 'pcm':
      return AppTextsPcm();
  }

  throw FlutterError(
    'AppTexts.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
