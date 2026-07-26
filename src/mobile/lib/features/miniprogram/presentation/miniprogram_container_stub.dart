import 'package:flutter/material.dart';

/// Stub-Implementierung für mobile Plattformen (Android/iOS).
/// Da `dart:html` nur auf Flutter Web verfügbar ist, wird diese
/// leere Implementierung beim mobilen Compile-Lauf verwendet.
class MiniProgramContainerWeb extends StatelessWidget {
  final String url;
  const MiniProgramContainerWeb({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    // Mobile WebView wird später via webview_flutter integriert
    return const Center(
      child: Text('WebView für Mobilgeräte in Entwicklung',
          style: TextStyle(color: Colors.grey)),
    );
  }
}
