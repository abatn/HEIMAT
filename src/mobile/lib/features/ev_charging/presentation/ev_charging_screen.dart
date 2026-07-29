import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/skeleton_loader.dart';
import '../../../core/widgets/empty_state.dart';
import '../ev_charging_dto.dart';
import 'ev_charging_provider.dart';
import '../widgets/ev_charging_widgets.dart';

/// EvChargingScreen — Native Flutter-Screen für E-Ladestationen (Phase B-4).
///
/// **Datenquelle:** EvChargingProvider → /api/ev-charging/stations (OSM Overpass).
///
/// **Widgets:**
/// 1. Header mit Standort + Anzahl Stationen
/// 2. StationList mit ChargingStationCard für jede Station
/// 3. Attribution-Footer
class EvChargingScreen extends StatefulWidget {
  const EvChargingScreen({super.key});

  @override
  State<EvChargingScreen> createState() => _EvChargingScreenState();
}

class _EvChargingScreenState extends State<EvChargingScreen> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized && mounted) {
        _initialized = true;
        final p = context.read<EvChargingProvider>();
        if (!p.hasData) {
          p.refresh();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<EvChargingProvider>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        title: const Text(
          'E-Ladestationen',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: p.refresh,
        color: AppColors.primary,
        child: _buildBody(context, p),
      ),
    );
  }

  Widget _buildBody(BuildContext context, EvChargingProvider p) {
    if (p.isLoading && !p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 24),
          SkeletonLoader(height: 48, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 140, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 140, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 140, borderRadius: 14),
        ],
      );
    }

    if (!p.hasData && p.error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: 'Ladestationen nicht verfügbar',
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

    if (!p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 80),
          EmptyState(
            title: 'Keine Daten',
            description: 'E-Ladestationen werden geladen …',
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        _buildHeader(p),
        const SizedBox(height: 12),
        if (p.stations.isNotEmpty)
          ...p.stations.map((s) => ChargingStationCard(station: s))
        else
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyState(
              title: 'Keine Stationen',
              description:
                  'Im Umkreis von 5 km wurden keine E-Ladestationen gefunden.',
            ),
          ),
        const SizedBox(height: 12),
        _buildAttribution(),
      ],
    );
  }

  Widget _buildHeader(EvChargingProvider p) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child:
              const Icon(Icons.ev_station, color: AppColors.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p.locationName.isNotEmpty ? p.locationName : 'In der Nähe',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${p.stations.length} Ladestationen gefunden',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const Spacer(),
        if (p.lastUpdated != null)
          Text(
            '${_relativeTime(p.lastUpdated!)}',
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
    if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min';
    if (diff.inHours < 24) return 'vor ${diff.inHours} Std';
    return 'vor ${diff.inDays} Tagen';
  }

  Widget _buildAttribution() {
    return const Padding(
      padding: EdgeInsets.only(top: 12),
      child: Text(
        'Daten: OpenStreetMap · ODbL-1.0',
        style: TextStyle(
          fontSize: 10,
          color: AppColors.textSecondary,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
