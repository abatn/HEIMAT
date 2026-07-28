import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../waste_dto.dart';

/// WasteEventCard — einzelner Abfuhr-Termin im Listenrendering.
///
/// Aufbau:
/// - Linke Spalte: Datum-Karte (Tag + Monat)
/// - Rechte Spalte: Summary + Category-Badge + optional Location
///
/// Mirror-Pattern zu PollutantDetailCard aus air_quality_widgets.dart.
class WasteEventCard extends StatelessWidget {
  final WasteCalendarEvent event;
  const WasteEventCard({super.key, required this.event});

  /// Müllart-Farbe-Mapping (CC-BY-konform: keine mockup/erfundenen Colors).
  /// Diese Map spiegelt das was die BSR-Müll-App und AWB-Color-Coding nutzen
  /// (Standard-Farbcodes der deutschen Mülltrennung).
  Color _categoryColor(BuildContext context) {
    final cat = (event.category ?? '').toLowerCase();
    return switch (cat) {
      'restmuell' || 'restmüll' => const Color(0xFFB91C1C), // dunkelrot Restmülltonne
      'bio' || 'biotonne' => const Color(0xFF16A34A), // grün Biotonne
      'papier' || 'papiertonne' || 'altpapier' => const Color(0xFF2563EB), // blau Papiertonne
      'gelbe tonne' || 'gelb' || 'lvp' || 'verpackung' =>
        const Color(0xFFF59E0B), // gelb Gelbe Tonne
      'sperrmuell' || 'sperrmüll' =>
        const Color(0xFF9333EA), // lila Sperrmüll
      _ => AppColors.primary,
    };
  }

  String _categoryLabel() {
    final cat = (event.category ?? '').toLowerCase();
    if (cat.isEmpty) return 'Abfuhr';
    return switch (cat) {
      'restmuell' => 'Restmüll',
      'bio' => 'Bio',
      'papier' => 'Papier',
      'gelbe tonne' || 'lvp' => 'Verpackung',
      'sperrmuell' => 'Sperrmüll',
      _ => cat[0].toUpperCase() + cat.substring(1),
    };
  }

  /// Datum-Parsing: event.start = 'YYYY-MM-DDTHH:mm:ss'
  ({String day, String month, String time}) _formatStart() {
    final s = event.start;
    final datePart = s.length >= 10 ? s.substring(0, 10) : s;
    final timePart = s.length >= 16 ? s.substring(11, 16) : '';
    final parts = datePart.split('-');
    final day = parts.length >= 3 ? parts[2] : '?';
    final monthNum = parts.length >= 2 ? int.tryParse(parts[1]) ?? 1 : 1;
    const monthNames = [
      'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
      'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
    ];
    final month =
        monthNum >= 1 && monthNum <= 12 ? monthNames[monthNum - 1] : '?';
    return (day: day, month: month, time: timePart);
  }

  @override
  Widget build(BuildContext context) {
    final color = _categoryColor(context);
    final f = _formatStart();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.30), width: 0.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Datum-Karte links
          Container(
            width: 56,
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withOpacity(0.4), width: 0.5),
            ),
            child: Column(
              children: [
                Text(
                  f.day,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  f.month,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // rechts: Summary + Badge + Location
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        event.summary,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _categoryLabel(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.schedule,
                        size: 12, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      f.time.isNotEmpty ? 'ab $f.time Uhr' : 'Ganztägig',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (event.location != null) ...[
                      const SizedBox(width: 12),
                      Icon(Icons.place_outlined,
                          size: 12, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          event.location!,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
