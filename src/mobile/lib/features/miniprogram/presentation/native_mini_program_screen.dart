import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../domain/service_registry.dart';
import 'miniprogram_container.dart';
import 'miniprogram_provider.dart';
import 'miniprogram_model.dart';

/// NativeMiniProgramScreen — Ein einziger Routing-Punkt für ALLE Services.
///
/// **Phase E Migration:**
/// 1. Schaut in ServiceRegistry.lookup(id), ob ein nativer Flutter-Builder existiert
/// 2. Wenn ja: ruft [ServiceDefinition.nativeBuilder] auf → natives Widget
/// 3. Wenn nein: fällt auf MiniProgramContainer zurück (IFrame / Mobile-Fallback)
///
/// Diese Hierarchie erlaubt pro Service einzeln zu migrieren ohne Breaking Changes.
/// Andere Services (air, finance, etc.) zeigen weiterhin ihr IFrame-Verhalten,
/// bis sie ebenfalls einen nativeBuilder in der Registry bekommen.
///
/// **AI-Architektur.md konform:** Native Flutter statt WebView wo möglich.
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
      // Native Flutter path — Phase E
      return def.nativeBuilder!(context);
    }

    // Fallback: bestehender IFrame-Pfad (für nicht-migrierte Services)
    return MiniProgramContainer(url: program.url, title: program.name);
  }
}
