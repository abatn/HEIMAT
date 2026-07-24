import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class AuthService {
  static const String _tokenKey = 'auth_token';
  static const String _userIdKey = 'user_id';
  static const String _emailKey = 'user_email';
  static const String _displayNameKey = 'user_display_name';

  String? _token;
  String? _userId;
  String? _email;
  String? _displayName;

  String? get token => _token;
  String? get userId => _userId;
  String? get email => _email;
  String? get displayName => _displayName;
  bool get isAuthenticated => _token != null && _userId != null;

  Future<void> loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    _userId = prefs.getString(_userIdKey);
    _email = prefs.getString(_emailKey);
    _displayName = prefs.getString(_displayNameKey);
  }

  Future<void> _saveToStorage() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token != null) {
      await prefs.setString(_tokenKey, _token!);
    }
    if (_userId != null) {
      await prefs.setString(_userIdKey, _userId!);
    }
    if (_email != null) {
      await prefs.setString(_emailKey, _email!);
    }
    if (_displayName != null) {
      await prefs.setString(_displayNameKey, _displayName!);
    }
  }

  Future<void> _clearStorage() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_displayNameKey);
  }

  Future<AuthResult> login(String email, String password) async {
    try {
      final url = '${AppConfig.backendUrl}/api/auth/login';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _token = data['accessToken'];
        _userId = data['user']['id'];
        _email = data['user']['email'];
        _displayName = data['user']['display_name'];
        await _saveToStorage();
        return AuthResult.success();
      } else {
        final data = json.decode(response.body);
        return AuthResult.error(data['message'] ?? 'Login fehlgeschlagen');
      }
    } catch (e) {
      return AuthResult.error('Netzwerkfehler: $e');
    }
  }

  Future<AuthResult> register(
      String email, String password, String displayName) async {
    try {
      final url = '${AppConfig.backendUrl}/api/auth/register';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'email': email,
              'password': password,
              'display_name': displayName,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        _token = data['accessToken'];
        _userId = data['user']['id'];
        _email = data['user']['email'];
        _displayName = data['user']['display_name'];
        await _saveToStorage();
        return AuthResult.success();
      } else {
        final data = json.decode(response.body);
        return AuthResult.error(
            data['message'] ?? 'Registrierung fehlgeschlagen');
      }
    } catch (e) {
      return AuthResult.error('Netzwerkfehler: $e');
    }
  }

  Future<void> logout() async {
    _token = null;
    _userId = null;
    _email = null;
    _displayName = null;
    await _clearStorage();
  }

  Map<String, String> get authHeaders => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };
}

class AuthResult {
  final bool success;
  final String? error;

  AuthResult.success()
      : success = true,
        error = null;

  AuthResult.error(this.error) : success = false;
}
