import 'dart:io' show Platform;

class AppConfig {
  static const String appName = 'HEIMAT 2.0';
  static const String version = '1.0.0';

  // API Endpoints – plattformabhängig
  static String get backendUrl {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000'; // Android Emulator
    } else if (Platform.isIOS) {
      return 'http://localhost:3000'; // iOS Simulator
    } else {
      return 'http://localhost:3000'; // Web/Desktop
    }
  }

  static const String mlServiceUrl = 'http://localhost:8000';

  // Open Source APIs
  static const String openStreetMapUrl = 'https://tile.openstreetmap.org';
  static const String openRouteServiceUrl = 'https://router.project-osrm.org';
}
