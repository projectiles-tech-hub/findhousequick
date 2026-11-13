import 'package:material_ui/material_ui.dart';

import 'app_icon.dart';
import 'tokens.dart';

/// One tab of the bottom bar: the outline icon, the filled icon shown when it is the current tab, and its word.
class AppBottomTab {
  const AppBottomTab({required this.icon, required this.label, this.filledIcon});

  final AppIcons icon;

  /// Search has no filled form in the design; it keeps its outline icon when current.
  final AppIcons? filledIcon;
  final String label;
}

/// The bottom bar on every main screen: 64 high, each tab the full height, the current tab green with a filled
/// icon on a soft green pill, the others grey outline icons, always with a word under them.
class AppBottomBar extends StatelessWidget {
  const AppBottomBar({super.key, required this.tabs, required this.current, required this.onTap});

  final List<AppBottomTab> tabs;
  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      child: Container(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.divider))),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                for (var i = 0; i < tabs.length; i++)
                  Expanded(child: _Tab(tab: tabs[i], selected: i == current, onTap: () => onTap(i))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.tab, required this.selected, required this.onTap});

  final AppBottomTab tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ink = selected ? AppColors.green700 : AppColors.ink600;
    return Semantics(
      button: true,
      selected: selected,
      label: tab.label,
      child: InkWell(
        onTap: onTap,
        child: ExcludeSemantics(
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 56,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: selected ? AppColors.green50 : null, borderRadius: BorderRadius.circular(15)),
                child: AppIcon(selected ? (tab.filledIcon ?? tab.icon) : tab.icon, color: ink),
              ),
              const SizedBox(height: 2),
              // The longest word ("Inspections") just fits a 72 wide tab at 14; on a narrower phone it shrinks rather than being cut.
              FittedBox(fit: BoxFit.scaleDown, child: Text(tab.label, maxLines: 1, style: AppText.label.copyWith(color: ink, height: 17 / 14))),
            ],
          ),
        ),
      ),
    );
  }
}
