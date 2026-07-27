import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../weather_dto.dart';

/// WeeklyOutlookGrid — 7-Tage-Vorhersage (vertikale Cards).
///
/// **Visualisierung:**
/// - Pro Tag: Wochentag (Mo/Di/Mi/...) + Emoji + Max/Min-Temp
/// - Eigener `CustomPainter` zeigt Min/Max-Temperaturskala als Gradient-Balken
///   (Skala wird vom Parent aus der vollen 7-Tage-Liste berechnet NICHT via
///    statische Felder, weil sonst alte Werte bei Location-Wechsel stehen bleiben.)
///
/// **Kein fl_chart:** Temperaturskala ist CustomPainter (~30 Zeilen).
class WeeklyOutlookGrid extends StatelessWidget {
  final List<DailyForecastDto> daily;

  const WeeklyOutlookGrid({super.key, required this.daily});

  @override
  Widget build(BuildContext context) {
    if (daily.isEmpty) return const SizedBox.shrink();

    // Skala EINMAL aus der vollen 7-Tage-Liste berechnen — kein Static-State,
    // kein Stale-Cache bei Location-Wechsel. parentOwned -> rebuild-safe.
    final scaleMin = daily.map((d) => d.temperatureMin).reduce(math.min);
    final scaleMax = daily.map((d) => d.temperatureMax).reduce(math.max);

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
                Icon(Icons.calendar_today, color: AppColors.primary, size: 14),
                SizedBox(width: 6),
                Text(
                  '7-Tage-Vorhersage',
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
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: daily.length,
            separatorBuilder: (_, __) => Divider(
              height: 1,
              thickness: 0.5,
              indent: 16,
              endIndent: 16,
              color: AppColors.border.withOpacity(0.6),
            ),
            itemBuilder: (ctx, i) => _DayRow(
              dto: daily[i],
              scaleMin: scaleMin,
              scaleMax: scaleMax,
            ),
          ),
        ],
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  final DailyForecastDto dto;
  final double scaleMin;
  final double scaleMax;
  const _DayRow({
    required this.dto,
    required this.scaleMin,
    required this.scaleMax,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 48,
            child: Text(
              _weekdayLabel(dto.date, isToday: _isToday(dto.date)),
              style: TextStyle(
                fontSize: 13,
                fontWeight:
                    _isToday(dto.date) ? FontWeight.w700 : FontWeight.w500,
                color: _isToday(dto.date)
                    ? AppColors.primary
                    : AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Text(_emojiForCode(dto.weatherCode),
              style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: SizedBox(
              height: 8,
              child: CustomPaint(
                painter: _TempBarPainter(
                  min: scaleMin,
                  max: scaleMax,
                  dayMin: dto.temperatureMin,
                  dayMax: dto.temperatureMax,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 80,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  '${dto.temperatureMin.toStringAsFixed(0)}°',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '${dto.temperatureMax.toStringAsFixed(0)}°',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _weekdayLabel(String dateIso, {bool isToday = false}) {
    try {
      final parts = dateIso.split('-');
      if (parts.length < 3) return dateIso;
      final dt = DateTime(
        int.parse(parts[0]),
        int.parse(parts[1]),
        int.parse(parts[2]),
      );
      if (isToday) return 'Heute';
      const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      return labels[(dt.weekday - 1) % 7];
    } catch (_) {
      return dateIso;
    }
  }

  static bool _isToday(String dateIso) {
    final now = DateTime.now();
    return dateIso ==
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
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

class _TempBarPainter extends CustomPainter {
  final double min;
  final double max;
  final double dayMin;
  final double dayMax;

  _TempBarPainter({
    required this.min,
    required this.max,
    required this.dayMin,
    required this.dayMax,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final range = (max - min).abs();
    if (range <= 0.5) return;

    final startX = ((dayMin - min) / range).clamp(0.0, 1.0) * size.width;
    final endX = ((dayMax - min) / range).clamp(0.0, 1.0) * size.width;
    final barWidth = (endX - startX).clamp(2.0, size.width);

    final rect = RRect.fromLTRBR(
      startX,
      size.height / 2 - 2,
      startX + barWidth,
      size.height / 2 + 2,
      const Radius.circular(2),
    );

    final gradient = LinearGradient(
      colors: [
        AppColors.info.withOpacity(0.7),
        AppColors.warning.withOpacity(0.7),
        AppColors.secondary.withOpacity(0.85),
      ],
    ).createShader(rect.outerRect);

    final paint = Paint()..shader = gradient;
    canvas.drawRRect(rect, paint);
  }

  @override
  bool shouldRepaint(covariant _TempBarPainter old) =>
      old.min != min ||
      old.max != max ||
      old.dayMin != dayMin ||
      old.dayMax != dayMax;
}
