import '../l10n/languages.dart';
import 'app_icon.dart';
import 'bottom_bar.dart';

/// The five tabs of the bottom bar. For landlords and agents, Properties takes the place of Saved.
List<AppBottomTab> mainTabs(AppTexts t, {required bool listsProperties}) => [
      AppBottomTab(icon: AppIcons.search, label: t.tabSearch),
      listsProperties
          ? AppBottomTab(icon: AppIcons.home, filledIcon: AppIcons.homeFilled, label: t.tabProperties)
          : AppBottomTab(icon: AppIcons.heart, filledIcon: AppIcons.heartFilled, label: t.tabSaved),
      AppBottomTab(icon: AppIcons.chat, filledIcon: AppIcons.chatFilled, label: t.tabMessages),
      AppBottomTab(icon: AppIcons.calendar, filledIcon: AppIcons.calendarFilled, label: t.tabInspections),
      AppBottomTab(icon: AppIcons.person, filledIcon: AppIcons.personFilled, label: t.tabMe),
    ];
