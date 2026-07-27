import '../../weather/weather_screen.dart';
import 'service_definition.dart';

/// ServiceRegistry — Singleton-Verzeichnis aller HEIMAT-Services.
///
/// **Phase E Native:** Ersetzt schrittweise die alte MiniProgramContainer
/// IFrame-Logik. Wenn ein Service einen nativeBuilder hat, wird das native
/// Flutter-Widget gerendert (kein IFrame).
///
/// **Status pro Service:**
/// - ✅ `weather` → Native Flutter (Phase E Pilot)
/// - ⏳ air, mobility, finance, health, futai, events, jobs, waste, hotels, buergeramt → IFrame-Fallback
///
/// **Erweiterung:** Für jeden neuen Service einfach einen Eintrag in
/// [_definitions] ergänzen. Tap-Routing via NativeMiniProgramScreen.
class ServiceRegistry {
  ServiceRegistry._();
  static final ServiceRegistry instance = ServiceRegistry._();

  /// Lookup-Map aller registrierten Services
  final Map<String, ServiceDefinition> _definitions =
      <String, ServiceDefinition>{};

  /// Initialisierung — Wetter wird als erstes nativen Service registriert.
  /// Lazy-Loading: das weather.dart File wird hier importiert, aber das
  /// eigentliche Widget wird nur bei Tap gebaut.
  void initialize() {
    _definitions.addAll({
      'weather': ServiceDefinition(
        id: 'weather',
        name: 'Wetter',
        fallbackUrl: 'https://heimat-backend.onrender.com/mini/weather.html',
        nativeBuilder: (_) => const WeatherScreen(),
      ),
      // Alle anderen Services bleiben vorerst im IFrame-Fallback-Modus.
      // Die fallbackUrl wird im bestehenden MiniProgramProvider gepflegt.
      // Hier registrieren wir nur die NATIVEN Services, der Rest defaultet
      // im NativeMiniProgramScreen auf MiniProgramContainer.
    });
  }

  /// Liefert die ServiceDefinition für eine ID, oder null wenn unbekannt.
  ServiceDefinition? lookup(String id) => _definitions[id];

  /// True wenn der Service ein nativen Flutter-Builder hat.
  bool isNative(String id) => _definitions[id]?.isNative ?? false;
}
