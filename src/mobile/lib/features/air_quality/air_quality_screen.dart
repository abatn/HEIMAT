import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../core/widgets/empty_state.dart';
import 'air_quality_dto.dart';
import 'air_quality_provider.dart';
import 'widgets/air_quality_widgets.dart';

/// AirQualityScreen — Native Flutter-Screen für Luftqualität (CAMS Copernicus).
///
/// **Datenquelle:** AirQualityProvider → /api/air-quality/forecast (Open-Meteo AQ API)
///
/// **Widgets:**
/// 1. AqiRingCard — großer AQI-Ring + Level
/// 2. PollutantDetailCard — Schadstoff-Details
/// 3. HourlyAQIStrip — 24h-AQI-Vorhersage
class AirQualityScreen extends StatefulWidget {
  const AirQualityScreen({super.key});

  @override
  State<AirQualityScreen> createState() => _AirQualityScreenState();
}

class _AirQualityScreenState extends State<AirQualityScreen> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized) {
        _initialized = true;
        final p = context.read<AirQualityProvider>();
        if (!p.hasData) {
          p.refresh();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AirQualityProvider>();
    return RefreshIndicator(
      onRefresh: p.refresh,
      color: AppColors.primary,
      child: _buildBody(context, p),
    );
  }

  Widget _buildBody(BuildContext context, AirQualityProvider p) {
    if (p.isLoading && !p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 24),
          SkeletonLoader(height: 220, borderRadius: 20),
          SizedBox(height: 16),
          SkeletonLoader(height: 160, borderRadius: 14),
          SizedBox(height: 16),
          SkeletonLoader(height: 120, borderRadius: 14),
        ],
      );
    }

    if (!p.hasData && p.error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: 'Luftqualitätsdaten nicht verfügbar',
            description: p.error!,
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: FilledButton.icon(
              onPressed: p.refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Erneut versuchen'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
              ),
            ),
          ),
        ],
      );
    }

    final f = p.forecast!;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        _buildHeader(p),
        const SizedBox(height: 12),
        AqiRingCard(current: f.current, isStale: p.isStale),
        // Intelligente Health-Tipps
        if (f.tips.isNotEmpty) ...[
          const SizedBox(height: 14),
          _buildAirQualityTips(f.tips),
        ],
        const SizedBox(height: 14),
        if (f.hourly.isNotEmpty) ...[
          HourlyAQIStrip(hourly: f.hourly),
          const SizedBox(height: 14),
        ],
        PollutantDetailCard(current: f.current),
        const SizedBox(height: 8),
        _buildAttribution(f),
      ],
    );
  }

  Widget _buildHeader(AirQualityProvider p) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Icon(Icons.air, color: AppColors.primary, size: 22),
        const SizedBox(width: 8),
        const Text(
          'Luftqualität',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const Spacer(),
        if (p.isStale)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.cloud_off, color: AppColors.warning, size: 12),
                SizedBox(width: 4),
                Text(
                  'Zuletzt aktualisiert',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.warning,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else if (p.lastUpdated != null)
          Text(
            'Aktualisiert ${_relativeTime(p.lastUpdated!)}',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
      ],
    );
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'gerade eben';
    if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min';
    return 'vor ${diff.inHours} Std';
  }

  /// Intelligente Air Quality Health-Tipps
  Widget _buildAirQualityTips(List<AirQualityTipDto> tips) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.08),
            AppColors.primary.withOpacity(0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.15),
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.health_and_safety, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                'Gesundheitsempfehlungen',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final tip in tips) ...[
            if (tip != tips.first) const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tip.icon, style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tip.text,
                    style: TextStyle(
                      fontSize: 13,
                      color: tip.isHighPriority
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                      fontWeight: tip.isHighPriority
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAttribution(AirQualityForecastResponse f) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        'Daten: ${f.source} · Namensnennung erforderlich',
        style: const TextStyle(
          fontSize: 10,
          color: AppColors.textSecondary,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
