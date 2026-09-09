import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Saji API client — JWT auth, mirrors web auth.svelte.ts
class Api {
  // ponytail: LAN IP of dev machine; add --dart-define=API_URL for other hosts
  static const baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://192.168.0.151:3000');
  static const _tokenKey = 'saji-user-token';

  String? _token;
  Map<String, dynamic>? user;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  bool get isAuthed => _token != null;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> _post(String path, [Map<String, dynamic>? body]) async {
    final res = await http.post(Uri.parse('$baseUrl$path'),
        headers: _headers, body: body != null ? jsonEncode(body) : null);
    final data = res.body.isNotEmpty ? jsonDecode(res.body) : <String, dynamic>{};
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, data is Map ? (data['error'] ?? 'Request gagal') : 'Request gagal');
    }
    return data is Map<String, dynamic> ? data : {'data': data};
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    final data = res.body.isNotEmpty ? jsonDecode(res.body) : <String, dynamic>{};
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, data is Map ? (data['error'] ?? 'Request gagal') : 'Request gagal');
    }
    return data is Map<String, dynamic> ? data : {'data': data};
  }

  // ── Auth ──
  Future<void> login(String email, String password) async {
    final data = await _post('/api/auth/login', {'email': email, 'password': password});
    _token = data['token'] as String;
    user = data['user'] as Map<String, dynamic>?;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, _token!);
  }

  Future<void> register(String email, String password, String fullName) async {
    final data = await _post('/api/auth/register', {'email': email, 'password': password, 'full_name': fullName});
    _token = data['token'] as String;
    user = data['user'] as Map<String, dynamic>?;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, _token!);
  }

  Future<void> fetchMe() async {
    final data = await _get('/api/auth/me');
    user = data['user'] as Map<String, dynamic>?;
  }

  Future<void> logout() async {
    _token = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  // ── Plans ──
  Future<Map<String, dynamic>> getHistory() => _get('/api/plans/history');

  Future<Map<String, dynamic>> generatePlan() => _post('/api/plans/generate');

  Future<Map<String, dynamic>> markCooked(int? planId) =>
      _post('/api/plans/cook', {'planId': planId});

  Future<Map<String, dynamic>> getCookingSteps() => _post('/api/plans/cooking-steps');

  Future<Map<String, dynamic>> getGroceryList() => _post('/api/plans/grocery-list');

  Future<Map<String, dynamic>> remix(String leftovers) =>
      _post('/api/plans/leftover-remix', {'leftovers': leftovers});

  // ── Calendar + badges ──
  Future<Map<String, dynamic>> getCalendar([int week = 0]) => _get('/api/calendar?week=$week');

  Future<Map<String, dynamic>> getBadges() => _get('/api/badges');
}

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

final api = Api();
