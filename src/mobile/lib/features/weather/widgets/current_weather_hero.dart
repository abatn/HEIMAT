import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../weather_dto.dart';

/// CurrentWeatherHero — Große Hauptkarte für aktuelles Wetter.
///
/// **Visualisierung:** Pure Flutter Container mit LinearGradient.
/// Kein fl_chart, kein flutter_map, kein WebView. Konsistent mit der
/// HEIMAT-Theming-Palette (primary, primaryLight).
///
/// **Inhalt:**
/// - Großer Temperatur-Wert (°C, very prominent)
/// - Weather-Code als Emoji (Open-Meteo Standard)
/// - Weather-Text (z.B. "Teilweise bewölkt")
/// - Feels-Like + Luftfeuchtigkeit als Sub-Metriken
///
/// **Stale-Hinweis:** kleiner "Zuletzt aktualisiert"-Badge wenn [isStale].
class CurrentWeatherHero extends StatelessWidget {
  final CurrentWeatherDto current;
  final String locationName;
  final bool isStale;

  const CurrentWeatherHero({
    super.key,
    required this.current,
    required this.locationName,
    this.isStale = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.22),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.location_on_outlined,
                  color: Colors.white, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  locationName.isEmpty ? 'Aktueller Standort' : locationName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isStale)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.22),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cloud_off, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text(
                        'veraltet',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                _emojiForCode(current.weatherCode),
                style: const TextStyle(fontSize: 56),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${current.temperature.toStringAsFixed(1)}°C',
                      style: const TextStyle(
                        fontSize: 44,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      current.weatherText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                _subMetric(
                    'Gefühlt', '${current.feelsLike.toStringAsFixed(1)}°C'),
                _separator(),
                _subMetric('Feuchte', '${current.humidity}%'),
                _separator(),
                _subMetric(
                    'Wind', '${current.windSpeed.toStringAsFixed(1)} km/h'),
                _separator(),
                _subMetric('UV', current.uvIndex.toStringAsFixed(1)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _subMetric(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: Colors.white.withOpacity(0.78),
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _separator() {
    return Container(
      width: 1,
      height: 28,
      color: Colors.white.withOpacity(0.22),
      margin: const EdgeInsets.symmetric(horizontal: 4),
    );
  }

  /// WMO-Code → Emoji (gleiches Mapping wie Backend wmoToIcon in weatherService.ts,
  /// hier inline für die mobile Visualisierung).
  String _emojiForCode(int code) {
    if (code == 0) return '☀️';
    if (code == 1 || code == 2) return '⛅';
    if (code == 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 57) return '🌦️';
    if (code >= 61 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  }
}
