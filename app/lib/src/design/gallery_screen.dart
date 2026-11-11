import 'package:flutter/material.dart';

import '../l10n/languages.dart';
import 'app_icon.dart';
import 'bottom_bar.dart';
import 'buttons.dart';
import 'chips.dart';
import 'choice.dart';
import 'fields.dart';
import 'main_tabs.dart';
import 'notice.dart';
import 'tokens.dart';

/// Every shared part on one screen, to check against the design file. It is not part of the app for users: it is
/// only reachable when the app is built with --dart-define=PARTS_GALLERY=true.
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  int _tab = 0;
  bool _chip = true;
  bool _agree = true;
  String _who = 'tenant';

  @override
  Widget build(BuildContext context) {
    Widget gap([double h = 16]) => SizedBox(height: h);
    Widget heading(String s) => Padding(padding: const EdgeInsets.only(top: 24, bottom: 12), child: Text(s, style: AppText.subtitle));
    return Scaffold(
      bottomNavigationBar: AppBottomBar(tabs: mainTabs(context.texts, listsProperties: _tab.isOdd), current: _tab, onTap: (i) => setState(() => _tab = i)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.screenEdge),
          children: [
            Text('Find a house quick', style: AppText.display),
            Text('Two bedroom flat, Ugbowo', style: AppText.title),
            Text('Property details', style: AppText.subtitle),
            Text('₦1,200,000 a year', style: AppText.price),
            Text('Self-contained flat with running water, close to the main road. Ẹ káàbọ̀, Ụlọ, ṣọọbu.', style: AppText.body),
            Text('Listed 3 days ago · 1.2 km from your office', style: AppText.bodySmall),
            heading('Buttons'),
            AppButton(label: 'Continue', onPressed: () {}),
            gap(8),
            const AppButton(label: 'Continue', onPressed: null),
            gap(8),
            AppButton(label: 'Continue', kind: AppButtonKind.outline, onPressed: () {}),
            gap(8),
            const AppButton(label: 'Continue', kind: AppButtonKind.outline, onPressed: null),
            gap(8),
            AppButton(label: 'Skip for now', kind: AppButtonKind.text, onPressed: () {}),
            gap(8),
            AppButton(label: 'Delete listing', kind: AppButtonKind.danger, onPressed: () {}),
            gap(8),
            Row(children: [
              AppIconButton(icon: AppIcons.heart, label: 'Save', tinted: true, onPressed: () {}),
              const SizedBox(width: 16),
              AppIconButton(icon: AppIcons.heart, label: 'Save', onPressed: () {}),
            ]),
            heading('Chips and tags'),
            Wrap(spacing: 16, runSpacing: 8, children: [
              AppFilterChip(label: '2 bedrooms', selected: _chip, onChanged: (v) => setState(() => _chip = v)),
              AppFilterChip(label: '2 bedrooms', selected: !_chip, onChanged: (v) => setState(() => _chip = !v)),
            ]),
            gap(),
            const Wrap(spacing: 16, runSpacing: 8, children: [
              AppTag(label: 'Not approved', kind: AppTagKind.notApproved),
              AppTag(label: 'Approved', kind: AppTagKind.approved),
              AppTag(label: 'Waiting for check', kind: AppTagKind.waiting),
              AppTag(label: 'Verified', kind: AppTagKind.verified),
            ]),
            heading('Form fields'),
            const AppTextField(label: 'Full name', hint: 'Enter your full name', helper: 'As written on your ID'),
            gap(),
            AppTextField(label: 'Full name', controller: TextEditingController(text: 'Osaro'), error: 'Please enter your first name and surname'),
            gap(),
            AppTextField(label: 'Full name', controller: TextEditingController(text: 'Osaro Igbinedion'), enabled: false, helper: 'Contact support to change your name'),
            gap(),
            AppPhoneField(label: 'Phone number', dialCode: '+234', flag: '🇳🇬', controller: TextEditingController(text: '803 123 4567'), helper: 'We send a 6-digit code to this number'),
            gap(),
            AppPasswordField(label: 'Password', showLabel: context.texts.showPassword, hideLabel: context.texts.hidePassword, helper: 'At least 8 characters'),
            gap(),
            const AppCodeField(label: 'Enter the 6-digit code', helper: 'Send the code again in 0:45'),
            gap(),
            AppPickerField(label: 'State', value: 'Edo', onTap: () {}),
            gap(),
            const AppSearchBar(hint: 'Search area, street or landmark'),
            heading('Choices'),
            AppRadio(label: 'Tenant', value: 'tenant', groupValue: _who, onChanged: (v) => setState(() => _who = v)),
            AppRadio(label: 'Landlord', value: 'landlord', groupValue: _who, onChanged: (v) => setState(() => _who = v)),
            AppCheckbox(label: 'I agree to the terms of use', value: _agree, onChanged: (v) => setState(() => _agree = v)),
            heading('Notices'),
            AppNotice(kind: AppNoticeKind.error, title: context.texts.noConnectionTitle, message: context.texts.noConnectionMessage),
            gap(),
            const AppNotice(kind: AppNoticeKind.warning, title: 'Confirm your email', message: 'We sent a code to your email. You can browse, but you need it to message landlords.'),
            gap(),
            const AppNotice(kind: AppNoticeKind.success, title: 'Inspection booked', message: 'Saturday 26 October, 10:00 to 10:30.'),
            gap(),
            const AppNotice(kind: AppNoticeKind.info, title: 'Verify your identity', message: 'Verified accounts get more replies from landlords.'),
            heading('Icons'),
            Wrap(spacing: 12, runSpacing: 12, children: [for (final i in AppIcons.values) AppIcon(i)]),
          ],
        ),
      ),
    );
  }
}
