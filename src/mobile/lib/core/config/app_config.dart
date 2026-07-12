import 'dart:io' show Platform;

class AppConfig {
  static const String appName = 'HEIMAT 2.0';
  static const String version = '1.0.0';

  static String get backendUrl {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    } else if (Platform.isIOS) {
      return 'http://localhost:3000';
    } else {
      return 'http://localhost:3000';
    }
  }

  static const String mlServiceUrl = 'http://localhost:8000';
  static const String openStreetMapUrl = 'https://tile.openstreetmap.org';
  static const String openRouteServiceUrl = 'https://router.project-osrm.org';
}
