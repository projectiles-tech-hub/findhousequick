import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_icon.dart';
import 'tokens.dart';
import 'wide.dart';

/// The label above a field, the box, and the help or error line under it, as designed.
/// An error is always written out in words under the box, never shown by colour alone.
class AppFieldFrame extends StatelessWidget {
  const AppFieldFrame({super.key, required this.label, required this.child, this.helper, this.error, this.enabled = true});

  final String label;
  final Widget child;
  final String? helper;
  final String? error;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final under = error ?? helper;
    final wide = AppWide.of(context);
    final labelStyle = wide ? AppText.label.copyWith(fontWeight: FontWeight.w600, fontVariations: const [FontVariation('wght', 600)], height: 19 / 14) : AppText.label.copyWith(height: 17 / 14);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: labelStyle.copyWith(color: enabled ? AppColors.ink900 : AppColors.ink400)),
        const SizedBox(height: 6),
        child,
        if (under != null) ...[
          const SizedBox(height: 6),
          Semantics(
            liveRegion: error != null,
            child: Text(under, style: AppText.bodySmall.copyWith(color: error != null ? AppColors.error : AppColors.ink600, height: 17 / 14)),
          ),
        ],
      ],
    );
  }
}

InputDecoration _box(BuildContext context, {String? hint, bool error = false, bool enabled = true, Widget? prefix, Widget? suffix}) {
  final radius = AppWide.of(context) ? 12.0 : AppRadius.small;
  OutlineInputBorder line(Color c, double w) => OutlineInputBorder(borderRadius: BorderRadius.circular(radius), borderSide: BorderSide(color: c, width: w));
  return InputDecoration(
    hintText: hint,
    hintStyle: AppText.body.copyWith(color: AppColors.ink600),
    filled: true,
    fillColor: enabled ? AppColors.surface : AppColors.background,
    hoverColor: Colors.transparent,
    isDense: true,
    constraints: const BoxConstraints(minHeight: 52),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    prefixIcon: prefix,
    prefixIconConstraints: const BoxConstraints(minHeight: 52),
    suffixIcon: suffix,
    suffixIconConstraints: const BoxConstraints(minHeight: 48, minWidth: 48),
    enabledBorder: error ? line(AppColors.error, 2) : line(AppColors.border, 1),
    focusedBorder: error ? line(AppColors.error, 2) : line(AppColors.green700, 2),
    disabledBorder: line(AppColors.divider, 1),
  );
}

/// A text field: label above, box 52 high, help or error underneath.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.helper,
    this.error,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
    this.textCapitalization = TextCapitalization.none,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final String? helper;
  final String? error;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return AppFieldFrame(
      label: label,
      helper: helper,
      error: error,
      enabled: enabled,
      child: Semantics(
        label: label,
        child: TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          inputFormatters: inputFormatters,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          textCapitalization: textCapitalization,
          style: AppText.body.copyWith(color: enabled ? AppColors.ink900 : AppColors.ink400),
          cursorColor: AppColors.green700,
          decoration: _box(context, hint: hint, error: error != null, enabled: enabled),
        ),
      ),
    );
  }
}

/// A phone number field. The country's flag and dialling code come from the country settings, never from the app.
class AppPhoneField extends StatelessWidget {
  const AppPhoneField({
    super.key,
    required this.label,
    required this.dialCode,
    this.flag,
    this.controller,
    this.helper,
    this.error,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
  });

  final String label;

  /// For example "+234".
  final String dialCode;

  /// The flag as an emoji, for example "🇳🇬".
  final String? flag;
  final TextEditingController? controller;
  final String? helper;
  final String? error;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return AppFieldFrame(
      label: label,
      helper: helper,
      error: error,
      enabled: enabled,
      child: Semantics(
        label: label,
        child: TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumberNational],
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]'))],
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          style: AppText.body,
          cursorColor: AppColors.green700,
          decoration: _box(
            context,
            error: error != null,
            enabled: enabled,
            prefix: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Text(flag == null ? dialCode : '$flag $dialCode', style: AppText.body),
                ),
                Container(width: 1, height: 28, color: AppColors.border),
                const SizedBox(width: 14),
              ],
            ),
          ).copyWith(contentPadding: const EdgeInsets.only(right: 16, top: 14, bottom: 14)),
        ),
      ),
    );
  }
}

/// A password field with a button to show or hide what was typed.
class AppPasswordField extends StatefulWidget {
  const AppPasswordField({
    super.key,
    required this.label,
    required this.showLabel,
    required this.hideLabel,
    this.controller,
    this.helper,
    this.error,
    this.newPassword = false,
    this.onChanged,
    this.onSubmitted,
  });

  final String label;

  /// Words for the show and hide button, read out by screen readers.
  final String showLabel;
  final String hideLabel;
  final TextEditingController? controller;
  final String? helper;
  final String? error;

  /// True when choosing a password, so the phone offers to save it rather than fill one in.
  final bool newPassword;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AppPasswordField> createState() => _AppPasswordFieldState();
}

