import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../core/widgets/empty_state.dart';
import 'weather_provider.dart';
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
    return Consumer<WeatherProvider>(
      builder: (context, p, _) {
        return RefreshIndicator(
          onRefresh: p.refresh,
          color: AppColors.primary,
          child: _buildBody(context, p),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, WeatherProvider p) {
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
        CurrentWeatherHero(
          current: f.current,
          locationName: p.locationName,
          isStale: p.isStale,
        ),
        const SizedBox(height: 16),
        if (f.hourly.isNotEmpty) HourlyForecastStrip(hourly: f.hourly),
        const SizedBox(height: 16),
        if (f.daily.isNotEmpty) WeeklyOutlookGrid(daily: f.daily),
        const SizedBox(height: 8),
        _buildAttribution(f),
      ],
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
