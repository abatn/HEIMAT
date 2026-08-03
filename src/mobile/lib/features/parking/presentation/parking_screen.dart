import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/skeleton_loader.dart';
import '../../../core/widgets/empty_state.dart';
import 'parking_provider.dart';
import '../parking_dto.dart';

/// ParkingScreen — Native Flutter-Screen für Parkplätze (Phase C-2).
///
/// **Datenquelle:** ParkingProvider → /api/parking/spots (OSM Overpass).
///
/// **Widgets:**
/// 1. Header mit Standort + Anzahl Parkplätze
/// 2. Filter-Chips (Typ, Gebühr, Zugang)
/// 3. SpotList mit ParkingSpotCard für jede Parkfläche
/// 4. Attribution-Footer
class ParkingScreen extends StatefulWidget {
  const ParkingScreen({super.key});

  @override
  State<ParkingScreen> createState() => _ParkingScreenState();
}

class _ParkingScreenState extends State<ParkingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ParkingProvider>().init();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🅿️ Parkplätze'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        actions: [
          Consumer<ParkingProvider>(
            builder: (context, provider, _) {
              return IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: provider.isLoading ? null : () => provider.refresh(),
              );
            },
          ),
        ],
      ),
      body: Consumer<ParkingProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && !provider.hasData) {
            return const SkeletonLoader();
          }

          if (provider.error != null && !provider.hasData) {
            return EmptyState(
              icon: Icons.error_outline,
              title: 'Fehler',
              description: provider.error!,
              action: TextButton(
                onPressed: () => provider.refresh(),
                child: const Text('Erneut versuchen'),
              ),
            );
          }

          if (!provider.hasData) {
            return EmptyState(
              icon: Icons.local_parking,
              title: 'Keine Parkplätze gefunden',
              description: 'In deiner Nähe wurden keine Parkplätze gefunden.',
              action: TextButton(
                onPressed: () => provider.refresh(),
                child: const Text('Aktualisieren'),
              ),
            );
          }

          return Column(
            children: [
              _buildHeader(provider),
              _buildFilterChips(provider),
              Expanded(child: _buildSpotList(provider)),
              _buildAttributionFooter(),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHeader(ParkingProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_on, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  provider.locationName.isNotEmpty
                      ? provider.locationName
                      : 'Standort wird ermittelt...',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  '${provider.spots.length} Parkplätze im Umkreis von ${provider.radiusKm.toStringAsFixed(1)} km',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          if (provider.lastUpdated != null)
            Text(
              'Aktualisiert: ${_formatTime(provider.lastUpdated!)}',
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 11,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(ParkingProvider provider) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          _buildChip('Alle', true, () {}),
          const SizedBox(width: 8),
          _buildChip('🅿️ Parkhaus', false, () {}),
          const SizedBox(width: 8),
          _buildChip('🚗 Freifläche', false, () {}),
          const SizedBox(width: 8),
          _buildChip('🆓 Kostenlos', false, () {}),
          const SizedBox(width: 8),
          _buildChip('🔆 Beleuchtet', false, () {}),
        ],
      ),
    );
  }

  Widget _buildChip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.primary.withOpacity(0.2),
    );
  }

  Widget _buildSpotList(ParkingProvider provider) {
    return RefreshIndicator(
      onRefresh: () => provider.refresh(),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: provider.spots.length,
        itemBuilder: (context, index) {
          final spot = provider.spots[index];
          return ParkingSpotCard(spot: spot);
        },
      ),
    );
  }

  Widget _buildAttributionFooter() {
    return Container(
      padding: const EdgeInsets.all(8),
      child: Text(
        'Daten: © OpenStreetMap-Mitwirkende, ODbL-1.0',
        style: TextStyle(fontSize: 11, color: Colors.grey[500]),
        textAlign: TextAlign.center,
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}

/// ParkingSpotCard — Einzelne Parkplatz-Karte
class ParkingSpotCard extends StatelessWidget {
  final ParkingSpot spot;

  const ParkingSpotCard({super.key, required this.spot});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getParkingIcon(spot.parkingType),
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    spot.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
                if (spot.isFree)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Kostenlos',
                      style: TextStyle(
                        color: Colors.green,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                _buildBadge(spot.parkingTypeLabel, Icons.local_parking),
                if (spot.capacity != null)
                  _buildBadge('${spot.capacity} Plätze', Icons.grid_view),
                if (spot.isLit) _buildBadge('Beleuchtet', Icons.light_mode),
                if (spot.surface != null)
                  _buildBadge(spot.surface!, Icons.texture),
                if (spot.access != null && spot.access != 'public')
                  _buildBadge('Privat', Icons.lock),
              ],
            ),
            if (spot.openingHours != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.access_time, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    spot.openingHours!,
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBadge(String text, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.grey.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  IconData _getParkingIcon(String? type) {
    switch (type) {
      case 'multi-storey':
        return Icons.business;
      case 'underground':
        return Icons.layers;
      case 'surface':
        return Icons.local_parking;
      default:
        return Icons.local_parking;
    }
  }
}
