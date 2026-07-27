import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../weather_dto.dart';

/// HourlyForecastStrip — Horizontale 24h-Wetter-Vorschau.
///
/// **Visualisierung:** ListView.builder horizontal, jede Stunde eine
/// kompakte Card mit Stunde + Emoji + Temperatur + Niederschlag.
///
/// **Kein fl_chart:** Reine Flutter ListView + Container. Schnell, kein
/// zusätzlicher Dependency-Bloat.
class HourlyForecastStrip extends StatelessWidget {
  final List<HourlyForecastDto> hourly;

  const HourlyForecastStrip({super.key, required this.hourly});

  @override
  Widget build(BuildContext context) {
    if (hourly.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Icon(Icons.schedule, color: AppColors.primary, size: 14),
                SizedBox(width: 6),
                Text(
                  'Nächste 24 Stunden',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 110,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: hourly.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) => _HourCard(dto: hourly[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _HourCard extends StatelessWidget {
  final HourlyForecastDto dto;
  const _HourCard({required this.dto});

  @override
  Widget build(BuildContext context) {
    final hour = _parseHour(dto.time);
    final isNow = hour == DateTime.now().hour;
    return Container(
      width: 58,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: isNow ? AppColors.primary.withOpacity(0.10) : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: isNow ? Border.all(color: AppColors.primary, width: 1) : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            isNow ? 'Jetzt' : '$hour Uhr',
            style: TextStyle(
              fontSize: 10,
              fontWeight: isNow ? FontWeight.w700 : FontWeight.w500,
              color: isNow ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _emojiForCode(dto.weatherCode),
            style: const TextStyle(fontSize: 22),
          ),
          const SizedBox(height: 4),
          Text(
            '${dto.temperature.toStringAsFixed(0)}°',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          if (dto.precipitation > 0.1)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.water_drop, size: 9, color: AppColors.info),
                  const SizedBox(width: 2),
                  Text(
                    '${dto.precipitation.toStringAsFixed(1)}',
                    style: const TextStyle(
                      fontSize: 9,
                      color: AppColors.info,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static int _parseHour(String iso) {
    try {
      // "2026-07-27T15:00" oder "2026-07-27T15:00:00"
      final tIdx = iso.indexOf('T');
      if (tIdx < 0 || tIdx + 3 > iso.length) return 0;
      final hourStr = iso.substring(tIdx + 1, tIdx + 3);
      return int.tryParse(hourStr) ?? 0;
    } catch (_) {
      return 0;
    }
  }

  static String _emojiForCode(int code) {
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
