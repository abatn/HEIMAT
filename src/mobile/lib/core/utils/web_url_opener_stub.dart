// Default-Implementierung für Nicht-Web-Plattformen.
//
// Wird über bedingten Import in `health_screen.dart` automatisch durch
// `web_url_opener_web.dart` ersetzt, sobald `dart.library.js_interop`
// vorhanden ist (Flutter Web). Auf nativen Plattformen gibt es keinen
// eingebetteten Browser-Tab; die Aufruferin muss ohnehin einen
// Nicht-Web-Fallback (z.B. Clipboard + SnackBar) anbieten — diese
// Funktion ist hier ein No-op.
Future<void> openInWebTab(String url) async {
  // bewusst leer: keine Browser-Tab-API auf Mobile
}
