import 'package:findhousequick/src/design/app_icon.dart';
import 'package:findhousequick/src/design/bottom_bar.dart';
import 'package:findhousequick/src/design/buttons.dart';
import 'package:findhousequick/src/design/chips.dart';
import 'package:findhousequick/src/design/choice.dart';
import 'package:findhousequick/src/design/fields.dart';
import 'package:findhousequick/src/design/gallery_screen.dart';
import 'package:findhousequick/src/design/main_tabs.dart';
import 'package:findhousequick/src/design/tokens.dart';
import 'package:findhousequick/src/l10n/languages.dart';
import 'package:findhousequick/src/theme/theme.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
      theme: AppTheme.light(),
      locale: locale,
      localizationsDelegates: appLocalizationsDelegates,
      supportedLocales: appLocales,
      home: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: child)),
    );

void main() {
  testWidgets('a button is 52 high, and a disabled one cannot be pressed', (tester) async {
    var presses = 0;
    await tester.pumpWidget(_host(Column(children: [
      AppButton(label: 'Continue', onPressed: () => presses++),
      const AppButton(label: 'Not yet', onPressed: null),
    ])));
    expect(tester.getSize(find.widgetWithText(TextButton, 'Continue')).height, 52);
    await tester.tap(find.text('Continue'));
    await tester.tap(find.text('Not yet'));
    expect(presses, 1);
  });

  testWidgets('long wording on a button wraps instead of being cut off', (tester) async {
    await tester.pumpWidget(_host(const SizedBox(
      width: 200,
      child: AppButton(label: 'Abeg confirm say na you get this number', onPressed: null),
    )));
    expect(tester.getSize(find.byType(TextButton)).height, greaterThan(52));
    expect(tester.takeException(), isNull);
  });

  testWidgets('every tappable part is at least 48 high', (tester) async {
    await tester.pumpWidget(_host(Column(children: [
      AppIconButton(icon: AppIcons.heart, label: 'Save', onPressed: () {}),
      AppFilterChip(label: '2 bedrooms', selected: false, onChanged: (_) {}),
      AppCheckbox(label: 'I agree', value: false, onChanged: (_) {}),
      AppPickerField(label: 'State', value: 'Edo', onTap: () {}),
    ])));
    expect(tester.getSize(find.byType(AppIconButton)), const Size(48, 48));
    expect(tester.getSize(find.byType(AppFilterChip)).height, greaterThanOrEqualTo(48));
    expect(tester.getSize(find.byType(AppCheckbox)).height, greaterThanOrEqualTo(48));
    expect(tester.getSize(find.byType(InkWell).last).height, greaterThanOrEqualTo(48));
  });

  testWidgets('a text field is 52 high and writes its error out in words', (tester) async {
    await tester.pumpWidget(_host(const AppTextField(label: 'Full name', error: 'Please enter your first name and surname')));
    expect(tester.getSize(find.byType(TextField)).height, 52);
    final error = tester.widget<Text>(find.text('Please enter your first name and surname'));
    expect(error.style?.color, AppColors.error);
  });

  testWidgets('the password field hides what is typed until asked to show it', (tester) async {
    await tester.pumpWidget(_host(const AppPasswordField(label: 'Password', showLabel: 'Show password', hideLabel: 'Hide password')));
    expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isTrue);
    await tester.tap(find.bySemanticsLabel('Show password'));
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isFalse);
    expect(find.bySemanticsLabel('Hide password'), findsOneWidget);
  });

  testWidgets('the code field takes digits only and reports when it is complete', (tester) async {
    String? done;
    await tester.pumpWidget(_host(AppCodeField(label: 'Enter the 6-digit code', onCompleted: (v) => done = v)));
    await tester.enterText(find.byType(TextField), '48a2');
    await tester.pump();
    expect(done, isNull);
    expect(find.text('4'), findsOneWidget);
    expect(find.text('a'), findsNothing);
    await tester.enterText(find.byType(TextField), '4827159');
    await tester.pump();
    expect(done, '482715');
  });

  testWidgets('a radio reports the choice tapped', (tester) async {
    String? picked;
    await tester.pumpWidget(_host(AppRadio<String>(label: 'Landlord', value: 'landlord', groupValue: 'tenant', onChanged: (v) => picked = v)));
    await tester.tap(find.text('Landlord'));
    expect(picked, 'landlord');
  });

  testWidgets('the bottom bar is 64 high with five tabs, and landlords get Properties in place of Saved', (tester) async {
    int? tapped;
    late AppTexts texts;
    await tester.pumpWidget(_host(Builder(builder: (context) {
      texts = context.texts;
      return Column(children: [
        AppBottomBar(tabs: mainTabs(texts, listsProperties: false), current: 0, onTap: (i) => tapped = i),
        AppBottomBar(tabs: mainTabs(texts, listsProperties: true), current: 1, onTap: (_) {}),
      ]);
    })));
    expect(tester.getSize(find.byType(AppBottomBar).first).height, 65); // 64 and the line above it
    expect(find.text('Saved'), findsOneWidget);
    expect(find.text('Properties'), findsOneWidget);
    await tester.tap(find.text('Messages').first);
    expect(tapped, 2);
  });

  testWidgets('the page of parts fits a 360 wide phone, in English and in Pidgin', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final locale in appLocales) {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: appLocalizationsDelegates,
        supportedLocales: appLocales,
        home: const GalleryScreen(),
      ));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -3000));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'locale $locale');
    }
  });
}
