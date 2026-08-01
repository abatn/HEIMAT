// Web-Implementierung des URL-Openers.
//
// Wird NUR eingebunden, wenn `dart.library.js_interop` verfügbar ist,
// also ausschließlich auf Flutter-Web-Targets. Auf nativen Plattformen
// kommt `web_url_opener_stub.dart` (no-op) zum Einsatz.
//
// `package:web` 1.1.1 ist im aktuellen `pubspec.lock` als transitive
// Abhängigkeit vorhanden — kein Eintrag in `pubspec.yaml` nötig.
import 'package:web/web.dart' as web;

/// Öffnet [url] in einem neuen Browser-Tab. Die Funktion gibt `void` zurück,
// weil `window.open` synchron ist und keinen Ladezustand liefert; Fehler
/// werden vom Browser selbst behandelt (Popup-Blocker, ungültige URL).
Future<void> openInWebTab(String url) async {
  // Der Aufruf erfolgt ausschließlich innerhalb einer `kIsWeb`-Branche
  // im Aufrufer, sodass diese Funktion auf Mobile nie erreicht wird.
  web.window.open(url, '_blank');
}
