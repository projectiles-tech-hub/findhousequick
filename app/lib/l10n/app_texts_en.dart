// ignore_for_file: deprecated_member_use

// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_texts.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppTextsEn extends AppTexts {
  AppTextsEn([String locale = 'en']) : super(locale);

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

  @override
  String get backToProperties => 'Back to properties';

  @override
  String get alreadyHaveAccount => 'Already have an account?';

  @override
  String get whoHintWide => 'Choose all that apply. You can add more later.';

  @override
  String get stepAboutYou => 'About you';

  @override
  String get stepYourDetails => 'Your details';

  @override
  String get stepConfirmPhone => 'Confirm your phone';

  @override
  String get stepConfirmEmail => 'Confirm your email';

  @override
  String get sendByEmailInsteadShort => 'Send by email instead';

  @override
  String get sendBySmsInsteadShort => 'Send by SMS instead';

  @override
  String get accountCreated => 'Account created';

  @override
  String get nextTitle => 'What you can do next';

  @override
  String get nextConfirmEmail => 'Confirm your email';

  @override
  String get nextConfirmPhone => 'Confirm your phone number';

  @override
  String get nextYouAreHere => 'You are here: takes a minute';

  @override
  String get nextSave => 'Save homes you like';

  @override
  String get nextSaveText => 'Find them again on any device';

  @override
  String get nextAlerts => 'Set alerts for an area';

  @override
  String get nextAlertsText => 'Hear first when something is listed';

  @override
  String get nextVerify => 'Verify your identity';

  @override
  String get nextVerifyTextEmail =>
      'The next step once your email is confirmed';

  @override
  String get nextVerifyTextPhone =>
      'The next step once your phone number is confirmed';

  @override
  String get signInIntroWide =>
      'Sign in to save homes, message listers and book inspections.';

  @override
  String get close => 'Close';

  @override
  String get newHereShort => 'New here?';

  @override
  String get rememberedIt => 'Remembered it?';

  @override
  String get backToSignIn => 'Back to sign in';

  @override
  String get phoneCodeHelper => 'We send a 6-digit code to this number';

  @override
  String get everyListerChecked => 'Every lister identity-checked';

  @override
  String propertiesAvailable(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count properties available now',
      one: '1 property available now',
    );
    return '$_temp0';
  }

  @override
  String get verified => 'Verified';

  @override
  String listedMinutesAgo(int count) {
    return 'Listed $count min ago';
  }

  @override
  String listedHoursAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Listed $count hours ago',
      one: 'Listed 1 hour ago',
    );
    return '$_temp0';
  }

  @override
  String listedDaysAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Listed $count days ago',
      one: 'Listed 1 day ago',
    );
    return '$_temp0';
  }

  @override
  String get perYear => 'a year';

  @override
  String get perMonth => 'a month';

  @override
  String get perWeek => 'a week';

  @override
  String get perNight => 'a night';

  @override
  String get asOnYourId => 'As written on your ID';

  @override
  String get verification => 'Verification';

  @override
  String get yourVerification => 'Your verification';

  @override
  String accountKindIntro(String kinds) {
    return '$kinds account. Each level unlocks more of FindHouseQuick.';
  }

  @override
  String get level1Title => 'Level 1: Basic';

  @override
  String get level1Text => 'Phone and email confirmed';

  @override
  String get level1Unlocks =>
      'Look around, use the map, save homes and set alerts for areas';

  @override
  String get level2Title => 'Level 2: Verified';

  @override
  String level2Text(String idType) {
    return '$idType and a face check';
  }

  @override
  String get level2UnlocksTenant =>
      'Message and call landlords and agents, and book inspections';

  @override
  String get level2UnlocksLister =>
      'List properties, and message and call tenants';

  @override
  String get level3Title => 'Level 3: Payment ready';

  @override
  String get level3Text => 'A bank account in your name';

  @override
  String get level3UnlocksTenant =>
      'Pay rent safely through FindHouseQuick and sign tenancy agreements';

  @override
  String get level3UnlocksLister =>
      'Be paid rent safely through FindHouseQuick and sign tenancy agreements';

  @override
  String get tagDone => 'Done';

  @override
  String get tagNext => 'Next';

  @override
  String get tagLater => 'Later';

  @override
  String get tagWaiting => 'Waiting for check';

  @override
  String get tagApproved => 'Approved';

  @override
  String get tagNotApproved => 'Not approved';

  @override
  String get verifyMyIdentity => 'Verify my identity';

  @override
  String get seeMyCheck => 'See my check';

  @override
  String get verifyYourIdentity => 'Verify your identity';

  @override
  String yourId(String idType) {
    return 'Your $idType';
  }

  @override
  String get verifyIntro =>
      'Landlords, agents and tenants all verify the same way, so everyone on FindHouseQuick is who they say they are.';

  @override
  String get idLabelNin => 'NIN (National Identification Number)';

  @override
  String get idHelperNin =>
      '11 digits, on your NIN slip. We keep it locked away and only ever show the last 4 digits.';

  @override
  String idLabelOther(String idType) {
    return '$idType number';
  }

  @override
  String get idHelperOther =>
      'We keep it locked away and only ever show the last 4 digits.';

  @override
  String get forTheFaceCheck => 'For the face check';

  @override
  String get tipGoodLight => 'Stand in good light, facing it';

  @override
  String get tipNoCap => 'Remove your cap or glasses';

  @override
  String get tipEyeLevel => 'Hold your phone at eye level';

  @override
  String identityConsent(String idType) {
    return 'I agree that my $idType and a photo of my face are checked against the national identity records to confirm who I am, and stored securely as the privacy policy explains.';
  }

  @override
  String get continueToFaceCheck => 'Continue to face check';

  @override
  String get errorIdNumber =>
      'This number does not look right. Please check it.';

  @override
  String get errorIdentityConsent =>
      'Please tick the box to agree before you continue';

  @override
  String get identityUnavailableTitle =>
      'Identity checks are not available yet';

  @override
  String get identityUnavailableText =>
      'We will tell you as soon as you can verify your identity.';

  @override
  String get errorTooManyChecks =>
      'You have reached today\'s limit of identity checks. Please try again tomorrow.';

  @override
  String get errorProviderDown =>
      'The identity check is not answering at the moment. Please try again in a little while.';

  @override
  String get checkingTitle => 'Checking your details';

  @override
  String get checkingText =>
      'This usually takes a few minutes. You can keep using FindHouseQuick; we will send you a notification when it is done.';

  @override
  String idEnding(String idType, String last4) {
    return '$idType ending $last4';
  }

  @override
  String get checkedAgainstRecords =>
      'Checked against the national identity records, with your face check.';

  @override
  String get keepLookingAround => 'Keep looking around';

  @override
  String get verifiedTitle => 'You\'re verified';

  @override
  String get verifiedText =>
      'Your verified badge now shows on your profile. Landlords and agents can see that you are who you say you are.';

  @override
  String get youCanNow => 'You can now';

  @override
  String get canMessage => 'Message and call landlords and agents';

  @override
  String get canBook => 'Book inspections';

  @override
  String get canSave => 'Save homes and set area alerts';

  @override
  String get canList => 'List your properties';

  @override
  String get canTalkTenants => 'Message and call tenants';

  @override
  String get startLooking => 'Start looking for a home';

  @override
  String get faceFailedTitle => 'The face check didn\'t work';

  @override
  String get faceFailedText =>
      'Nothing is wrong with your account. The camera could not confirm a live face this time. Please try again.';

  @override
  String get tipsNextTry => 'Tips for the next try';

  @override
  String get tipWindow =>
      'Face a window or bright light, not a light behind you';

  @override
  String get tipStill => 'Hold the phone still at eye level';

  @override
  String get getHelp => 'Get help';

  @override
  String get addIdTitle => 'Add a photo of your ID';

  @override
  String addIdText(String idType) {
    return 'We could not match your $idType this time. A clear photo of one of these documents lets our verification team confirm who you are.';
  }

  @override
  String get whichDocument => 'Which document?';

  @override
  String get takePhotoFront => 'Take a photo of the front';

  @override
  String get orChooseGallery => 'or choose one from your gallery';

  @override
  String get photoChosen => 'Photo chosen. Tap to change it.';

  @override
  String get showCorners => 'Show all four corners, with no glare or blur.';

  @override
  String get takeAPhoto => 'Take a photo';

  @override
  String get chooseFromGallery => 'Choose from gallery';

  @override
  String get sendForChecking => 'Send for checking';

  @override
  String get errorChooseDocument => 'Please choose which document it is';

  @override
  String get errorChoosePhoto => 'Please add a photo of the document';

  @override
  String get errorPhotoType => 'Please use a JPEG or PNG photo, 20 MB at most.';

  @override
  String get teamTitle => 'A member of our team is checking';

  @override
  String teamText(String idType) {
    return 'Some details need a person to look at them, for example when the name on your $idType is spelt differently. We will notify you as soon as it is done.';
  }

  @override
  String get nothingMoreTitle => 'Nothing more is needed from you';

  @override
  String get nothingMoreText =>
      'If we need anything, we will tell you in the app and by email.';

  @override
  String get checkProblemTitle => 'The check could not be finished';

  @override
  String get checkProblemText =>
      'This was a fault on our side, not yours. Please try again.';

  @override
  String get companyDetails => 'Company details';

  @override
  String get yourCompany => 'Your company';

  @override
  String get companyIntro =>
      'If you work through a firm, add it here. Once checked, landlords and tenants see the company name on your profile.';

  @override
  String get companyWaiting =>
      'Our verification team is checking the details below. You can keep working while they do.';

  @override
  String get companyApproved => 'Your company details have been checked.';

  @override
  String get companyNotApproved =>
      'Our verification team could not confirm these details. Please check them and save again.';

  @override
  String get businessName => 'Business name';

  @override
  String get registrationNumber => 'Registration number (optional)';

  @override
  String get registrationHelper =>
      'Your company registration number, if the business is registered';

  @override
  String get saveCompanyDetails => 'Save company details';

  @override
  String get errorBusinessName => 'Please enter the business name';

  @override
  String get companyNeedsLevel2 =>
      'Verify your identity first; then you can add your company.';

  @override
  String sheetVerifyText(String idType) {
    return 'Landlords and agents only talk to verified tenants, so everyone knows who they are dealing with. It takes a few minutes: your $idType and a quick face check.';
  }

  @override
  String get verifyNow => 'Verify now';

  @override
  String get notNow => 'Not now';

  @override
  String get confirmFirst =>
      'Confirm your phone number and email address first';

  @override
  String goodMorning(String name) {
    return 'Good morning, $name';
  }

  @override
  String goodAfternoon(String name) {
    return 'Good afternoon, $name';
  }

  @override
  String goodEvening(String name) {
    return 'Good evening, $name';
  }

  @override
  String get alerts => 'Alerts';

  @override
  String get searchHint => 'Search area, street or landmark';

  @override
  String get homesAroundMe => 'Homes around me';

  @override
  String get homesAroundMeText =>
      'See what is available near where you are now';

  @override
  String get nearYourPlaces => 'Near your places';

  @override
  String get whatLookingFor => 'What are you looking for?';

  @override
  String get catHomes => 'Homes to rent';

  @override
  String get catShops => 'Shops and offices';

  @override
  String get catShortLets => 'Short lets';

  @override
  String get catHomesShort => 'Homes';

  @override
  String newIn(String area) {
    return 'New in $area';
  }

  @override
  String get seeAll => 'See all';

  @override
  String kmAway(String km) {
    return '$km km away';
  }

  @override
  String mAway(int m) {
    return '$m m away';
  }

  @override
  String resultsTitleHomes(String place) {
    return 'Homes to rent in $place';
  }

  @override
  String resultsTitleShops(String place) {
    return 'Shops and offices in $place';
  }

  @override
  String resultsTitleShortLets(String place) {
    return 'Short lets in $place';
  }

  @override
  String resultsTitleAll(String place) {
    return 'Properties in $place';
  }

  @override
  String get aroundYou => 'around you';

  @override
  String nearPlace(String place) {
    return 'near $place';
  }

  @override
  String resultsSubtitle(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other:
          '$count homes, every lister identity-checked. Inspections are always free.',
      one:
          '1 home, every lister identity-checked. Inspections are always free.',
    );
    return '$_temp0';
  }

  @override
  String sortLabel(String how) {
    return 'Sort: $how';
  }

  @override
  String get sortNewest => 'Newest first';

  @override
  String get sortNearest => 'Nearest first';

  @override
  String get sortCheapest => 'Lowest price first';

  @override
  String get sortDearest => 'Highest price first';

  @override
  String get anyPrice => 'Any price';

  @override
  String get bedroomsFilter => 'Bedrooms';

  @override
  String get furnishedFilter => 'Furnished';

  @override
  String get moreFilters => 'More filters';

  @override
  String get perYearShort => '/year';

  @override
  String get perMonthShort => '/month';

  @override
  String get perWeekShort => '/week';

  @override
  String get perNightShort => '/night';

  @override
  String beds(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count beds',
      one: '1 bed',
    );
    return '$_temp0';
  }

  @override
  String rooms(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count rooms',
      one: '1 room',
    );
    return '$_temp0';
  }

  @override
  String baths(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count baths',
      one: '1 bath',
    );
    return '$_temp0';
  }

  @override
  String get verifiedLister => 'Verified lister';

  @override
  String get ownerVerified => 'Owner verified';

  @override
  String get saveHome => 'Save this home';

  @override
  String get unsaveHome => 'Remove from saved';

  @override
  String get getAlertsTitle => 'Get alerts for this search';

  @override
  String getAlertsText(String place) {
    return 'We tell you the moment a new home $place matches this search.';
  }

  @override
  String get saveThisSearch => 'Save this search';

  @override
  String showingOf(int shown, int total) {
    return 'Showing $shown of $total homes';
  }

  @override
  String get showMoreHomes => 'Show more homes';

  @override
  String get whyRentTitle => 'Why rent on FindHouseQuick';

  @override
  String get whyRent1 => 'Every landlord and agent has proved who they are';

  @override
  String get whyRent2 => 'Inspections are always free';

  @override
  String get whyRent3 => 'Rent and every fee are shown before you call';

  @override
  String get whyRent4 => 'Photos taken on site, room by room';

  @override
  String newlyListedIn(String place) {
    return 'Newly listed in $place';
  }

  @override
  String get addedLast7Days => 'Added in the last 7 days';

  @override
  String get seeAllNew => 'See all new homes';

  @override
  String popularAreasIn(String place) {
    return 'Popular areas in $place';
  }

  @override
  String areaWithCount(String area, int count) {
    return '$area ($count)';
  }

  @override
  String get filters => 'Filters';

  @override
  String get clearAll => 'Clear all';

  @override
  String get lookingFor => 'Looking for';

  @override
  String get rentPerYear => 'Rent per year';

  @override
  String get pricePerNight => 'Price per night';

  @override
  String get lowest => 'Lowest';

  @override
  String get highest => 'Highest';

  @override
  String get noMinimum => 'No minimum';

  @override
  String get noMaximum => 'No maximum';

  @override
  String get bedroomsAny => 'Any';

  @override
  String bedroomsAtLeast(int n) {
    return '$n+';
  }

  @override
  String get propertyType => 'Property type';

  @override
  String get furnishing => 'Furnishing';

  @override
  String get furnUNFURNISHED => 'Unfurnished';

  @override
  String get furnSEMI_FURNISHED => 'Semi-furnished';

  @override
  String get furnFURNISHED => 'Furnished';

  @override
  String get verifiedOnly => 'Verified listers only';

  @override
  String get verifiedOnlyText => 'Owner or authority checked by our team';

  @override
  String showHomes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Show $count homes',
      one: 'Show 1 home',
      zero: 'No homes match',
    );
    return '$_temp0';
  }

  @override
  String get errorRentRange => 'The lowest rent must be less than the highest';

  @override
  String get places => 'Places';

  @override
  String get recentSearches => 'Recent searches';

  @override
  String get clearSearch => 'Clear search';

  @override
  String get landmarkHint =>
      'Many addresses are not exact, so search by a landmark people know and set how far from it to look.';

  @override
  String get howFar => 'How far from it';

  @override
  String withinM(int m) {
    return '$m m';
  }

  @override
  String withinKm(int km) {
    return '$km km';
  }

  @override
  String placeWithin(String place, String distance) {
    return '$place · $distance';
  }

  @override
  String get noPlacesFound =>
      'No places match. Try the name of an area or a landmark nearby.';

  @override
  String get noResultsTitle => 'No homes match yet';

  @override
  String noResultsTextNear(String distance, String place) {
    return 'Nothing within $distance of $place fits all your filters right now. Try one of these, or get an alert when a match is listed.';
  }

  @override
  String noResultsTextArea(String place) {
    return 'Nothing in $place fits all your filters right now. Try one of these, or get an alert when a match is listed.';
  }

  @override
  String searchUpTo(String distance, int count) {
    return 'Search up to $distance away ($count homes)';
  }

  @override
  String removeFilter(String filter, int count) {
    return 'Remove the $filter filter ($count homes)';
  }

  @override
  String removeAllFilters(int count) {
    return 'Remove all filters ($count homes)';
  }

  @override
  String get alertMeWhenListed => 'Alert me when one is listed';

  @override
  String get saveThisArea => 'Save this area';

  @override
  String get nameThisSearch => 'Name this search';

  @override
  String get matching => 'Matching';

  @override
  String get alertMeHere => 'Alert me about new homes here';

  @override
  String get alertMeHereText =>
      'By notification, as set in your notification settings';

  @override
  String get saveArea => 'Save area';

  @override
  String get areaSaved =>
      'Area saved. We will tell you when a matching home is listed.';

  @override
  String get errorSearchName => 'Please give this search a name';

  @override
  String get errorTooManyAreas =>
      'You have saved the most areas allowed. Delete one in Saved to add another.';

  @override
  String withinOf(String distance, String place) {
    return 'Within $distance of $place';
  }

  @override
  String upToRent(String amount) {
    return 'Up to $amount a year';
  }

  @override
  String fromRent(String amount) {
    return 'From $amount a year';
  }

  @override
  String bedroomsPlus(int n) {
    return '$n+ bedrooms';
  }

  @override
  String homesIn(int count, String place) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count homes in $place',
      one: '1 home in $place',
    );
    return '$_temp0';
  }

  @override
  String get seeEveryPhotoTitle => 'See every photo, the map and distances';

  @override
  String get seeEveryPhotoText =>
      'Create a free account to see every photo, the map and distances, and to save homes.';

  @override
  String get createFreeAccount => 'Create a free account';

  @override
  String get locationTitle => 'Show homes around you?';

  @override
  String get locationText =>
      'FindHouseQuick uses your phone\'s location to show homes near where you are, and how far each one is.';

  @override
  String get locationPoint1 => 'Only while you use the app';

  @override
  String get locationPoint2 => 'Never saved or shared with landlords';

  @override
  String get locationPoint3 =>
      'You can turn it off at any time in your phone settings';

  @override
  String get allowLocation => 'Allow location';

  @override
  String get searchByAreaInstead => 'Search by area instead';

  @override
  String get locationDenied =>
      'Location is turned off for FindHouseQuick. You can turn it on in your phone settings, or search by area.';

  @override
  String get locationUnavailable =>
      'Your location could not be found. Search by area instead.';

  @override
  String get openSettings => 'Open settings';

  @override
  String get searchFailed =>
      'The homes could not be loaded. Check your connection and try again.';

  @override
  String get signInToSave => 'Sign in to save homes';

  @override
  String get beingBuiltTitle => 'This part of the app is on its way';

  @override
  String get beingBuiltText =>
      'It is being built now and arrives in a coming update.';

  @override
  String get noHomesYet => 'No homes are listed here yet.';

  @override
  String bedroomsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count bedrooms',
      one: '1 bedroom',
    );
    return '$_temp0';
  }

  @override
  String toiletsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count toilets',
      one: '1 toilet',
    );
    return '$_temp0';
  }

  @override
  String get feeAgency => 'Agency fee';

  @override
  String get feeLegal => 'Legal or agreement fee';

  @override
  String get feeCaution => 'Caution deposit';

  @override
  String get feeService => 'Service charge';

  @override
  String get groundFloor => 'Ground floor';

  @override
  String get basement => 'Basement';

  @override
  String floorNumber(String n) {
    String _temp0 = intl.Intl.selectLogic(n, {
      '1': 'First floor',
      '2': 'Second floor',
      '3': 'Third floor',
      '4': 'Fourth floor',
      '5': 'Fifth floor',
      '6': 'Sixth floor',
      '7': 'Seventh floor',
      '8': 'Eighth floor',
      '9': 'Ninth floor',
      '10': 'Tenth floor',
      'other': 'Floor $n',
    });
    return '$_temp0';
  }

  @override
  String get factBedrooms => 'Bedrooms';

  @override
  String get factBathrooms => 'Bathrooms';

  @override
  String get factToilets => 'Toilets';

  @override
  String get factFloor => 'Floor';

  @override
  String get factFloorArea => 'Floor area';

  @override
  String get factAvailableFrom => 'Available from';

  @override
  String get factPhotosTaken => 'Photos taken';

  @override
  String get whoCanRent => 'Who can rent';

  @override
  String get verifyToBook => 'Verify to book an inspection';

  @override
  String get verifyToChat => 'Verify to chat with the lister';

  @override
  String get homeGoneTitle => 'This home is no longer listed';

  @override
  String get homeGoneText =>
      'It may have been rented, or the lister took it down. There are more homes like it.';

  @override
  String get viewLimitTitle => 'Sign in to keep viewing homes';

  @override
  String get viewLimitText =>
      'You have opened a great many homes this hour. Create a free account or sign in to carry on.';

  @override
  String get inspectionsAreFree => 'Inspections are free';

  @override
  String get bookFreeInspection => 'Book a free inspection';

  @override
  String get chatWithLister => 'Chat with the lister';

  @override
  String get whatYouPay => 'What you pay';

  @override
  String get totalToMoveIn => 'Total to move in';

  @override
  String get totalLabel => 'Total';

  @override
  String get rentOneYear => '1 year';

  @override
  String get rentOneMonth => '1 month';

  @override
  String get rentOneWeek => '1 week';

  @override
  String get rentOneNight => '1 night';

  @override
  String rentFor(String period) {
    return 'Rent ($period)';
  }

  @override
  String get noHiddenFees =>
      'Inspections are free. No fee may be charged that is not shown here.';

  @override
  String get verifiedLandlord => 'Verified landlord';

  @override
  String get verifiedAgent => 'Verified agent';

  @override
  String repliesMinutes(int n) {
    return 'Usually replies within $n minutes';
  }

  @override
  String repliesHours(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Usually replies within $n hours',
      one: 'Usually replies within 1 hour',
    );
    return '$_temp0';
  }

  @override
  String get photosByRoom => 'Photos by room';

  @override
  String get video => 'Video';

  @override
  String get walkthroughVideo => 'Walkthrough video';

  @override
  String get walkthroughText => 'One continuous take through the whole home';

  @override
  String get keyDetails => 'Key details';

  @override
  String get aboutThisHome => 'About this home';

  @override
  String get location => 'Location';

  @override
  String get approximateArea => 'Approximate area';

  @override
  String get exactAddressLater =>
      'The exact address and directions are shared once an inspection is confirmed.';

  @override
  String get homesGoQuickly => 'Homes like this go quickly';

  @override
  String alertSimilarIn(String area) {
    return 'Get an alert when a similar home is listed in $area.';
  }

  @override
  String getAlertsFor(String area) {
    return 'Get alerts for $area';
  }

  @override
  String get similarHomesNearby => 'Similar homes nearby';

  @override
  String similarHomesText(int n) {
    return '$n bedroom homes at a similar rent';
  }

  @override
  String get seeAllSimilar => 'See all similar homes';

  @override
  String moreHomesIn(String area) {
    return 'More homes in $area';
  }

  @override
  String seeAllHomesIn(String area) {
    return 'See all homes in $area';
  }

  @override
  String get moreFromUs => 'More from FindHouseQuick';

  @override
  String get moreChecked => 'Identity-checked listers';

  @override
  String get moreCheckedText =>
      'Every landlord and agent proves who they are before a home goes live.';

  @override
  String get moreCheckedLink => 'How we check';

  @override
  String get moreFree => 'Free inspections';

  @override
  String get moreFreeText =>
      'Book a time in the app. Nobody may charge you to see a home.';

  @override
  String get moreFreeLink => 'Booking an inspection';

  @override
  String get moreList => 'List your property free';

  @override
  String get moreListText =>
      'Landlords and agents list for free and manage tenants, rent and receipts.';

  @override
  String get moreListLink => 'List your property';

  @override
  String get moreScout => 'Become a scout';

  @override
  String get moreScoutText =>
      'Spot a vacant property, invite the landlord, and earn a reward when it is rented.';

  @override
  String get moreScoutLink => 'Start scouting';

  @override
  String seeAllPhotos(int n) {
    return 'See all $n photos';
  }

  @override
  String get share => 'Share';

  @override
  String get compare => 'Compare';

  @override
  String get report => 'Report';

  @override
  String approximatePlace(String place) {
    return '$place (approximate area)';
  }

  @override
  String get searchButton => 'Search';

  @override
  String get everyListerProves =>
      'Every landlord and agent proves who they are before they can list';

  @override
  String get listYourProperty => 'List your property';

  @override
  String get becomeScout => 'Become a scout';

  @override
  String get help => 'Help';

  @override
  String get homesToRent => 'Homes to rent';

  @override
  String get footerFind => 'Find a place';

  @override
  String get footerList => 'List and earn';

  @override
  String get listAProperty => 'List a property';

  @override
  String get forAgents => 'For agents';

  @override
  String get helpCentre => 'Help centre';

  @override
  String get reportAListing => 'Report a listing';

  @override
  String get termsOfUse => 'Terms of use';

  @override
  String get privacyPolicy => 'Privacy policy';

  @override
  String get footerAbout =>
      'Houses, flats, shops and short lets to rent, from landlords and agents whose identity we have checked.';

  @override
  String copyright(String year) {
    return '© $year Projectiles Tech Hub Limited';
  }

  @override
  String get crumbHome => 'Home';

  @override
  String get savedLabel => 'Saved';

  @override
  String get saveLabel => 'Save';

  @override
  String get periodPerYear => 'per year';

  @override
  String get periodPerMonth => 'per month';

  @override
  String get periodPerWeek => 'per week';

  @override
  String get periodPerNight => 'per night';
}
