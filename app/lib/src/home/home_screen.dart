import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controls/controls.dart';

/// Release 0 start screen: confirms the app can reach the server and shows the switches in force.
/// Replaced by the search screen in Release 1.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controls = ref.watch(controlsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('FindHouseQuick')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(controlsProvider.notifier).refresh(),
        child: controls.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Icon(Icons.cloud_off, size: 48),
              const SizedBox(height: 12),
              Text('Cannot reach FindHouseQuick', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text('$e'),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.invalidate(controlsProvider),
                child: const Text('Try again'),
              ),
            ],
          ),
          data: (c) {
            final on = c.features.entries.where((e) => e.value).map((e) => e.key).toList()..sort();
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    leading: Icon(c.fromCache ? Icons.cloud_off : Icons.cloud_done),
                    title: Text(c.country?.name ?? 'Country not available'),
                    subtitle: Text(c.fromCache
                        ? 'Offline: showing the last saved settings'
                        : 'Connected. ${on.length} of ${c.features.length} features switched on.'),
                  ),
                ),
                FeatureGate(
                  feature: 'search.around_me',
                  child: Card(
                    child: ListTile(
                      leading: const Icon(Icons.my_location),
                      title: const Text('Search around me'),
                      subtitle: const Text('Coming in Release 1'),
                      enabled: false,
                      onTap: () {},
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text('Features switched on', style: Theme.of(context).textTheme.titleSmall),
                for (final key in on) Text(key),
              ],
            );
          },
        ),
      ),
    );
  }
}
