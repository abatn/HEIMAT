// ignore_for_file: undefined_shown_name

import 'dart:html' show IFrameElement;
import 'dart:ui' as ui show platformViewRegistry;
import 'package:flutter/material.dart';

/// Web-spezifischer MiniProgram-Container mit IFrameElement.
/// Nur auf Flutter Web kompilierbar (conditional import).
class MiniProgramContainerWeb extends StatelessWidget {
  final String url;
  const MiniProgramContainerWeb({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    final id = 'mp-iframe-${url.hashCode}';
    // ignore: undefined_prefixed_name
    ui.platformViewRegistry.registerViewFactory(
      id,
      (int viewId) => IFrameElement()
        ..src = url
        ..width = '100%'
        ..height = '100%'
        ..style.border = 'none'
        ..allow = 'geolocation *; clipboard-read *; clipboard-write *',
    );
    return HtmlElementView(viewType: id);
  }
}
