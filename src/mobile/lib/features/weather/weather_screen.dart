import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/navigator/app_navigator.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../core/widgets/empty_state.dart';
import '../ai/local_sentiment_classifier.dart';
import '../home/presentation/home_provider.dart';
import 'weather_dto.dart';
import 'weather_provider.dart';
import 'widgets/alert_banner.dart';
import 'widgets/cross_service_insight_card.dart';
import 'widgets/current_weather_hero.dart';
import 'widgets/hourly_forecast_strip.dart';
import 'widgets/weekly_outlook_grid.dart';

/// WeatherScreen — Native Flutter-Wetter-Screen (Phase E Pilot).
///
/// **Vorher:** IFrame lud src/backend/public/miniprograms/weather.html in
/// einen Webview (Browser-Feeling, 600ms Load-Delay, kein theming).
///
/// **Nachher:** Reines Flutter. Drei zusammengesetzte Widgets:
/// 1. CurrentWeatherHero — Hauptkarte mit großer Temperatur + Zustand
/// 2. HourlyForecastStrip — 24h horizontal scrollbar
/// 3. WeeklyOutlookGrid — 7-Tage-Vorhersage vertikal
///
/// **Datenquelle:** WeatherProvider → /api/weather/forecast (DWD via Open-Meteo).
class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key});

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized) {
        _initialized = true;
        // First-time fetch (Provider hat schon init() gemacht und ggf. Cache geladen)
        final p = context.read<WeatherProvider>();
        if (!p.hasData) {
          p.refresh();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Phase E Super-App-Pacing: WeatherScreen liest WeatherProvider +
    // HomeProvider parallel. Consumer2 — beide rebuild bei State-Change.
    // Tradeoff: doppelte rebuilds, aber Cross-Service-Insight braucht BEIDE.
    final weather = context.watch<WeatherProvider>();
    final home = context.watch<HomeProvider>();
    return RefreshIndicator(
      onRefresh: weather.refresh,
      color: AppColors.primary,
      child: _buildBody(context, weather, home),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WeatherProvider p,
    HomeProvider home,
  ) {
    if (p.isLoading && !p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 24),
          SkeletonLoader(height: 220, borderRadius: 20),
          SizedBox(height: 16),
          SkeletonLoader(height: 120, borderRadius: 14),
          SizedBox(height: 16),
          SkeletonLoader(height: 240, borderRadius: 14),
        ],
      );
    }

    if (!p.hasData && p.error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: 'Wetterdaten nicht verfügbar',
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
        // Phase E Forecast-Schicht: Unwetter-Banner oben.
        // Backend Rule-Engine (weatherAlertsService) liefert sortierte Liste
        // — DANGER zuerst, dann WARNING, dann INFO pro Tag.
        if (p.hasAlerts) ...[
          for (final alert in p.alerts) AlertBanner(alert: alert),
          const SizedBox(height: 10),
        ],
        CurrentWeatherHero(
          current: f.current,
          locationName: p.locationName,
          isStale: p.isStale,
        ), // Phase E Super-App-Pacing: Cross-Service Insight (oben vor Sentiment).
        // Widget macht defensive null-check selbst; wir gaten nur das
        // rain-event weil sonst 5mb-Karte ohne Kontext waere.
        if (f.current.isRainingNow || f.isRainingSoon) ...[
          const SizedBox(height: 14),
          CrossServiceInsightCard(
            nearbySummary: home.nearbySummary,
            isRainingNow: f.current.isRainingNow,
            isRainingSoon: f.isRainingSoon,
            onTap: () {
              // recordAction fuellt BayesClassifier mit realer User-Behavior
              HomeProvider.onUserAction?.call('regen_insight_mobility_tap');
              // Tab-Switch via global static (Pattern-Mirror zu Provider)
              AppNavigator.switchMainTab?.call(1); // 1 = Mobility
            },
          ),
        ],
        if (p.sentiment != null) ...[
          const SizedBox(height: 12),
          _buildSentimentRow(p.sentiment!),
        ],
        const SizedBox(height: 16),
        if (f.hourly.isNotEmpty) HourlyForecastStrip(hourly: f.hourly),
        const SizedBox(height: 16),
        if (f.daily.isNotEmpty) WeeklyOutlookGrid(daily: f.daily),
        const SizedBox(height: 8),
        _buildAttribution(f),
      ],
    );
  }

  /// Phase E AI Hook: On-Device Sentiment-Row.
  /// Zeigt dem User EXPLIZIT dass hier lokal klassifiziert wird,
  /// nicht von einem Cloud-AI. Macht die AI transparent + privacy-friendly.
  Widget _buildSentimentRow(SentimentResult s) {
    final scoreColor = s.isGood
        ? AppColors.success
        : s.isBad
            ? AppColors.error
            : AppColors.textSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Row(
        children: [
          const Icon(Icons.psychology_outlined,
              size: 14, color: AppColors.primary),
          const SizedBox(width: 8),
          const Text(
            'KI-Wetterstimmung',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: 6),
          Text('·', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(width: 6),
          Text(
            s.emoji,
            style: const TextStyle(fontSize: 16),
          ),
          const SizedBox(width: 6),
          Text(
            s.uiCompact,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: scoreColor,
            ),
          ),
          const Spacer(),
          // Source-Attribution: ehrlich kommunizieren dass es Stub ist,
          // nicht ein echtes TFLite-Modell. User weiss was sie/er bekommt.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: s.source.contains('fallback')
                  ? AppColors.warning.withOpacity(0.12)
                  : AppColors.info.withOpacity(0.10),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              s.source,
              style: TextStyle(
                fontSize: 9,
                color: s.source.contains('fallback')
                    ? AppColors.warning
                    : AppColors.info,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(WeatherProvider p) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Icon(Icons.wb_sunny_outlined, color: AppColors.primary, size: 22),
        const SizedBox(width: 8),
        const Text(
          'Wetter',
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

  Widget _buildAttribution(f) {
    const txt =
        'Daten: Deutscher Wetterdienst (DWD) via Open-Meteo · CC-BY 4.0';
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        txt,
        style: const TextStyle(
          fontSize: 10,
          color: AppColors.textSecondary,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

// Note: EmptyState from core/widgets/empty_state.dart takes only title + description
// + optional svgAsset. Action-Button ('Erneut versuchen') is rendered separately
// below as native FilledButton — keeps EmptyState reusable across the app.
