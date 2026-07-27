// =========================================================================
// AppNavigator — statischer Tab-Switch Callback.
//
// Pattern-Mirror zu HomeProvider.onUserAction (cross-feature static
// callback, gesetzt von main.dart). Vermeidet zirkulare Imports zwischen
// feature-Screens und main.dart weil hier in core/ liegt —
// jeder Sub-Baum (Wetter, Mobility, ...) kann ihn importieren ohne
// main.dart-Datei anzufassen.
// =========================================================================

/// AppNavigator — globaler Tab-Switch Callback.
///
/// **Set in main.dart:** _MainScreenState.initState() setzt diesen Callback
/// damit Wetter-Tab, Mobility-Tab etc. aus beliebigen Sub-Baeumen
/// (z.B. Cross-Service-Insight-Karten im Mini-Program-Container) zum
/// richtigen MainScreen-Tab springen koennen.
///
/// **Use** in feature-Widgets:
/// ```dart
/// AppNavigator.switchMainTab?.call(1); // 0=Dashboard, 1=Mobility, 2=Finance, ...
/// ```
///
/// **Replaced on logout/relogin** — _MainScreenState.dispose() cleared mit
/// identical-Check, ein neuer MainScreen ueberschreibt das Field.
class AppNavigator {
  AppNavigator._();

  /// Index 0=Dashboard, 1=Mobility, 2=Finance, 3=Health, 4=Apps.
  static void Function(int tabIndex)? switchMainTab;
}
