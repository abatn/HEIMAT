import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../weather_dto.dart';

/// AlertBanner — Unwetter-Warnung-Banner oben im WeatherScreen.
///
/// **Phase E Forecast-Schicht:** rendert EINEN WeatherAlert aus dem Backend
/// als visuell prominentes Banner. 3 Severity-Stufen:
///   - danger (rot): Sturm-Warnung > 50 km/h
///   - warning (orange): Starkregen-Wahrscheinlichkeit > 80%
///   - info (blau): Anhaltender Dauerregen (>= 3 Tage)
///
/// **Design:** Container mit getöntem Background + Severity-Icon + Title +
/// Message (oder Kurzfassung) + optional Metric-Chip.
/// Kein WebView, kein IFrame — pure Flutter.
class AlertBanner extends StatelessWidget {
  final WeatherAlert alert;
  final bool compact;

  const AlertBanner({
    super.key,
    required this.alert,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final severity = alert.severity;
    final color = _colorFor(severity);
    final icon = _iconFor(alert.code, severity);
    final labelColor = _onColorFor(severity);

    // Kein eigener Bottom-Margin mehr — die Stack-Reihenfolge im
    // WeatherScreen fuegt ggf. SizedBox(height: 8) dazwischen ein,
    // und der letzte Banner braucht keinen Bottom-Margin.
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 12 : 16,
        vertical: compact ? 10 : 14,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.40), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.18),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: labelColor, size: compact ? 20 : 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        alert.code.displayLabel.toUpperCase(),
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                          color: labelColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (alert.isSpan)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: labelColor.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _spanLabel(alert),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: labelColor,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  alert.title,
                  style: TextStyle(
                    fontSize: compact ? 13 : 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (!compact) ...[
                  const SizedBox(height: 4),
                  Text(
                    alert.message,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      height: 1.35,
                    ),
                  ),
                ],
                if (alert.metric != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: color.withOpacity(0.3)),
                    ),
                    child: Text(
                      '${alert.metric!.label}: ${alert.metric!.value} ${alert.metric!.unit}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _spanLabel(WeatherAlert a) {
    final end = a.endDayIndex!;
    final diff = end - a.dayIndex + 1;
    return '$diff Tage';
  }

  Color _colorFor(AlertSeverity s) {
    switch (s) {
      case AlertSeverity.danger:
        return AppColors.error;
      case AlertSeverity.warning:
        return AppColors.warning;
      case AlertSeverity.info:
        return AppColors.info;
    }
  }

  Color _onColorFor(AlertSeverity s) {
    // Stärkere Farbe für Text auf getöntem Background
    switch (s) {
      case AlertSeverity.danger:
        return AppColors.error;
      case AlertSeverity.warning:
        return AppColors.warning;
      case AlertSeverity.info:
        return AppColors.info;
    }
  }

  IconData _iconFor(AlertCode code, AlertSeverity severity) {
    if (severity == AlertSeverity.danger) return Icons.dangerous_outlined;
    switch (code) {
      case AlertCode.sturm:
        return Icons.air;
      case AlertCode.extremregen:
        return Icons.thunderstorm_outlined;
      case AlertCode.dauerregen:
        return Icons.water_drop_outlined;
    }
  }
}
