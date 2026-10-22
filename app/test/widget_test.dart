import 'package:findhousequick/src/controls/controls.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Stands in for the server so tests do not need a network.
class _FakeControls extends ControlsNotifier {
  _FakeControls(this.value);
  final Controls value;

  @override
  Future<Controls> build() async => value;
}

final _sample = {
  'features': {'contact.chat': true, 'money.escrow': false},
  'country': {
    'code': 'NG',
    'name': 'Nigeria',
    'currency': 'NGN',
    'languages': ['en', 'pcm'],
    'defaultLanguage': 'en',
    'timezone': 'Africa/Lagos',
    'settings': {
      'fees': {'escrowTenantBps': 150},
    },
  },
  'refreshAfterSeconds': 120,
};

void main() {
  group('Controls', () {
    test('reads switches and country settings from the server response', () {
      final c = Controls.fromJson(_sample);
      expect(c.isOn('contact.chat'), isTrue);
      expect(c.isOn('money.escrow'), isFalse);
      expect(c.country?.currency, 'NGN');
      expect(c.country?.languages, ['en', 'pcm']);
      expect(c.refreshAfter, const Duration(seconds: 120));
    });

    test('treats features the server has not mentioned as off', () {
      expect(Controls.fromJson(_sample).isOn('listings.short_let'), isFalse);
    });

    test('accepts a response with no country', () {
      final c = Controls.fromJson({'features': <String, bool>{}, 'country': null});
      expect(c.country, isNull);
      expect(c.refreshAfter, const Duration(seconds: 300));
    });
  });

  testWidgets('FeatureGate shows content only when the feature is on', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [controlsProvider.overrideWith(() => _FakeControls(Controls.fromJson(_sample)))],
        child: const MaterialApp(
          home: Column(children: [
            FeatureGate(feature: 'contact.chat', child: Text('Chat')),
            FeatureGate(feature: 'money.escrow', otherwise: Text('Escrow off'), child: Text('Escrow')),
          ]),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Escrow'), findsNothing);
    expect(find.text('Escrow off'), findsOneWidget);
  });
}
