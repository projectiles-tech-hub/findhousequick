import 'package:flutter/material.dart';

import 'app_icon.dart';
import 'tokens.dart';

/// One choice out of several (a radio button), with its words. The whole row is the tap area, 48 high.
class AppRadio<T> extends StatelessWidget {
  const AppRadio({super.key, required this.label, required this.value, required this.groupValue, required this.onChanged});

  final String label;
  final T value;
  final T? groupValue;
  final ValueChanged<T>? onChanged;

  @override
  Widget build(BuildContext context) {
    final on = value == groupValue;
    return _ChoiceRow(
      label: label,
      onTap: onChanged == null ? null : () => onChanged!(value),
      semantics: (child) => Semantics(inMutuallyExclusiveGroup: true, checked: on, child: child),
      mark: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: on ? AppColors.green700 : AppColors.surface,
          border: on ? null : Border.all(color: AppColors.ink600, width: 2),
        ),
        child: on ? Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle)) : null,
      ),
    );
  }
}

/// A tick box with its words. [label] may hold links, so it is a widget.
class AppCheckbox extends StatelessWidget {
  const AppCheckbox({super.key, required this.label, required this.value, required this.onChanged});

  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return _ChoiceRow(
      label: label,
      onTap: onChanged == null ? null : () => onChanged!(!value),
      semantics: (child) => Semantics(checked: value, child: child),
      mark: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          color: value ? AppColors.green700 : AppColors.surface,
          border: value ? null : Border.all(color: AppColors.ink600, width: 2),
        ),
        child: value ? const AppIcon(AppIcons.check, size: 18, color: AppColors.surface) : null,
      ),
    );
  }
}

class _ChoiceRow extends StatelessWidget {
  const _ChoiceRow({required this.label, required this.mark, required this.onTap, required this.semantics});

  final String label;
  final Widget mark;
  final VoidCallback? onTap;
  final Widget Function(Widget child) semantics;

  @override
  Widget build(BuildContext context) {
    return semantics(
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.small),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpace.touch),
          child: Row(
            children: [
              mark,
              const SizedBox(width: 12),
              Expanded(child: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(label, style: AppText.body))),
            ],
          ),
        ),
      ),
    );
  }
}
