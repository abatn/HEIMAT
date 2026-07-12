class AppConfig {
  static const String appName = 'HEIMAT 2.0';
  static const String version = '1.0.0';

  static String get backendUrl {
    return const String.fromEnvironment(
      'BACKEND_URL',
      defaultValue: 'http://localhost:3000',
    );
  }

  static String get mlServiceUrl {
    return const String.fromEnvironment(
      'ML_SERVICE_URL',
      defaultValue: 'http://localhost:8000',
    );
  }
}
