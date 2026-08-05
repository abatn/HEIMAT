/// location_service_web.dart — Flutter Web Implementierung
///
/// Nutzt die Browser-Geolocation-API ueber `dart:html`.
/// Wird NUR eingebunden, wenn `dart.library.html` verfuegbar ist.
/// Auf nativen Plattformen kommt `location_service_stub.dart` zum Einsatz.

// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'package:latlong2/latlong.dart';

/// Plattform-spezifische Implementierung (Web).
/// Nutzt Browser-Geolocation-API.
Future<LatLng?> getCurrentLocationImpl() async {
  try {
    // Pruefe ob Geolocation-API verfuegbar ist
    final geo = html.window.navigator.geolocation;

    // Completer fuer async callback
    final completer = _WebCompleter<LatLng?>();

    // Browser Geolocation API aufrufen
    // ignore: unnecessary_statements
    geo.getCurrentPosition().then(
      (html.Geoposition position) {
        final lat = position.coords!.latitude!.toDouble();
        final lng = position.coords!.longitude!.toDouble();
        completer.complete(LatLng(lat, lng));
      },
      onError: (error) {
        completer.complete(null);
      },
    );

    // Timeout nach 10 Sekunden
    return await completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () {
        completer.complete(null);
        return null;
      },
    );
  } catch (e) {
    // Browser erlaubt keine Geolocation oder Fehler
    return null;
  }
}

/// Einfacher Completer fuer Web-Callbacks
class _WebCompleter<T> {
  T? _value;
  bool _completed = false;

  void complete(T value) {
    if (!_completed) {
      _completed = true;
      _value = value;
    }
  }

  Future<T> get future async {
    // Warte bis complete() aufgerufen wurde
    for (var i = 0; i < 100; i++) {
      if (_completed) return _value as T;
      await Future.delayed(const Duration(milliseconds: 100));
    }
    return _value as T;
  }
}