class _AppPasswordFieldState extends State<AppPasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    final toggle = _hidden ? widget.showLabel : widget.hideLabel;
    return AppFieldFrame(
      label: widget.label,
      helper: widget.helper,
      error: widget.error,
      child: Semantics(
        label: widget.label,
        child: TextField(
          controller: widget.controller,
          obscureText: _hidden,
          obscuringCharacter: '•',
          enableSuggestions: false,
          autocorrect: false,
          autofillHints: [widget.newPassword ? AutofillHints.newPassword : AutofillHints.password],
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          style: AppText.body,
          cursorColor: AppColors.green700,
          decoration: _box(
            context,
            error: widget.error != null,
            suffix: Semantics(
              button: true,
              label: toggle,
              child: Tooltip(
                message: toggle,
                excludeFromSemantics: true,
                child: InkResponse(
                  radius: 24,
                  onTap: () => setState(() => _hidden = !_hidden),
                  child: SizedBox(
                    width: 48,
                    height: 48,
                    child: Center(child: AppIcon(AppIcons.eye, color: _hidden ? AppColors.ink600 : AppColors.green700)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The code sent by SMS or email, typed into large boxes. The number of boxes is the length of the code.
class AppCodeField extends StatefulWidget {
  const AppCodeField({super.key, required this.label, this.length = 6, this.helper, this.error, this.onChanged, this.onCompleted, this.autofocus = false});

  final String label;
  final int length;
  final String? helper;
  final String? error;
  final ValueChanged<String>? onChanged;

  /// Called once every box is filled.
  final ValueChanged<String>? onCompleted;
  final bool autofocus;

  @override
  State<AppCodeField> createState() => _AppCodeFieldState();
}

class _AppCodeFieldState extends State<AppCodeField> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _changed(String value) {
    setState(() {});
    widget.onChanged?.call(value);
    if (value.length == widget.length) widget.onCompleted?.call(value);
  }

  @override
  Widget build(BuildContext context) {
    final code = _controller.text;
    final wide = AppWide.of(context);
    final boxes = Row(
      children: [
        for (var i = 0; i < widget.length; i++) ...[
          if (i > 0) SizedBox(width: wide ? 10 : 8),
          Flexible(
            child: Container(
              constraints: BoxConstraints(maxWidth: wide ? 63 : 48),
              height: wide ? 60 : 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(wide ? 12 : AppRadius.small),
                border: widget.error != null
                    ? Border.all(color: AppColors.error, width: 2)
                    : (_focus.hasFocus && i == code.length.clamp(0, widget.length - 1))
                        ? Border.all(color: AppColors.green700, width: 2)
                        : Border.all(color: AppColors.border),
              ),
              child: Text(i < code.length ? code[i] : '', style: wide ? AppText.title.copyWith(fontSize: 26, height: 34 / 26) : AppText.title),
            ),
          ),
        ],
      ],
    );
    return AppFieldFrame(
      label: widget.label,
      helper: widget.helper,
      error: widget.error,
      child: Stack(
        children: [
          ExcludeSemantics(child: boxes),
          // The real field lies unseen over the boxes, so typing, pasting and the code offered by the phone all work.
          Positioned.fill(
            child: Semantics(
              label: widget.label,
              child: TextField(
                controller: _controller,
                focusNode: _focus,
                autofocus: widget.autofocus,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(widget.length)],
                onChanged: _changed,
                showCursor: false,
                enableInteractiveSelection: false,
                style: const TextStyle(color: Colors.transparent, fontSize: 1),
                decoration: const InputDecoration(border: InputBorder.none, counterText: '', contentPadding: EdgeInsets.zero),
                expands: true,
                maxLines: null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A field that opens a list to choose from (a state, a city, a property type) rather than being typed in.
class AppPickerField extends StatelessWidget {
  const AppPickerField({super.key, required this.label, required this.onTap, this.value, this.hint, this.helper, this.error});

  final String label;
  final String? value;
  final String? hint;
  final String? helper;
  final String? error;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppFieldFrame(
      label: label,
      helper: helper,
      error: error,
      enabled: onTap != null,
      child: Semantics(
        button: true,
        label: label,
        value: value,
        child: Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.small),
            side: error != null ? const BorderSide(color: AppColors.error, width: 2) : const BorderSide(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Expanded(
                      child: ExcludeSemantics(
                        child: Text(value ?? hint ?? '', style: AppText.body.copyWith(color: value == null ? AppColors.ink600 : AppColors.ink900)),
                      ),
                    ),
                    const AppIcon(AppIcons.forward, color: AppColors.ink600),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The rounded search bar: 48 high, with the search icon.
class AppSearchBar extends StatelessWidget {
  const AppSearchBar({super.key, required this.hint, this.controller, this.onChanged, this.onSubmitted, this.onTap, this.readOnly = false});

  final String hint;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  /// With [readOnly], the bar acts as a button that opens the search screen.
  final VoidCallback? onTap;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder line(Color c, double w) => OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: controller,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      onTap: onTap,
      readOnly: readOnly,
      textInputAction: TextInputAction.search,
      style: AppText.body,
      cursorColor: AppColors.green700,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppText.body.copyWith(color: AppColors.ink600),
        filled: true,
        fillColor: AppColors.surface,
        hoverColor: Colors.transparent,
        isDense: true,
        constraints: const BoxConstraints(minHeight: 48),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        prefixIcon: const Padding(padding: EdgeInsets.only(left: 16, right: 8), child: AppIcon(AppIcons.search, color: AppColors.ink600)),
        prefixIconConstraints: const BoxConstraints(minHeight: 48),
        enabledBorder: line(AppColors.border, 1),
        focusedBorder: line(AppColors.green700, 2),
      ),
    );
  }
}
