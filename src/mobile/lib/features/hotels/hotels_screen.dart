/// hotels_screen.dart — Hotels & Unterkuenfte
///
/// Nativ via OpenStreetMap Overpass.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/hotels?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'hotels_provider.dart';
import 'hotels_dto.dart';

class HotelsScreen extends StatelessWidget {
  const HotelsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HotelsProvider()..loadHotels(),
      child: const _HotelsBody(),
    );
  }
}

class _HotelsBody extends StatelessWidget {
  const _HotelsBody();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Hotels'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.teal.shade400, Colors.teal.shade800],
          ),
        ),
        child: Consumer<HotelsProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading) {
              return const Center(
                child: CircularProgressIndicator(color: Colors.white),
              );
            }
            if (provider.error != null) {
              return _buildError(context, provider);
            }
            return _buildContent(context, provider);
          },
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, HotelsProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.hotel, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              provider.error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => provider.loadHotels(),
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, HotelsProvider provider) {
    if (provider.hotels.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Keine Hotels gefunden.',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => provider.refresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '${provider.count} Unterkunft${provider.count == 1 ? '' : 'en'}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'In deiner Naehe (${provider.response!.radius.toStringAsFixed(0)} km)',
            style: const TextStyle(color: Colors.white54, fontSize: 14),
          ),
          const SizedBox(height: 16),
          if (provider.types.length > 1) _buildTypeChips(context, provider),
          const SizedBox(height: 16),
          ...provider.filteredHotels.map((hotel) => _buildHotelCard(hotel)),
        ],
      ),
    );
  }

  Widget _buildTypeChips(BuildContext context, HotelsProvider provider) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                'Alle (${provider.hotels.length})',
                style: TextStyle(
                  color: provider.selectedType == 'all'
                      ? Colors.teal.shade900
                      : Colors.white,
                  fontSize: 13,
                ),
              ),
              selected: provider.selectedType == 'all',
              selectedColor: Colors.white,
              backgroundColor: Colors.white.withOpacity(0.15),
              onSelected: (_) => provider.setType('all'),
            ),
          ),
          ...provider.types.map((type) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(
                    type,
                    style: TextStyle(
                      color: provider.selectedType == type
                          ? Colors.teal.shade900
                          : Colors.white,
                      fontSize: 13,
                    ),
                  ),
                  selected: provider.selectedType == type,
                  selectedColor: Colors.white,
                  backgroundColor: Colors.white.withOpacity(0.15),
                  onSelected: (_) => provider.setType(type),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildHotelCard(HotelDto hotel) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade800,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    hotel.type,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (hotel.stars != null) ...[
                  const SizedBox(width: 8),
                  ...List.generate(
                    hotel.stars!,
                    (_) =>
                        const Icon(Icons.star, size: 14, color: Colors.amber),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Text(
              hotel.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            if (hotel.address != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.location_on,
                      size: 14, color: Colors.white54),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      hotel.address!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.white70,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            if (hotel.distanceKm != null) ...[
              const SizedBox(height: 8),
              Text(
                '${hotel.distanceKm!.toStringAsFixed(1)} km entfernt',
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white54,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
