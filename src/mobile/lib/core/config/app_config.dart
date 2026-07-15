class AppConfig {
  static const String appName = 'HEIMAT 2.0';
  static const String version = '1.0.0';

  static String get backendUrl {
    const url = String.fromEnvironment(
      'BACKEND_URL',
      defaultValue: 'https://heimat-backend.fly.dev',
    );
    return url;
  }

  static String get mlServiceUrl {
    const url = String.fromEnvironment(
      'ML_SERVICE_URL',
      defaultValue: 'http://localhost:8000',
    );
    return url;
  }
}
