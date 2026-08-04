/// smart_alerts_screen.dart — Intelligente Erinnerungen & Benachrichtigungen
///
/// Ein Screen der proaktive Alerts basierend auf Wetter, Luft, Müll, Parken anzeigt.
/// Backend: GET /api/smart-alerts?lat=...&lng=...
///
/// Design: Prioritäts-basierte Karten mit Farb-Codierung

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'smart_alerts_dto.dart';

class SmartAlertsScreen extends StatefulWidget {
  final double lat;
  final double lng;

  const SmartAlertsScreen({
    super.key,
    this.lat = 52.52,
    this.lng = 13.41,
  });

  @override
  State<SmartAlertsScreen> createState() => _SmartAlertsScreenState();
}

class _SmartAlertsScreenState extends State<SmartAlertsScreen> {
  SmartAlertsResponse? _response;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/smart-alerts'
          '?lat=${widget.lat}&lng=${widget.lng}',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _response = SmartAlertsResponse.fromJson(json);
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Fehler: ${response.statusCode}';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Netzwerkfehler: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🔔 Erinnerungen'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.indigo.shade400, Colors.indigo.shade800],
          ),
        ),
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.white))
            : _error != null
                ? _buildError()
                : _buildContent(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.notifications_off,
                size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadAlerts,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_response == null || _response!.alerts.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Alles gut! Keine Warnungen.',
              style: TextStyle(color: Colors.white, fontSize: 18),
            ),
            SizedBox(height: 8),
            Text(
              'Wir informieren dich, wenn etwas Wichtiges passiert.',
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAlerts,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Text(
            '${_response!.alerts.length} Erinnerung${_response!.alerts.length == 1 ? '' : 'en'}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Generiert: ${_formatTime(_response!.generatedAt)}',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
          const SizedBox(height: 20),

          // High priority alerts
          ..._response!.alerts
              .where((a) => a.priority == 'high')
              .map((alert) => _buildAlertCard(alert, isHigh: true)),

          // Medium priority alerts
          ..._response!.alerts
              .where((a) => a.priority == 'medium')
              .map((alert) => _buildAlertCard(alert, isHigh: false)),

          // Low priority alerts
          ..._response!.alerts
              .where((a) => a.priority == 'low')
              .map((alert) => _buildAlertCard(alert, isHigh: false)),
        ],
      ),
    );
  }

  Widget _buildAlertCard(SmartAlertDto alert, {required bool isHigh}) {
    final bgColor = _getPriorityColor(alert.priority);
    final iconBg = _getTypeColor(alert.type);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bgColor.withOpacity(0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 1,
        ),
        boxShadow: isHigh
            ? [
                BoxShadow(
                  color: bgColor.withOpacity(0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon circle
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  alert.icon,
                  style: const TextStyle(fontSize: 24),
                ),
              ),
            ),
            const SizedBox(width: 16),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      if (isHigh)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.red.shade400,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'WICHTIG',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    alert.message,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.white70,
                      height: 1.3,
                    ),
                  ),
                  if (alert.expiresAt != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      '⏰ ${_formatExpiry(alert.expiresAt!)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.white54,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getPriorityColor(String priority) {
    switch (priority) {
      case 'high':
        return Colors.red.shade700;
      case 'medium':
        return Colors.orange.shade700;
      default:
        return Colors.blue.shade700;
    }
  }

  Color _getTypeColor(String type) {
    switch (type) {
      case 'waste':
        return Colors.green.shade800;
      case 'weather':
        return Colors.blue.shade800;
      case 'airquality':
        return Colors.teal.shade800;
      case 'transit':
        return Colors.purple.shade800;
      case 'parking':
        return Colors.indigo.shade800;
      default:
        return Colors.grey.shade800;
    }
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  String _formatExpiry(String iso) {
    try {
      final dt = DateTime.parse(iso);
      final now = DateTime.now();
      final diff = dt.difference(now);
      if (diff.inHours < 1) {
        return 'In ${diff.inMinutes} Minuten';
      } else if (diff.inHours < 24) {
        return 'In ${diff.inHours} Stunden';
      } else {
        return 'In ${diff.inDays} Tagen';
      }
    } catch (_) {
      return iso;
    }
  }
}
