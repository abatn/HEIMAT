import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../home/presentation/home_provider.dart';

/// CrossServiceInsightCard — Super-App-Pattern Querschnittsschicht
/// zwischen HEIMAT-Services (Phase E Follow-Up).
///
/// **Idee (WeChat-Pacing):** Wetter erkennt Regen → schlägt sofort den
/// passenden Service-Action vor (Mobility = nächste Haltestelle als
/// Schutz). Ein Tap wechselt zum Mobility-Tab und schreibt eine
/// `recordAction` fuer die BayesClassifier-Personalisierung.
///
/// **Trigger-Conditions:**
///   1. Aktuelles Wetter ist Regen (WMO weatherCode >= 51) ODER
///   2. Regen in der nächsten Stunde wahrscheinlich
///      (hourly weatherCode >= 51 UND precipitation > 0.5 mm/h)
///   UND
///   3. HomeProvider hat nearbySummary geladen UND stopsNearby > 0
///
/// **Privacy:** keine Cloud-AI-Aufrufe, reine lokale Decision-Logic.
/// **Reactive:** keine State-Mutation — Reads von beiden Providers via
/// Consumer2<WeatherProvider, HomeProvider>.
class CrossServiceInsightCard extends StatelessWidget {
  final NearbySummary? nearbySummary;
  final bool isRainingNow;
  final bool isRainingSoon;

  /// Tap-Callback: setzt sowohl den Mobility-TabIndex als auch
  /// recordAction('weather_shelter_clicked').
  final VoidCallback? onTap;

  const CrossServiceInsightCard({
    super.key,
    required this.nearbySummary,
    required this.isRainingNow,
    required this.isRainingSoon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Defensive Single-Source-of-Truth Gates:
    // nearbySummary/stopsNearby == 0: kein Render (race-safe bei cold-start)
    // kein Regen: kein Render (caller gate, +1 saebel-verteidigung)
    final stops = nearbySummary?.stopsNearby ?? 0;
    if (stops == 0) return const SizedBox.shrink();
    if (!isRainingNow && !isRainingSoon) return const SizedBox.shrink();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            // Subtle primary-tint statt Grey, weil Action-verknüpfungs-Card
            gradient: LinearGradient(
              colors: [
                AppColors.primary.withOpacity(0.08),
                AppColors.info.withOpacity(0.04),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppColors.primary.withOpacity(0.35),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  size: 18,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _title(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _subtitle(),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Mobility-Icon als visueller Hint
              const Icon(
                Icons.directions_bus_outlined,
                size: 16,
                color: AppColors.primary,
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.arrow_forward_ios,
                size: 11,
                color: AppColors.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// WeChat-Pacing-Tone: prädiktiv wenn bald, reaktiv wenn jetzt.
  String _title() {
    if (isRainingSoon && !isRainingNow) {
      return 'Regen im Anmarsch 🌧️';
    }
    return 'Es regnet gerade 🌧️';
  }

  /// Subtitle: actionable Hint mit Stop-Count.
  /// Liest intern aus nearbySummary weil `stopsNearby` nicht mehr
  /// Constructor-Param ist (single source of truth im build()).
  String _subtitle() {
    final nearest = nearbySummary?.nearestStopName;
    final stops = nearbySummary?.stopsNearby ?? 0;
    if (nearest != null && nearest.isNotEmpty) {
      return 'Such dir Schutz an „$nearest" – Mobility-Tab öffnen';
    }
    return '$stops Haltestellen in der Nähe – Mobility-Tab öffnen 🚇';
  }
}
