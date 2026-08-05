/// location_service_stub.dart — Mobile/Desktop Implementierung
///
/// Nutzt Geolocator fuer native Plattformen (iOS, Android, Desktop).
/// Wird ueber bedingten Import in `location_service.dart` automatisch
/// durch `location_service_web.dart` ersetzt, sobald `dart.library.js_interop`
/// vorhanden ist (Flutter Web).

import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Plattform-spezifische Implementierung (Mobile).
/// Auf Web wird diese Datei NICHT kompiliert.
Future<LatLng?> getCurrentLocationImpl() async {
  // 1. Service-Status prüfen
  bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) return null;

  // 2. Permission prüfen
  LocationPermission permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) return null;
  }

  if (permission == LocationPermission.deniedForever) return null;

  // 3. Position abrufen mit Timeout
  try {
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 15),
    );
    return LatLng(position.latitude, position.longitude);
  } catch (e) {
    return null;
  }
}
