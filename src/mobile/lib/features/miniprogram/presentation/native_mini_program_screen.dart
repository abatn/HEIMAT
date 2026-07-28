import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../domain/service_registry.dart';
import 'miniprogram_provider.dart';
import 'miniprogram_model.dart';

/// NativeMiniProgramScreen — Ein einziger Routing-Punkt für ALLE Services.
///
/// **Phase X.1 (Eliminierung IFrame-Einbettung, 2026-07-28):**
/// 1. Schaut in ServiceRegistry.lookup(id), ob ein nativer Flutter-Builder existiert
/// 2. Wenn ja: ruft [ServiceDefinition.nativeBuilder] auf → natives Widget
/// 3. Wenn nein: zeigt ComingSoonScreen als ehrlichen Placeholder
///
/// **KEIN IFrame-Fallback mehr.** Alle externen Webseiten-Embeds sind entfernt.
/// User-Regel-Konform: kein Mock, keine externen Webseiten-Aufrufe, kein WebView.
///
/// **AI-Architektur.md konform:** Native Flutter statt WebView.
class NativeMiniProgramScreen extends StatelessWidget {
  final MiniProgram program;

  const NativeMiniProgramScreen({super.key, required this.program});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(program.name),
        backgroundColor: Colors.white,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            context.read<MiniProgramProvider>().closeProgram();
            Navigator.of(context).pop();
          },
        ),
      ),
      body: _body(context),
    );
  }

  Widget _body(BuildContext context) {
    final def = ServiceRegistry.instance.lookup(program.id);

    if (def != null && def.isNative) {
      // Native Flutter path (Phase X.1: alle registrierten Services haben
      // entweder echten Screen oder ComingSoonScreen-Placeholder).
      return def.nativeBuilder!(context);
    }

    // Defensive fallback: unbekannte Service-ID → ComingSoonScreen-Pattern
    // statt IFrame. So bleibt das System auch ohne IFrame-Code funktional.
    return _unknownServiceFallback(context);
  }

  Widget _unknownServiceFallback(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.help_outline,
                size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              'Service "${program.id}" unbekannt',
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Dieser Service ist nicht in der ServiceRegistry registriert.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
