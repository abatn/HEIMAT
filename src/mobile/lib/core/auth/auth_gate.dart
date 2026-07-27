import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../features/auth/presentation/auth_provider.dart';
import '../../features/auth/presentation/login_screen.dart';

/// Single-Source-of-Truth für Auth-Routing.
///
/// Rendert [LoginScreen] wenn [AuthProvider.isAuthenticated] false ist.
/// Sobald Auth eintritt, wechselt es auf [authenticated].
/// In main.dart wird das echte MainScreen injiziert.
/// In Tests wird ein Mock-Widget injiziert (kein AppShell-Bootstrap noetig).
///
/// AuthLock-Vertrag:
/// - Diese Klasse ist der EINZige Ort im Code der auth-zustandsabhaengige
///   Routen-Entscheidungen trifft.
/// - main.dart darf NIEMALS direkt zwischen LoginScreen und MainScreen
///   schalten ohne durch dieses Gate zu gehen.
/// - Test-Coverage in test/auth_gate_test.dart und test/auth_integration_test.dart
///   haelt diese Invariante fest.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.authenticated});

  /// Was gerendert wird wenn [AuthProvider.isAuthenticated] true ist.
  /// Required (kein Default) damit Caller explizit entscheiden muessen —
  /// verhindert stillschweigende Default-Widget-Bugs.
  final Widget authenticated;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isAuthenticated) {
      return authenticated;
    }
    return const LoginScreen();
  }
}
