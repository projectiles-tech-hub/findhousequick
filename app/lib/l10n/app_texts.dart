// ignore_for_file: deprecated_member_use
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

  /// No description provided for @backToProperties.
  ///
  /// In en, this message translates to:
  /// **'Back to properties'**
  String get backToProperties;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get alreadyHaveAccount;

  /// No description provided for @whoHintWide.
  ///
  /// In en, this message translates to:
  /// **'Choose all that apply. You can add more later.'**
  String get whoHintWide;

  /// No description provided for @stepAboutYou.
  ///
  /// In en, this message translates to:
  /// **'About you'**
  String get stepAboutYou;

  /// No description provided for @stepYourDetails.
  ///
  /// In en, this message translates to:
  /// **'Your details'**
  String get stepYourDetails;

  /// No description provided for @stepConfirmPhone.
  ///
  /// In en, this message translates to:
  /// **'Confirm your phone'**
  String get stepConfirmPhone;

  /// No description provided for @stepConfirmEmail.
  ///
  /// In en, this message translates to:
  /// **'Confirm your email'**
  String get stepConfirmEmail;

  /// No description provided for @sendByEmailInsteadShort.
  ///
  /// In en, this message translates to:
  /// **'Send by email instead'**
  String get sendByEmailInsteadShort;

  /// No description provided for @sendBySmsInsteadShort.
  ///
  /// In en, this message translates to:
  /// **'Send by SMS instead'**
  String get sendBySmsInsteadShort;

  /// No description provided for @accountCreated.
  ///
  /// In en, this message translates to:
  /// **'Account created'**
  String get accountCreated;

  /// No description provided for @nextTitle.
  ///
  /// In en, this message translates to:
  /// **'What you can do next'**
  String get nextTitle;

  /// No description provided for @nextConfirmEmail.
  ///
  /// In en, this message translates to:
  /// **'Confirm your email'**
  String get nextConfirmEmail;

  /// No description provided for @nextConfirmPhone.
  ///
  /// In en, this message translates to:
  /// **'Confirm your phone number'**
  String get nextConfirmPhone;

  /// No description provided for @nextYouAreHere.
  ///
  /// In en, this message translates to:
  /// **'You are here: takes a minute'**
  String get nextYouAreHere;

  /// No description provided for @nextSave.
  ///
  /// In en, this message translates to:
  /// **'Save homes you like'**
  String get nextSave;

  /// No description provided for @nextSaveText.
  ///
  /// In en, this message translates to:
  /// **'Find them again on any device'**
  String get nextSaveText;

  /// No description provided for @nextAlerts.
  ///
  /// In en, this message translates to:
  /// **'Set alerts for an area'**
  String get nextAlerts;

  /// No description provided for @nextAlertsText.
  ///
  /// In en, this message translates to:
  /// **'Hear first when something is listed'**
  String get nextAlertsText;

  /// No description provided for @nextVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity'**
  String get nextVerify;

  /// No description provided for @nextVerifyTextEmail.
  ///
  /// In en, this message translates to:
  /// **'The next step once your email is confirmed'**
  String get nextVerifyTextEmail;

  /// No description provided for @nextVerifyTextPhone.
  ///
  /// In en, this message translates to:
  /// **'The next step once your phone number is confirmed'**
  String get nextVerifyTextPhone;

  /// No description provided for @signInIntroWide.
  ///
  /// In en, this message translates to:
  /// **'Sign in to save homes, message listers and book inspections.'**
  String get signInIntroWide;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @newHereShort.
  ///
  /// In en, this message translates to:
  /// **'New here?'**
  String get newHereShort;

  /// No description provided for @rememberedIt.
  ///
  /// In en, this message translates to:
  /// **'Remembered it?'**
  String get rememberedIt;

  /// No description provided for @backToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get backToSignIn;

  /// No description provided for @phoneCodeHelper.
  ///
  /// In en, this message translates to:
  /// **'We send a 6-digit code to this number'**
  String get phoneCodeHelper;

  /// No description provided for @everyListerChecked.
  ///
  /// In en, this message translates to:
  /// **'Every lister identity-checked'**
  String get everyListerChecked;

  /// No description provided for @propertiesAvailable.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 property available now} other{{count} properties available now}}'**
  String propertiesAvailable(int count);

  /// No description provided for @verified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verified;

  /// No description provided for @listedMinutesAgo.
  ///
  /// In en, this message translates to:
  /// **'Listed {count} min ago'**
  String listedMinutesAgo(int count);

  /// No description provided for @listedHoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Listed 1 hour ago} other{Listed {count} hours ago}}'**
  String listedHoursAgo(int count);

  /// No description provided for @listedDaysAgo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Listed 1 day ago} other{Listed {count} days ago}}'**
  String listedDaysAgo(int count);

  /// No description provided for @perYear.
  ///
  /// In en, this message translates to:
  /// **'a year'**
  String get perYear;

  /// No description provided for @perMonth.
  ///
  /// In en, this message translates to:
  /// **'a month'**
  String get perMonth;

  /// No description provided for @perWeek.
  ///
  /// In en, this message translates to:
  /// **'a week'**
  String get perWeek;

  /// No description provided for @perNight.
  ///
  /// In en, this message translates to:
  /// **'a night'**
  String get perNight;

  /// No description provided for @asOnYourId.
  ///
  /// In en, this message translates to:
  /// **'As written on your ID'**
  String get asOnYourId;

  /// No description provided for @verification.
  ///
  /// In en, this message translates to:
  /// **'Verification'**
  String get verification;

  /// No description provided for @yourVerification.
  ///
  /// In en, this message translates to:
  /// **'Your verification'**
  String get yourVerification;

  /// No description provided for @accountKindIntro.
  ///
  /// In en, this message translates to:
  /// **'{kinds} account. Each level unlocks more of FindHouseQuick.'**
  String accountKindIntro(String kinds);

  /// No description provided for @level1Title.
  ///
  /// In en, this message translates to:
  /// **'Level 1: Basic'**
  String get level1Title;

  /// No description provided for @level1Text.
  ///
  /// In en, this message translates to:
  /// **'Phone and email confirmed'**
  String get level1Text;

  /// No description provided for @level1Unlocks.
  ///
  /// In en, this message translates to:
  /// **'Look around, use the map, save homes and set alerts for areas'**
  String get level1Unlocks;

  /// No description provided for @level2Title.
  ///
  /// In en, this message translates to:
  /// **'Level 2: Verified'**
  String get level2Title;

  /// No description provided for @level2Text.
  ///
  /// In en, this message translates to:
  /// **'{idType} and a face check'**
  String level2Text(String idType);

  /// No description provided for @level2UnlocksTenant.
  ///
  /// In en, this message translates to:
  /// **'Message and call landlords and agents, and book inspections'**
  String get level2UnlocksTenant;

  /// No description provided for @level2UnlocksLister.
  ///
  /// In en, this message translates to:
  /// **'List properties, and message and call tenants'**
  String get level2UnlocksLister;

  /// No description provided for @level3Title.
  ///
  /// In en, this message translates to:
  /// **'Level 3: Payment ready'**
  String get level3Title;

  /// No description provided for @level3Text.
  ///
  /// In en, this message translates to:
  /// **'A bank account in your name'**
  String get level3Text;

  /// No description provided for @level3UnlocksTenant.
  ///
  /// In en, this message translates to:
  /// **'Pay rent safely through FindHouseQuick and sign tenancy agreements'**
  String get level3UnlocksTenant;

  /// No description provided for @level3UnlocksLister.
  ///
  /// In en, this message translates to:
  /// **'Be paid rent safely through FindHouseQuick and sign tenancy agreements'**
  String get level3UnlocksLister;

  /// No description provided for @tagDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get tagDone;

  /// No description provided for @tagNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get tagNext;

  /// No description provided for @tagLater.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get tagLater;

  /// No description provided for @tagWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting for check'**
  String get tagWaiting;

  /// No description provided for @tagApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get tagApproved;

  /// No description provided for @tagNotApproved.
  ///
  /// In en, this message translates to:
  /// **'Not approved'**
  String get tagNotApproved;

  /// No description provided for @verifyMyIdentity.
  ///
  /// In en, this message translates to:
  /// **'Verify my identity'**
  String get verifyMyIdentity;

  /// No description provided for @seeMyCheck.
  ///
  /// In en, this message translates to:
  /// **'See my check'**
  String get seeMyCheck;

  /// No description provided for @verifyYourIdentity.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity'**
  String get verifyYourIdentity;

  /// No description provided for @yourId.
  ///
  /// In en, this message translates to:
  /// **'Your {idType}'**
  String yourId(String idType);

  /// No description provided for @verifyIntro.
  ///
  /// In en, this message translates to:
  /// **'Landlords, agents and tenants all verify the same way, so everyone on FindHouseQuick is who they say they are.'**
  String get verifyIntro;

  /// No description provided for @idLabelNin.
  ///
  /// In en, this message translates to:
  /// **'NIN (National Identification Number)'**
  String get idLabelNin;

  /// No description provided for @idHelperNin.
  ///
  /// In en, this message translates to:
  /// **'11 digits, on your NIN slip. We keep it locked away and only ever show the last 4 digits.'**
  String get idHelperNin;

  /// No description provided for @idLabelOther.
  ///
  /// In en, this message translates to:
  /// **'{idType} number'**
  String idLabelOther(String idType);

  /// No description provided for @idHelperOther.
  ///
  /// In en, this message translates to:
  /// **'We keep it locked away and only ever show the last 4 digits.'**
  String get idHelperOther;

  /// No description provided for @forTheFaceCheck.
  ///
  /// In en, this message translates to:
  /// **'For the face check'**
  String get forTheFaceCheck;

  /// No description provided for @tipGoodLight.
  ///
  /// In en, this message translates to:
  /// **'Stand in good light, facing it'**
  String get tipGoodLight;

  /// No description provided for @tipNoCap.
  ///
  /// In en, this message translates to:
  /// **'Remove your cap or glasses'**
  String get tipNoCap;

  /// No description provided for @tipEyeLevel.
  ///
  /// In en, this message translates to:
  /// **'Hold your phone at eye level'**
  String get tipEyeLevel;

  /// No description provided for @identityConsent.
  ///
  /// In en, this message translates to:
  /// **'I agree that my {idType} and a photo of my face are checked against the national identity records to confirm who I am, and stored securely as the privacy policy explains.'**
  String identityConsent(String idType);

  /// No description provided for @continueToFaceCheck.
  ///
  /// In en, this message translates to:
  /// **'Continue to face check'**
  String get continueToFaceCheck;

  /// No description provided for @errorIdNumber.
  ///
  /// In en, this message translates to:
  /// **'This number does not look right. Please check it.'**
  String get errorIdNumber;

  /// No description provided for @errorIdentityConsent.
  ///
  /// In en, this message translates to:
  /// **'Please tick the box to agree before you continue'**
  String get errorIdentityConsent;

  /// No description provided for @identityUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Identity checks are not available yet'**
  String get identityUnavailableTitle;

  /// No description provided for @identityUnavailableText.
  ///
  /// In en, this message translates to:
  /// **'We will tell you as soon as you can verify your identity.'**
  String get identityUnavailableText;

  /// No description provided for @errorTooManyChecks.
  ///
  /// In en, this message translates to:
  /// **'You have reached today\'s limit of identity checks. Please try again tomorrow.'**
  String get errorTooManyChecks;

  /// No description provided for @errorProviderDown.
  ///
  /// In en, this message translates to:
  /// **'The identity check is not answering at the moment. Please try again in a little while.'**
  String get errorProviderDown;

  /// No description provided for @checkingTitle.
  ///
  /// In en, this message translates to:
  /// **'Checking your details'**
  String get checkingTitle;

  /// No description provided for @checkingText.
  ///
  /// In en, this message translates to:
  /// **'This usually takes a few minutes. You can keep using FindHouseQuick; we will send you a notification when it is done.'**
  String get checkingText;

  /// No description provided for @idEnding.
  ///
  /// In en, this message translates to:
  /// **'{idType} ending {last4}'**
  String idEnding(String idType, String last4);

  /// No description provided for @checkedAgainstRecords.
  ///
  /// In en, this message translates to:
  /// **'Checked against the national identity records, with your face check.'**
  String get checkedAgainstRecords;

  /// No description provided for @keepLookingAround.
  ///
  /// In en, this message translates to:
  /// **'Keep looking around'**
  String get keepLookingAround;

  /// No description provided for @verifiedTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re verified'**
  String get verifiedTitle;

  /// No description provided for @verifiedText.
  ///
  /// In en, this message translates to:
  /// **'Your verified badge now shows on your profile. Landlords and agents can see that you are who you say you are.'**
  String get verifiedText;

  /// No description provided for @youCanNow.
  ///
  /// In en, this message translates to:
  /// **'You can now'**
  String get youCanNow;

  /// No description provided for @canMessage.
  ///
  /// In en, this message translates to:
  /// **'Message and call landlords and agents'**
  String get canMessage;

  /// No description provided for @canBook.
  ///
  /// In en, this message translates to:
  /// **'Book inspections'**
  String get canBook;

  /// No description provided for @canSave.
  ///
  /// In en, this message translates to:
  /// **'Save homes and set area alerts'**
  String get canSave;

  /// No description provided for @canList.
  ///
  /// In en, this message translates to:
  /// **'List your properties'**
  String get canList;

  /// No description provided for @canTalkTenants.
  ///
  /// In en, this message translates to:
  /// **'Message and call tenants'**
  String get canTalkTenants;

  /// No description provided for @startLooking.
  ///
  /// In en, this message translates to:
  /// **'Start looking for a home'**
  String get startLooking;

  /// No description provided for @faceFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'The face check didn\'t work'**
  String get faceFailedTitle;

  /// No description provided for @faceFailedText.
  ///
  /// In en, this message translates to:
  /// **'Nothing is wrong with your account. The camera could not confirm a live face this time. Please try again.'**
  String get faceFailedText;

  /// No description provided for @tipsNextTry.
  ///
  /// In en, this message translates to:
  /// **'Tips for the next try'**
  String get tipsNextTry;

  /// No description provided for @tipWindow.
  ///
  /// In en, this message translates to:
  /// **'Face a window or bright light, not a light behind you'**
  String get tipWindow;

  /// No description provided for @tipStill.
  ///
  /// In en, this message translates to:
  /// **'Hold the phone still at eye level'**
  String get tipStill;

  /// No description provided for @getHelp.
  ///
  /// In en, this message translates to:
  /// **'Get help'**
  String get getHelp;

  /// No description provided for @addIdTitle.
  ///
  /// In en, this message translates to:
  /// **'Add a photo of your ID'**
  String get addIdTitle;

  /// No description provided for @addIdText.
  ///
  /// In en, this message translates to:
  /// **'We could not match your {idType} this time. A clear photo of one of these documents lets our verification team confirm who you are.'**
  String addIdText(String idType);

  /// No description provided for @whichDocument.
  ///
  /// In en, this message translates to:
  /// **'Which document?'**
  String get whichDocument;

  /// No description provided for @takePhotoFront.
  ///
  /// In en, this message translates to:
  /// **'Take a photo of the front'**
  String get takePhotoFront;

  /// No description provided for @orChooseGallery.
  ///
  /// In en, this message translates to:
  /// **'or choose one from your gallery'**
  String get orChooseGallery;

  /// No description provided for @photoChosen.
  ///
  /// In en, this message translates to:
  /// **'Photo chosen. Tap to change it.'**
  String get photoChosen;

  /// No description provided for @showCorners.
  ///
  /// In en, this message translates to:
  /// **'Show all four corners, with no glare or blur.'**
  String get showCorners;

  /// No description provided for @takeAPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get takeAPhoto;

  /// No description provided for @chooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get chooseFromGallery;

  /// No description provided for @sendForChecking.
  ///
  /// In en, this message translates to:
  /// **'Send for checking'**
  String get sendForChecking;

  /// No description provided for @errorChooseDocument.
  ///
  /// In en, this message translates to:
  /// **'Please choose which document it is'**
  String get errorChooseDocument;

  /// No description provided for @errorChoosePhoto.
  ///
  /// In en, this message translates to:
  /// **'Please add a photo of the document'**
  String get errorChoosePhoto;

  /// No description provided for @errorPhotoType.
  ///
  /// In en, this message translates to:
  /// **'Please use a JPEG or PNG photo, 20 MB at most.'**
  String get errorPhotoType;

  /// No description provided for @teamTitle.
  ///
  /// In en, this message translates to:
  /// **'A member of our team is checking'**
  String get teamTitle;

  /// No description provided for @teamText.
  ///
  /// In en, this message translates to:
  /// **'Some details need a person to look at them, for example when the name on your {idType} is spelt differently. We will notify you as soon as it is done.'**
  String teamText(String idType);

  /// No description provided for @nothingMoreTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing more is needed from you'**
  String get nothingMoreTitle;

  /// No description provided for @nothingMoreText.
  ///
  /// In en, this message translates to:
  /// **'If we need anything, we will tell you in the app and by email.'**
  String get nothingMoreText;

  /// No description provided for @checkProblemTitle.
  ///
  /// In en, this message translates to:
  /// **'The check could not be finished'**
  String get checkProblemTitle;

  /// No description provided for @checkProblemText.
  ///
  /// In en, this message translates to:
  /// **'This was a fault on our side, not yours. Please try again.'**
  String get checkProblemText;

  /// No description provided for @companyDetails.
  ///
  /// In en, this message translates to:
  /// **'Company details'**
  String get companyDetails;

  /// No description provided for @yourCompany.
  ///
  /// In en, this message translates to:
  /// **'Your company'**
  String get yourCompany;

  /// No description provided for @companyIntro.
  ///
  /// In en, this message translates to:
  /// **'If you work through a firm, add it here. Once checked, landlords and tenants see the company name on your profile.'**
  String get companyIntro;

  /// No description provided for @companyWaiting.
  ///
  /// In en, this message translates to:
  /// **'Our verification team is checking the details below. You can keep working while they do.'**
  String get companyWaiting;

  /// No description provided for @companyApproved.
  ///
  /// In en, this message translates to:
  /// **'Your company details have been checked.'**
  String get companyApproved;

  /// No description provided for @companyNotApproved.
  ///
  /// In en, this message translates to:
  /// **'Our verification team could not confirm these details. Please check them and save again.'**
  String get companyNotApproved;

  /// No description provided for @businessName.
  ///
  /// In en, this message translates to:
  /// **'Business name'**
  String get businessName;

  /// No description provided for @registrationNumber.
  ///
  /// In en, this message translates to:
  /// **'Registration number (optional)'**
  String get registrationNumber;

  /// No description provided for @registrationHelper.
  ///
  /// In en, this message translates to:
  /// **'Your company registration number, if the business is registered'**
  String get registrationHelper;

  /// No description provided for @saveCompanyDetails.
  ///
  /// In en, this message translates to:
  /// **'Save company details'**
  String get saveCompanyDetails;

  /// No description provided for @errorBusinessName.
  ///
  /// In en, this message translates to:
  /// **'Please enter the business name'**
  String get errorBusinessName;

  /// No description provided for @companyNeedsLevel2.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity first; then you can add your company.'**
  String get companyNeedsLevel2;

  /// No description provided for @sheetVerifyText.
  ///
  /// In en, this message translates to:
  /// **'Landlords and agents only talk to verified tenants, so everyone knows who they are dealing with. It takes a few minutes: your {idType} and a quick face check.'**
  String sheetVerifyText(String idType);

  /// No description provided for @verifyNow.
  ///
  /// In en, this message translates to:
  /// **'Verify now'**
  String get verifyNow;

  /// No description provided for @notNow.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get notNow;

  /// No description provided for @confirmFirst.
  ///
  /// In en, this message translates to:
  /// **'Confirm your phone number and email address first'**
  String get confirmFirst;

  /// No description provided for @goodMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning, {name}'**
  String goodMorning(String name);

  /// No description provided for @goodAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon, {name}'**
  String goodAfternoon(String name);

  /// No description provided for @goodEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening, {name}'**
  String goodEvening(String name);

  /// No description provided for @alerts.
  ///
  /// In en, this message translates to:
  /// **'Alerts'**
  String get alerts;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search area, street or landmark'**
  String get searchHint;

  /// No description provided for @homesAroundMe.
  ///
  /// In en, this message translates to:
  /// **'Homes around me'**
  String get homesAroundMe;

  /// No description provided for @homesAroundMeText.
  ///
  /// In en, this message translates to:
  /// **'See what is available near where you are now'**
  String get homesAroundMeText;

  /// No description provided for @nearYourPlaces.
  ///
  /// In en, this message translates to:
  /// **'Near your places'**
  String get nearYourPlaces;

  /// No description provided for @whatLookingFor.
  ///
  /// In en, this message translates to:
  /// **'What are you looking for?'**
  String get whatLookingFor;

  /// No description provided for @catHomes.
  ///
  /// In en, this message translates to:
  /// **'Homes to rent'**
  String get catHomes;

  /// No description provided for @catShops.
  ///
  /// In en, this message translates to:
  /// **'Shops and offices'**
  String get catShops;

  /// No description provided for @catShortLets.
  ///
  /// In en, this message translates to:
  /// **'Short lets'**
  String get catShortLets;

  /// No description provided for @catHomesShort.
  ///
  /// In en, this message translates to:
  /// **'Homes'**
  String get catHomesShort;

  /// No description provided for @newIn.
  ///
  /// In en, this message translates to:
  /// **'New in {area}'**
  String newIn(String area);

  /// No description provided for @seeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get seeAll;

  /// No description provided for @kmAway.
  ///
  /// In en, this message translates to:
  /// **'{km} km away'**
  String kmAway(String km);

  /// No description provided for @mAway.
  ///
  /// In en, this message translates to:
  /// **'{m} m away'**
  String mAway(int m);

  /// No description provided for @resultsTitleHomes.
  ///
  /// In en, this message translates to:
  /// **'Homes to rent in {place}'**
  String resultsTitleHomes(String place);

  /// No description provided for @resultsTitleShops.
  ///
  /// In en, this message translates to:
  /// **'Shops and offices in {place}'**
  String resultsTitleShops(String place);

  /// No description provided for @resultsTitleShortLets.
  ///
  /// In en, this message translates to:
  /// **'Short lets in {place}'**
  String resultsTitleShortLets(String place);

  /// No description provided for @resultsTitleAll.
  ///
  /// In en, this message translates to:
  /// **'Properties in {place}'**
  String resultsTitleAll(String place);

  /// No description provided for @aroundYou.
  ///
  /// In en, this message translates to:
  /// **'around you'**
  String get aroundYou;

  /// No description provided for @nearPlace.
  ///
  /// In en, this message translates to:
  /// **'near {place}'**
  String nearPlace(String place);

  /// No description provided for @resultsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 home, every lister identity-checked. Inspections are always free.} other{{count} homes, every lister identity-checked. Inspections are always free.}}'**
  String resultsSubtitle(int count);

  /// No description provided for @sortLabel.
  ///
  /// In en, this message translates to:
  /// **'Sort: {how}'**
  String sortLabel(String how);

  /// No description provided for @sortNewest.
  ///
  /// In en, this message translates to:
  /// **'Newest first'**
  String get sortNewest;

  /// No description provided for @sortNearest.
  ///
  /// In en, this message translates to:
  /// **'Nearest first'**
  String get sortNearest;

  /// No description provided for @sortCheapest.
  ///
  /// In en, this message translates to:
  /// **'Lowest price first'**
  String get sortCheapest;

  /// No description provided for @sortDearest.
  ///
  /// In en, this message translates to:
  /// **'Highest price first'**
  String get sortDearest;

  /// No description provided for @anyPrice.
  ///
  /// In en, this message translates to:
  /// **'Any price'**
  String get anyPrice;

  /// No description provided for @bedroomsFilter.
  ///
  /// In en, this message translates to:
  /// **'Bedrooms'**
  String get bedroomsFilter;

  /// No description provided for @furnishedFilter.
  ///
  /// In en, this message translates to:
  /// **'Furnished'**
  String get furnishedFilter;

  /// No description provided for @moreFilters.
  ///
  /// In en, this message translates to:
  /// **'More filters'**
  String get moreFilters;

  /// No description provided for @perYearShort.
  ///
  /// In en, this message translates to:
  /// **'/year'**
  String get perYearShort;

  /// No description provided for @perMonthShort.
  ///
  /// In en, this message translates to:
  /// **'/month'**
  String get perMonthShort;

  /// No description provided for @perWeekShort.
  ///
  /// In en, this message translates to:
  /// **'/week'**
  String get perWeekShort;

  /// No description provided for @perNightShort.
  ///
  /// In en, this message translates to:
  /// **'/night'**
  String get perNightShort;

  /// No description provided for @beds.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 bed} other{{count} beds}}'**
  String beds(int count);

  /// No description provided for @rooms.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 room} other{{count} rooms}}'**
  String rooms(int count);

  /// No description provided for @baths.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 bath} other{{count} baths}}'**
  String baths(int count);

  /// No description provided for @verifiedLister.
  ///
  /// In en, this message translates to:
  /// **'Verified lister'**
  String get verifiedLister;

  /// No description provided for @ownerVerified.
  ///
  /// In en, this message translates to:
  /// **'Owner verified'**
  String get ownerVerified;

  /// No description provided for @saveHome.
  ///
  /// In en, this message translates to:
  /// **'Save this home'**
  String get saveHome;

  /// No description provided for @unsaveHome.
  ///
  /// In en, this message translates to:
  /// **'Remove from saved'**
  String get unsaveHome;

  /// No description provided for @getAlertsTitle.
  ///
  /// In en, this message translates to:
  /// **'Get alerts for this search'**
  String get getAlertsTitle;

  /// No description provided for @getAlertsText.
  ///
  /// In en, this message translates to:
  /// **'We tell you the moment a new home {place} matches this search.'**
  String getAlertsText(String place);

  /// No description provided for @saveThisSearch.
  ///
  /// In en, this message translates to:
  /// **'Save this search'**
  String get saveThisSearch;

  /// No description provided for @showingOf.
  ///
  /// In en, this message translates to:
  /// **'Showing {shown} of {total} homes'**
  String showingOf(int shown, int total);

  /// No description provided for @showMoreHomes.
  ///
  /// In en, this message translates to:
  /// **'Show more homes'**
  String get showMoreHomes;

  /// No description provided for @whyRentTitle.
  ///
  /// In en, this message translates to:
  /// **'Why rent on FindHouseQuick'**
  String get whyRentTitle;

  /// No description provided for @whyRent1.
  ///
  /// In en, this message translates to:
  /// **'Every landlord and agent has proved who they are'**
  String get whyRent1;

  /// No description provided for @whyRent2.
  ///
  /// In en, this message translates to:
  /// **'Inspections are always free'**
  String get whyRent2;

  /// No description provided for @whyRent3.
  ///
  /// In en, this message translates to:
  /// **'Rent and every fee are shown before you call'**
  String get whyRent3;

  /// No description provided for @whyRent4.
  ///
  /// In en, this message translates to:
  /// **'Photos taken on site, room by room'**
  String get whyRent4;

  /// No description provided for @newlyListedIn.
  ///
  /// In en, this message translates to:
  /// **'Newly listed in {place}'**
  String newlyListedIn(String place);

  /// No description provided for @addedLast7Days.
  ///
  /// In en, this message translates to:
  /// **'Added in the last 7 days'**
  String get addedLast7Days;

  /// No description provided for @seeAllNew.
  ///
  /// In en, this message translates to:
  /// **'See all new homes'**
  String get seeAllNew;

  /// No description provided for @popularAreasIn.
  ///
  /// In en, this message translates to:
  /// **'Popular areas in {place}'**
  String popularAreasIn(String place);

  /// No description provided for @areaWithCount.
  ///
  /// In en, this message translates to:
  /// **'{area} ({count})'**
  String areaWithCount(String area, int count);

  /// No description provided for @filters.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get filters;

  /// No description provided for @clearAll.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get clearAll;

  /// No description provided for @lookingFor.
  ///
  /// In en, this message translates to:
  /// **'Looking for'**
  String get lookingFor;

  /// No description provided for @rentPerYear.
  ///
  /// In en, this message translates to:
  /// **'Rent per year'**
  String get rentPerYear;

  /// No description provided for @pricePerNight.
  ///
  /// In en, this message translates to:
  /// **'Price per night'**
  String get pricePerNight;

  /// No description provided for @lowest.
  ///
  /// In en, this message translates to:
  /// **'Lowest'**
  String get lowest;

  /// No description provided for @highest.
  ///
  /// In en, this message translates to:
  /// **'Highest'**
  String get highest;

  /// No description provided for @noMinimum.
  ///
  /// In en, this message translates to:
  /// **'No minimum'**
  String get noMinimum;

  /// No description provided for @noMaximum.
  ///
  /// In en, this message translates to:
  /// **'No maximum'**
  String get noMaximum;

  /// No description provided for @bedroomsAny.
  ///
  /// In en, this message translates to:
  /// **'Any'**
  String get bedroomsAny;

  /// No description provided for @bedroomsAtLeast.
  ///
  /// In en, this message translates to:
  /// **'{n}+'**
  String bedroomsAtLeast(int n);

  /// No description provided for @propertyType.
  ///
  /// In en, this message translates to:
  /// **'Property type'**
  String get propertyType;

  /// No description provided for @furnishing.
  ///
  /// In en, this message translates to:
  /// **'Furnishing'**
  String get furnishing;

  /// No description provided for @furnUNFURNISHED.
  ///
  /// In en, this message translates to:
  /// **'Unfurnished'**
  String get furnUNFURNISHED;

  /// No description provided for @furnSEMI_FURNISHED.
  ///
  /// In en, this message translates to:
  /// **'Semi-furnished'**
  String get furnSEMI_FURNISHED;

  /// No description provided for @furnFURNISHED.
  ///
  /// In en, this message translates to:
  /// **'Furnished'**
  String get furnFURNISHED;

  /// No description provided for @verifiedOnly.
  ///
  /// In en, this message translates to:
  /// **'Verified listers only'**
  String get verifiedOnly;

  /// No description provided for @verifiedOnlyText.
  ///
  /// In en, this message translates to:
  /// **'Owner or authority checked by our team'**
  String get verifiedOnlyText;

  /// No description provided for @showHomes.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No homes match} =1{Show 1 home} other{Show {count} homes}}'**
  String showHomes(int count);

  /// No description provided for @errorRentRange.
  ///
  /// In en, this message translates to:
  /// **'The lowest rent must be less than the highest'**
  String get errorRentRange;

  /// No description provided for @places.
  ///
  /// In en, this message translates to:
  /// **'Places'**
  String get places;

  /// No description provided for @recentSearches.
  ///
  /// In en, this message translates to:
  /// **'Recent searches'**
  String get recentSearches;

  /// No description provided for @clearSearch.
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get clearSearch;

  /// No description provided for @landmarkHint.
  ///
  /// In en, this message translates to:
  /// **'Many addresses are not exact, so search by a landmark people know and set how far from it to look.'**
  String get landmarkHint;

  /// No description provided for @howFar.
  ///
  /// In en, this message translates to:
  /// **'How far from it'**
  String get howFar;

  /// No description provided for @withinM.
  ///
  /// In en, this message translates to:
  /// **'{m} m'**
  String withinM(int m);

  /// No description provided for @withinKm.
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String withinKm(int km);

  /// No description provided for @placeWithin.
  ///
  /// In en, this message translates to:
  /// **'{place} · {distance}'**
  String placeWithin(String place, String distance);

  /// No description provided for @noPlacesFound.
  ///
  /// In en, this message translates to:
  /// **'No places match. Try the name of an area or a landmark nearby.'**
  String get noPlacesFound;

  /// No description provided for @noResultsTitle.
  ///
  /// In en, this message translates to:
  /// **'No homes match yet'**
  String get noResultsTitle;

  /// No description provided for @noResultsTextNear.
  ///
  /// In en, this message translates to:
  /// **'Nothing within {distance} of {place} fits all your filters right now. Try one of these, or get an alert when a match is listed.'**
  String noResultsTextNear(String distance, String place);

  /// No description provided for @noResultsTextArea.
  ///
  /// In en, this message translates to:
  /// **'Nothing in {place} fits all your filters right now. Try one of these, or get an alert when a match is listed.'**
  String noResultsTextArea(String place);

  /// No description provided for @searchUpTo.
  ///
  /// In en, this message translates to:
  /// **'Search up to {distance} away ({count} homes)'**
  String searchUpTo(String distance, int count);

  /// No description provided for @removeFilter.
  ///
  /// In en, this message translates to:
  /// **'Remove the {filter} filter ({count} homes)'**
  String removeFilter(String filter, int count);

  /// No description provided for @removeAllFilters.
  ///
  /// In en, this message translates to:
  /// **'Remove all filters ({count} homes)'**
  String removeAllFilters(int count);

  /// No description provided for @alertMeWhenListed.
  ///
  /// In en, this message translates to:
  /// **'Alert me when one is listed'**
  String get alertMeWhenListed;

  /// No description provided for @saveThisArea.
  ///
  /// In en, this message translates to:
  /// **'Save this area'**
  String get saveThisArea;

  /// No description provided for @nameThisSearch.
  ///
  /// In en, this message translates to:
  /// **'Name this search'**
  String get nameThisSearch;

  /// No description provided for @matching.
  ///
  /// In en, this message translates to:
  /// **'Matching'**
  String get matching;

  /// No description provided for @alertMeHere.
  ///
  /// In en, this message translates to:
  /// **'Alert me about new homes here'**
  String get alertMeHere;

  /// No description provided for @alertMeHereText.
  ///
  /// In en, this message translates to:
  /// **'By notification, as set in your notification settings'**
  String get alertMeHereText;

  /// No description provided for @saveArea.
  ///
  /// In en, this message translates to:
  /// **'Save area'**
  String get saveArea;

  /// No description provided for @areaSaved.
  ///
  /// In en, this message translates to:
  /// **'Area saved. We will tell you when a matching home is listed.'**
  String get areaSaved;

  /// No description provided for @errorSearchName.
  ///
  /// In en, this message translates to:
  /// **'Please give this search a name'**
  String get errorSearchName;

  /// No description provided for @errorTooManyAreas.
  ///
  /// In en, this message translates to:
  /// **'You have saved the most areas allowed. Delete one in Saved to add another.'**
  String get errorTooManyAreas;

  /// No description provided for @withinOf.
  ///
  /// In en, this message translates to:
  /// **'Within {distance} of {place}'**
  String withinOf(String distance, String place);

  /// No description provided for @upToRent.
  ///
  /// In en, this message translates to:
  /// **'Up to {amount} a year'**
  String upToRent(String amount);

  /// No description provided for @fromRent.
  ///
  /// In en, this message translates to:
  /// **'From {amount} a year'**
  String fromRent(String amount);

  /// No description provided for @bedroomsPlus.
  ///
  /// In en, this message translates to:
  /// **'{n}+ bedrooms'**
  String bedroomsPlus(int n);

  /// No description provided for @homesIn.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 home in {place}} other{{count} homes in {place}}}'**
  String homesIn(int count, String place);

  /// No description provided for @seeEveryPhotoTitle.
  ///
  /// In en, this message translates to:
  /// **'See every photo, the map and distances'**
  String get seeEveryPhotoTitle;

  /// No description provided for @seeEveryPhotoText.
  ///
  /// In en, this message translates to:
  /// **'Create a free account to see every photo, the map and distances, and to save homes.'**
  String get seeEveryPhotoText;

  /// No description provided for @createFreeAccount.
  ///
  /// In en, this message translates to:
  /// **'Create a free account'**
  String get createFreeAccount;

  /// No description provided for @locationTitle.
  ///
  /// In en, this message translates to:
  /// **'Show homes around you?'**
  String get locationTitle;

  /// No description provided for @locationText.
  ///
  /// In en, this message translates to:
  /// **'FindHouseQuick uses your phone\'s location to show homes near where you are, and how far each one is.'**
  String get locationText;

  /// No description provided for @locationPoint1.
  ///
  /// In en, this message translates to:
  /// **'Only while you use the app'**
  String get locationPoint1;

  /// No description provided for @locationPoint2.
  ///
  /// In en, this message translates to:
  /// **'Never saved or shared with landlords'**
  String get locationPoint2;

  /// No description provided for @locationPoint3.
  ///
  /// In en, this message translates to:
  /// **'You can turn it off at any time in your phone settings'**
  String get locationPoint3;

  /// No description provided for @allowLocation.
  ///
  /// In en, this message translates to:
  /// **'Allow location'**
  String get allowLocation;

  /// No description provided for @searchByAreaInstead.
  ///
  /// In en, this message translates to:
  /// **'Search by area instead'**
  String get searchByAreaInstead;

  /// No description provided for @locationDenied.
  ///
  /// In en, this message translates to:
  /// **'Location is turned off for FindHouseQuick. You can turn it on in your phone settings, or search by area.'**
  String get locationDenied;

  /// No description provided for @locationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your location could not be found. Search by area instead.'**
  String get locationUnavailable;

  /// No description provided for @openSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get openSettings;

  /// No description provided for @searchFailed.
  ///
  /// In en, this message translates to:
  /// **'The homes could not be loaded. Check your connection and try again.'**
  String get searchFailed;

  /// No description provided for @signInToSave.
  ///
  /// In en, this message translates to:
  /// **'Sign in to save homes'**
  String get signInToSave;

  /// No description provided for @beingBuiltTitle.
  ///
  /// In en, this message translates to:
  /// **'This part of the app is on its way'**
  String get beingBuiltTitle;

  /// No description provided for @beingBuiltText.
  ///
  /// In en, this message translates to:
  /// **'It is being built now and arrives in a coming update.'**
  String get beingBuiltText;

  /// No description provided for @noHomesYet.
  ///
  /// In en, this message translates to:
  /// **'No homes are listed here yet.'**
  String get noHomesYet;

  /// No description provided for @bedroomsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 bedroom} other{{count} bedrooms}}'**
  String bedroomsCount(int count);

  /// No description provided for @toiletsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 toilet} other{{count} toilets}}'**
  String toiletsCount(int count);

  /// No description provided for @feeAgency.
  ///
  /// In en, this message translates to:
  /// **'Agency fee'**
  String get feeAgency;

  /// No description provided for @feeLegal.
  ///
  /// In en, this message translates to:
  /// **'Legal or agreement fee'**
  String get feeLegal;

  /// No description provided for @feeCaution.
  ///
  /// In en, this message translates to:
  /// **'Caution deposit'**
  String get feeCaution;

  /// No description provided for @feeService.
  ///
  /// In en, this message translates to:
  /// **'Service charge'**
  String get feeService;

  /// No description provided for @groundFloor.
  ///
  /// In en, this message translates to:
  /// **'Ground floor'**
  String get groundFloor;

  /// No description provided for @basement.
  ///
  /// In en, this message translates to:
  /// **'Basement'**
  String get basement;

  /// No description provided for @floorNumber.
  ///
  /// In en, this message translates to:
  /// **'{n, select, 1{First floor} 2{Second floor} 3{Third floor} 4{Fourth floor} 5{Fifth floor} 6{Sixth floor} 7{Seventh floor} 8{Eighth floor} 9{Ninth floor} 10{Tenth floor} other{Floor {n}}}'**
  String floorNumber(String n);

  /// No description provided for @factBedrooms.
  ///
  /// In en, this message translates to:
  /// **'Bedrooms'**
  String get factBedrooms;

  /// No description provided for @factBathrooms.
  ///
  /// In en, this message translates to:
  /// **'Bathrooms'**
  String get factBathrooms;

  /// No description provided for @factToilets.
  ///
  /// In en, this message translates to:
  /// **'Toilets'**
  String get factToilets;

  /// No description provided for @factFloor.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get factFloor;

  /// No description provided for @factFloorArea.
  ///
  /// In en, this message translates to:
  /// **'Floor area'**
  String get factFloorArea;

  /// No description provided for @factAvailableFrom.
  ///
  /// In en, this message translates to:
  /// **'Available from'**
  String get factAvailableFrom;

  /// No description provided for @factPhotosTaken.
  ///
  /// In en, this message translates to:
  /// **'Photos taken'**
  String get factPhotosTaken;

  /// No description provided for @whoCanRent.
  ///
  /// In en, this message translates to:
  /// **'Who can rent'**
  String get whoCanRent;

  /// No description provided for @verifyToBook.
  ///
  /// In en, this message translates to:
  /// **'Verify to book an inspection'**
  String get verifyToBook;

  /// No description provided for @verifyToChat.
  ///
  /// In en, this message translates to:
  /// **'Verify to chat with the lister'**
  String get verifyToChat;

  /// No description provided for @homeGoneTitle.
  ///
  /// In en, this message translates to:
  /// **'This home is no longer listed'**
  String get homeGoneTitle;

  /// No description provided for @homeGoneText.
  ///
  /// In en, this message translates to:
  /// **'It may have been rented, or the lister took it down. There are more homes like it.'**
  String get homeGoneText;

  /// No description provided for @viewLimitTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to keep viewing homes'**
  String get viewLimitTitle;

  /// No description provided for @viewLimitText.
  ///
  /// In en, this message translates to:
  /// **'You have opened a great many homes this hour. Create a free account or sign in to carry on.'**
  String get viewLimitText;

  /// No description provided for @inspectionsAreFree.
  ///
  /// In en, this message translates to:
  /// **'Inspections are free'**
  String get inspectionsAreFree;

  /// No description provided for @bookFreeInspection.
  ///
  /// In en, this message translates to:
  /// **'Book a free inspection'**
  String get bookFreeInspection;

  /// No description provided for @chatWithLister.
  ///
  /// In en, this message translates to:
  /// **'Chat with the lister'**
  String get chatWithLister;

  /// No description provided for @whatYouPay.
  ///
  /// In en, this message translates to:
  /// **'What you pay'**
  String get whatYouPay;

  /// No description provided for @totalToMoveIn.
  ///
  /// In en, this message translates to:
  /// **'Total to move in'**
  String get totalToMoveIn;

  /// No description provided for @totalLabel.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get totalLabel;

  /// No description provided for @rentOneYear.
  ///
  /// In en, this message translates to:
  /// **'1 year'**
  String get rentOneYear;

  /// No description provided for @rentOneMonth.
  ///
  /// In en, this message translates to:
  /// **'1 month'**
  String get rentOneMonth;

  /// No description provided for @rentOneWeek.
  ///
  /// In en, this message translates to:
  /// **'1 week'**
  String get rentOneWeek;

  /// No description provided for @rentOneNight.
  ///
  /// In en, this message translates to:
  /// **'1 night'**
  String get rentOneNight;

  /// No description provided for @rentFor.
  ///
  /// In en, this message translates to:
  /// **'Rent ({period})'**
  String rentFor(String period);

  /// No description provided for @noHiddenFees.
  ///
  /// In en, this message translates to:
  /// **'Inspections are free. No fee may be charged that is not shown here.'**
  String get noHiddenFees;

  /// No description provided for @verifiedLandlord.
  ///
  /// In en, this message translates to:
  /// **'Verified landlord'**
  String get verifiedLandlord;

  /// No description provided for @verifiedAgent.
  ///
  /// In en, this message translates to:
  /// **'Verified agent'**
  String get verifiedAgent;

  /// No description provided for @repliesMinutes.
  ///
  /// In en, this message translates to:
  /// **'Usually replies within {n} minutes'**
  String repliesMinutes(int n);

  /// No description provided for @repliesHours.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{Usually replies within 1 hour} other{Usually replies within {n} hours}}'**
  String repliesHours(int n);

  /// No description provided for @photosByRoom.
  ///
  /// In en, this message translates to:
  /// **'Photos by room'**
  String get photosByRoom;

  /// No description provided for @video.
  ///
  /// In en, this message translates to:
  /// **'Video'**
  String get video;

  /// No description provided for @walkthroughVideo.
  ///
  /// In en, this message translates to:
  /// **'Walkthrough video'**
  String get walkthroughVideo;

  /// No description provided for @walkthroughText.
  ///
  /// In en, this message translates to:
  /// **'One continuous take through the whole home'**
  String get walkthroughText;

  /// No description provided for @keyDetails.
  ///
  /// In en, this message translates to:
  /// **'Key details'**
  String get keyDetails;

  /// No description provided for @aboutThisHome.
  ///
  /// In en, this message translates to:
  /// **'About this home'**
  String get aboutThisHome;

  /// No description provided for @location.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get location;

  /// No description provided for @approximateArea.
  ///
  /// In en, this message translates to:
  /// **'Approximate area'**
  String get approximateArea;

  /// No description provided for @exactAddressLater.
  ///
  /// In en, this message translates to:
  /// **'The exact address and directions are shared once an inspection is confirmed.'**
  String get exactAddressLater;

  /// No description provided for @homesGoQuickly.
  ///
  /// In en, this message translates to:
  /// **'Homes like this go quickly'**
  String get homesGoQuickly;

  /// No description provided for @alertSimilarIn.
  ///
  /// In en, this message translates to:
  /// **'Get an alert when a similar home is listed in {area}.'**
  String alertSimilarIn(String area);

  /// No description provided for @getAlertsFor.
  ///
  /// In en, this message translates to:
  /// **'Get alerts for {area}'**
  String getAlertsFor(String area);

  /// No description provided for @similarHomesNearby.
  ///
  /// In en, this message translates to:
  /// **'Similar homes nearby'**
  String get similarHomesNearby;

  /// No description provided for @similarHomesText.
  ///
  /// In en, this message translates to:
  /// **'{n} bedroom homes at a similar rent'**
  String similarHomesText(int n);

  /// No description provided for @seeAllSimilar.
  ///
  /// In en, this message translates to:
  /// **'See all similar homes'**
  String get seeAllSimilar;

  /// No description provided for @moreHomesIn.
  ///
  /// In en, this message translates to:
  /// **'More homes in {area}'**
  String moreHomesIn(String area);

  /// No description provided for @seeAllHomesIn.
  ///
  /// In en, this message translates to:
  /// **'See all homes in {area}'**
  String seeAllHomesIn(String area);

  /// No description provided for @moreFromUs.
  ///
  /// In en, this message translates to:
  /// **'More from FindHouseQuick'**
  String get moreFromUs;

  /// No description provided for @moreChecked.
  ///
  /// In en, this message translates to:
  /// **'Identity-checked listers'**
  String get moreChecked;

  /// No description provided for @moreCheckedText.
  ///
  /// In en, this message translates to:
  /// **'Every landlord and agent proves who they are before a home goes live.'**
  String get moreCheckedText;

  /// No description provided for @moreCheckedLink.
  ///
  /// In en, this message translates to:
  /// **'How we check'**
  String get moreCheckedLink;

  /// No description provided for @moreFree.
  ///
  /// In en, this message translates to:
  /// **'Free inspections'**
  String get moreFree;

  /// No description provided for @moreFreeText.
  ///
  /// In en, this message translates to:
  /// **'Book a time in the app. Nobody may charge you to see a home.'**
  String get moreFreeText;

  /// No description provided for @moreFreeLink.
  ///
  /// In en, this message translates to:
  /// **'Booking an inspection'**
  String get moreFreeLink;

  /// No description provided for @moreList.
  ///
  /// In en, this message translates to:
  /// **'List your property free'**
  String get moreList;

  /// No description provided for @moreListText.
  ///
  /// In en, this message translates to:
  /// **'Landlords and agents list for free and manage tenants, rent and receipts.'**
  String get moreListText;

  /// No description provided for @moreListLink.
  ///
  /// In en, this message translates to:
  /// **'List your property'**
  String get moreListLink;

  /// No description provided for @moreScout.
  ///
  /// In en, this message translates to:
  /// **'Become a scout'**
  String get moreScout;

  /// No description provided for @moreScoutText.
  ///
  /// In en, this message translates to:
  /// **'Spot a vacant property, invite the landlord, and earn a reward when it is rented.'**
  String get moreScoutText;

  /// No description provided for @moreScoutLink.
  ///
  /// In en, this message translates to:
  /// **'Start scouting'**
  String get moreScoutLink;

  /// No description provided for @seeAllPhotos.
  ///
  /// In en, this message translates to:
  /// **'See all {n} photos'**
  String seeAllPhotos(int n);

  /// No description provided for @share.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get share;

  /// No description provided for @compare.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get compare;

  /// No description provided for @report.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get report;

  /// No description provided for @approximatePlace.
  ///
  /// In en, this message translates to:
  /// **'{place} (approximate area)'**
  String approximatePlace(String place);

  /// No description provided for @searchButton.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get searchButton;

  /// No description provided for @everyListerProves.
  ///
  /// In en, this message translates to:
  /// **'Every landlord and agent proves who they are before they can list'**
  String get everyListerProves;

  /// No description provided for @listYourProperty.
  ///
  /// In en, this message translates to:
  /// **'List your property'**
  String get listYourProperty;

  /// No description provided for @becomeScout.
  ///
  /// In en, this message translates to:
  /// **'Become a scout'**
  String get becomeScout;

  /// No description provided for @help.
  ///
  /// In en, this message translates to:
  /// **'Help'**
  String get help;

  /// No description provided for @homesToRent.
  ///
  /// In en, this message translates to:
  /// **'Homes to rent'**
  String get homesToRent;

  /// No description provided for @footerFind.
  ///
  /// In en, this message translates to:
  /// **'Find a place'**
  String get footerFind;

  /// No description provided for @footerList.
  ///
  /// In en, this message translates to:
  /// **'List and earn'**
  String get footerList;

  /// No description provided for @listAProperty.
  ///
  /// In en, this message translates to:
  /// **'List a property'**
  String get listAProperty;

  /// No description provided for @forAgents.
  ///
  /// In en, this message translates to:
  /// **'For agents'**
  String get forAgents;

  /// No description provided for @helpCentre.
  ///
  /// In en, this message translates to:
  /// **'Help centre'**
  String get helpCentre;

  /// No description provided for @reportAListing.
  ///
  /// In en, this message translates to:
  /// **'Report a listing'**
  String get reportAListing;

  /// No description provided for @termsOfUse.
  ///
  /// In en, this message translates to:
  /// **'Terms of use'**
  String get termsOfUse;

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy'**
  String get privacyPolicy;

  /// No description provided for @footerAbout.
  ///
  /// In en, this message translates to:
  /// **'Houses, flats, shops and short lets to rent, from landlords and agents whose identity we have checked.'**
  String get footerAbout;

  /// No description provided for @copyright.
  ///
  /// In en, this message translates to:
  /// **'© {year} Projectiles Tech Hub Limited'**
  String copyright(String year);

  /// No description provided for @crumbHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get crumbHome;

  /// No description provided for @savedLabel.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get savedLabel;

  /// No description provided for @saveLabel.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveLabel;

  /// No description provided for @periodPerYear.
  ///
  /// In en, this message translates to:
  /// **'per year'**
  String get periodPerYear;

  /// No description provided for @periodPerMonth.
  ///
  /// In en, this message translates to:
  /// **'per month'**
  String get periodPerMonth;

  /// No description provided for @periodPerWeek.
  ///
  /// In en, this message translates to:
  /// **'per week'**
  String get periodPerWeek;

  /// No description provided for @periodPerNight.
  ///
  /// In en, this message translates to:
  /// **'per night'**
  String get periodPerNight;

  /// No description provided for @onSince.
  ///
  /// In en, this message translates to:
  /// **'On FindHouseQuick since {month}'**
  String onSince(String month);

  /// No description provided for @photosByRoomText.
  ///
  /// In en, this message translates to:
  /// **'Every part of the home, photographed on site through the FindHouseQuick app.'**
  String get photosByRoomText;

  /// No description provided for @nearby.
  ///
  /// In en, this message translates to:
  /// **'Nearby'**
  String get nearby;
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
