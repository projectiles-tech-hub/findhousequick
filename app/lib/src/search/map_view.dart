import 'package:material_ui/material_ui.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart' as ll;

import '../design/tokens.dart';
import 'search_api.dart';

/// Where the map picture comes from, asked of the server once and again after Google's address runs out
/// (decision 81). Null when no map provider is set: the screens then say the map is not available.
final tileSourceProvider = FutureProvider<TileSource?>((ref) async {
  final source = await ref.watch(searchApiProvider).tileSource();
  final expires = source?.expiresAt;
  if (expires != null) {
    final wait = expires.difference(DateTime.now()) - const Duration(hours: 1);
    if (wait > Duration.zero) {
      final timer = Future.delayed(wait, ref.invalidateSelf);
      ref.onDispose(() => timer.ignore());
    }
  }
  return source;
});

ll.LatLng toLl(LatLng p) => ll.LatLng(p.lat, p.lng);
LatLng fromLl(ll.LatLng p) => LatLng(p.latitude, p.longitude);

/// The part of the map on screen, as the search asks for it.
class MapArea {
  const MapArea({required this.south, required this.north, required this.zoom});
  final LatLng south;
  final LatLng north;
  final double zoom;
}

/// One map for every screen that shows one: the picture from the provider the server names, with whatever pins
/// the screen gives it on top. The provider's credit is always shown, as their terms require.
class AppMap extends ConsumerWidget {
  const AppMap({
    super.key,
    required this.centre,
    this.zoom = 14,
    this.markers = const [],
    this.circles = const [],
    this.onMoved,
    this.controller,
    this.interactive = true,
    this.unavailable,
  });

  final LatLng centre;
  final double zoom;
  final List<Marker> markers;
  final List<CircleMarker> circles;

  /// Called when the user has finished moving the map, with the part now on screen.
  final ValueChanged<MapArea>? onMoved;
  final MapController? controller;
  final bool interactive;

  /// What to show when no map provider is set.
  final Widget? unavailable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final source = ref.watch(tileSourceProvider);
    return source.when(
      loading: () => const ColoredBox(color: AppColors.green50),
      error: (_, _) => unavailable ?? const ColoredBox(color: AppColors.green50),
      data: (s) {
        if (s == null) return unavailable ?? const ColoredBox(color: AppColors.green50);
        return FlutterMap(
          mapController: controller,
          options: MapOptions(
            initialCenter: toLl(centre),
            initialZoom: zoom,
            maxZoom: s.maxZoom.toDouble(),
            interactionOptions: InteractionOptions(flags: interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none),
            onMapEvent: (e) {
              if (onMoved == null) return;
              if (e is MapEventMoveEnd || e is MapEventFlingAnimationEnd || e is MapEventDoubleTapZoomEnd || e is MapEventScrollWheelZoom) {
                final b = e.camera.visibleBounds;
                onMoved!(MapArea(south: fromLl(b.southWest), north: fromLl(b.northEast), zoom: e.camera.zoom));
              }
            },
          ),
          children: [
            TileLayer(urlTemplate: s.urlTemplate, maxZoom: s.maxZoom.toDouble(), userAgentPackageName: 'com.findhousequick.app'),
            if (circles.isNotEmpty) CircleLayer(circles: circles),
            if (markers.isNotEmpty) MarkerLayer(markers: markers),
            SimpleAttributionWidget(source: Text(s.attribution, style: AppText.bodySmall.copyWith(fontSize: 11, height: 1.2))),
          ],
        );
      },
    );
  }
}
