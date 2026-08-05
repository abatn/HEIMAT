/// location_service_web.dart — Flutter Web Implementierung
///
/// Gibt null zurueck (kein GPS auf Web).
/// Auf nativen Plattformen kommt `location_service_stub.dart` zum Einsatz.
///
/// GRUND: dart:html verursacht WebSocket-Abhaengigkeiten die im CI crashen.
/// Die Browser-Geolocation-API koennte spaeter per `package:web` + JS-Interop
/// integriert werden.

import 'package:latlong2/latlong.dart';

/// Plattform-spezifische Implementierung (Web).
/// Gibt null zurueck — Web-Browser haben keinen automatischen GPS-Zugriff.
Future<LatLng?> getCurrentLocationImpl() async {
  return null;
}
