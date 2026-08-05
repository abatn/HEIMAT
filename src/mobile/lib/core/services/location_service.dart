/// location_service.dart — Standort-Dienst fuer HEIMAT
///
/// Nutzt bedingten Import fuer Web/ Mobile:
/// - Mobile/Desktop: Geolocator (nativer GPS-Zugriff)
/// - Flutter Web: Browser-Geolocation-API
///
/// Pattern-Mirror zu web_url_opener.dart (Conditional Import).

import 'package:latlong2/latlong.dart';
import 'location_service_stub.dart'
    if (dart.library.js_interop) 'location_service_web.dart';

class LocationService {
  /// Laedt den aktuellen Standort ueber die Plattform-spezifische API.
  /// Gibt null zurueck wenn:
  /// - Standortdienst deaktiviert
  /// - Berechtigung verweigert
  /// - Timeout (15s Mobile, 10s Web)
  /// - Browser erlaubt keinen Standortzugriff (Web)
  static Future<LatLng?> getCurrentLocation() => getCurrentLocationImpl();
}
