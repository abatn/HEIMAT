/// daily_briefing_screen.dart — Tages-Briefing Screen
///
/// Ein intelligenter Dashboard-Screen der ALLES kombiniert:
/// Wetter + Luftqualitaet + Abfall + Parken + E-Laden + Smart Alerts
///
/// Design: Glas-Aesthetik mit farbigen Karten pro Service

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/services/location_service.dart';
import 'daily_briefing_dto.dart';

class DailyBriefingScreen extends StatefulWidget {
  const DailyBriefingScreen({super.key});

  @override
  State<DailyBriefingScreen> createState() => _DailyBriefingScreenState();
}

class _DailyBriefingScreenState extends State<DailyBriefingScreen> {
  DailyBriefingDto? _briefing;
  bool _loading = true;
  String? _error;
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    final pos = await LocationService.getCurrentLocation().timeout(
      const Duration(seconds: 5),
      onTimeout: () => null,
    );
    if (pos != null && mounted) {
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
      });
      _loadBriefing();
    } else if (mounted) {
      setState(() {
        _error = 'Standort nicht verfügbar. Bitte GPS aktivieren.';
        _loading = false;
      });
    }
  }

  Future<void> _loadBriefing() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_lat == null || _lng == null) return;
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/daily-briefing'
          '?lat=$_lat&lng=$_lng',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _briefing = DailyBriefingDto.fromJson(json);
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
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: _getGradientColors(),
          ),
        ),
        child: SafeArea(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Colors.white,
                  ),
                )
              : _error != null
                  ? _buildError()
                  : _buildContent(),
        ),
      ),
    );
  }

  List<Color> _getGradientColors() {
    final period = _briefing?.period ?? 'morning';
    switch (period) {
      case 'morning':
        return [Colors.blue.shade300, Colors.orange.shade200];
      case 'afternoon':
        return [Colors.blue.shade400, Colors.blue.shade200];
      case 'evening':
        return [Colors.indigo.shade400, Colors.purple.shade200];
      case 'night':
        return [Colors.indigo.shade800, Colors.indigo.shade400];
      default:
        return [Colors.blue.shade300, Colors.blue.shade100];
    }
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.white),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadBriefing,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_briefing == null) return const SizedBox.shrink();

    return RefreshIndicator(
      onRefresh: _loadBriefing,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Greeting
          _buildGreeting(),
          const SizedBox(height: 24),

          // Alerts
          if (_briefing!.alerts.isNotEmpty) ...[
            _buildAlerts(),
            const SizedBox(height: 16),
          ],

          // Weather Card
          if (_briefing!.weather != null) ...[
            _buildWeatherCard(_briefing!.weather!),
            const SizedBox(height: 12),
          ],

          // Air Quality Card
          if (_briefing!.airQuality != null) ...[
            _buildAirQualityCard(_briefing!.airQuality!),
            const SizedBox(height: 12),
          ],

          // Waste Card
          if (_briefing!.waste != null && _briefing!.waste!.available) ...[
            _buildWasteCard(_briefing!.waste!),
            const SizedBox(height: 12),
          ],

          // Parking + EV Charging Row
          Row(
            children: [
              if (_briefing!.parking != null)
                Expanded(child: _buildParkingCard(_briefing!.parking!)),
              if (_briefing!.parking != null && _briefing!.evCharging != null)
                const SizedBox(width: 12),
              if (_briefing!.evCharging != null)
                Expanded(child: _buildEvCard(_briefing!.evCharging!)),
            ],
          ),

          // Tips
          if (_briefing!.tips.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildTips(),
          ],
        ],
      ),
    );
  }

  Widget _buildGreeting() {
    return Text(
      _briefing!.greeting,
      style: const TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.bold,
        color: Colors.white,
      ),
    );
  }

  Widget _buildAlerts() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '⚠️ WARNUNGEN',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        ...(_briefing!.alerts.map((alert) => _buildAlertItem(alert))),
      ],
    );
  }

  Widget _buildAlertItem(AlertDto alert) {
    Color bgColor;
    switch (alert.priority) {
      case 'high':
        bgColor = Colors.red.shade400;
        break;
      case 'medium':
        bgColor = Colors.orange.shade400;
        break;
      default:
        bgColor = Colors.blue.shade400;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor.withOpacity(0.9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text(alert.icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              alert.message,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeatherCard(WeatherInfo weather) {
    return _GlassCard(
      child: Row(
        children: [
          Text(
            _getWeatherEmoji(weather.condition),
            style: const TextStyle(fontSize: 48),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${weather.temperature.toStringAsFixed(1)}°C',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  weather.condition,
                  style: const TextStyle(
                    fontSize: 16,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAirQualityCard(AirQualityInfo aq) {
    final color = _getAqiColor(aq.aqi);
    return _GlassCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                '${aq.aqi}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '🌬️ Luftqualität',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                ),
                Text(
                  aq.level,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWasteCard(WasteInfo waste) {
    return _GlassCard(
      child: Row(
        children: [
          const Text('🗑️', style: TextStyle(fontSize: 32)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Nächster Müll',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                ),
                Text(
                  waste.category ?? 'Keine Daten',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                if (waste.nextEvent != null)
                  Text(
                    waste.nextEvent!,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.white70,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParkingCard(ParkingInfo parking) {
    return _GlassCard(
      child: Column(
        children: [
          const Text('🅿️', style: TextStyle(fontSize: 32)),
          const SizedBox(height: 8),
          Text(
            '${parking.count}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const Text(
            'Parkplätze',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEvCard(EvChargingInfo ev) {
    return _GlassCard(
      child: Column(
        children: [
          const Text('⚡', style: TextStyle(fontSize: 32)),
          const SizedBox(height: 8),
          Text(
            '${ev.count}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const Text(
            'Ladestationen',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTips() {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '💡 HEUTIGE TIPPS',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white70,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          ...(_briefing!.tips.map((tip) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('• ', style: TextStyle(color: Colors.white70)),
                    Expanded(
                      child: Text(
                        tip,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ))),
        ],
      ),
    );
  }

  String _getWeatherEmoji(String condition) {
    final lower = condition.toLowerCase();
    if (lower.contains('sonne') || lower.contains('klar')) return '☀️';
    if (lower.contains('regen')) return '🌧️';
    if (lower.contains('schnee')) return '❄️';
    if (lower.contains('wolk') || lower.contains('bewölkt')) return '⛅';
    if (lower.contains('nebel')) return '🌫️';
    if (lower.contains('wind')) return '💨';
    return '🌤️';
  }

  Color _getAqiColor(int aqi) {
    if (aqi <= 20) return Colors.green;
    if (aqi <= 40) return Colors.lightGreen;
    if (aqi <= 60) return Colors.orange;
    if (aqi <= 80) return Colors.deepOrange;
    if (aqi <= 100) return Colors.red;
    return Colors.red.shade900;
  }
}

/// Glass-morphism Card
class _GlassCard extends StatelessWidget {
  final Widget child;

  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
        ),
      ),
      child: child,
    );
  }
}
