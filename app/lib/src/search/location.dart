import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'search_api.dart';

enum LocationOutcome { found, denied, deniedForever, unavailable }

/// Reads where the phone is, once, for "around me". The position is used for that one search and never stored
/// (Specification 15.2).
class LocationReader {
  const LocationReader();

  static const _askedKey = 'location.explained.v1';

  /// Whether the explanation (screen 10) has been shown before the phone first asks.
  Future<bool> explained() async {
    try {
      return (await SharedPreferences.getInstance()).getBool(_askedKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<void> markExplained() async {
    try {
      await (await SharedPreferences.getInstance()).setBool(_askedKey, true);
    } catch (_) {}
  }

  Future<(LocationOutcome, LatLng?)> read() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return (LocationOutcome.unavailable, null);
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.deniedForever) return (LocationOutcome.deniedForever, null);
      if (permission == LocationPermission.denied) return (LocationOutcome.denied, null);
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)));
      return (LocationOutcome.found, LatLng(p.latitude, p.longitude));
    } catch (_) {
      return (LocationOutcome.unavailable, null);
    }
  }

  Future<void> openSettings() => Geolocator.openAppSettings();
}
