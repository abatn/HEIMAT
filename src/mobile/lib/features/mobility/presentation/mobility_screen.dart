import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'mobility_provider.dart';

class MobilityScreen extends StatefulWidget {
  const MobilityScreen({super.key});

  @override
  State<MobilityScreen> createState() => _MobilityScreenState();
}

class _MobilityScreenState extends State<MobilityScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();

  LatLng? _startLocation;
  LatLng? _endLocation;

  @override
  void initState() {
    super.initState();
    _startLocation = LatLng(52.5200, 13.4050); // Berlin als Default
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MobilityProvider>().loadNearbyStops(
            _startLocation!.latitude,
            _startLocation!.longitude,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mobilität'),
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: _getCurrentLocation,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(
            child: _buildMap(),
          ),
          _buildNearbyStopsList(),
        ],
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton(
            heroTag: "search",
            onPressed: _searchConnections,
            child: const Icon(Icons.search),
          ),
          const SizedBox(height: 16),
          FloatingActionButton(
            heroTag: "directions",
            onPressed: _startNavigation,
            child: const Icon(Icons.directions),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Column(
        children: [
          TextField(
            controller: _startController,
            decoration: InputDecoration(
              labelText: 'Start',
              prefixIcon: const Icon(Icons.circle, color: Colors.green),
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                icon: const Icon(Icons.my_location),
                onPressed: () {
                  _startController.text = 'Aktuelle Position';
                  setState(() {
                    _startLocation = LatLng(52.5200, 13.4050);
                  });
                  context.read<MobilityProvider>().loadNearbyStops(
                        _startLocation!.latitude,
                        _startLocation!.longitude,
                      );
                },
              ),
            ),
            onSubmitted: (value) => _searchLocation(value, false),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _endController,
            decoration: InputDecoration(
              labelText: 'Ziel',
              prefixIcon: const Icon(Icons.circle, color: Colors.red),
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: () => _showLocationSearch(true),
              ),
            ),
            onSubmitted: (value) => _searchLocation(value, true),
          ),
        ],
      ),
    );
  }

  Widget _buildMap() {
    return Consumer<MobilityProvider>(
      builder: (context, provider, child) {
        return FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _startLocation ?? LatLng(52.5200, 13.4050),
            initialZoom: 13.0,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'de.heimat.app',
            ),
            MarkerLayer(
              markers: [
                if (_startLocation != null)
                  Marker(
                    point: _startLocation!,
                    width: 80,
                    height: 80,
                    child: const Icon(
                      Icons.location_on,
                      color: Colors.green,
                      size: 40,
                    ),
                  ),
                if (_endLocation != null)
                  Marker(
                    point: _endLocation!,
                    width: 80,
                    height: 80,
                    child: const Icon(
                      Icons.location_on,
                      color: Colors.red,
                      size: 40,
                    ),
                  ),
                // Haltestellen-Marker
                for (final stop in provider.nearbyStops)
                  Marker(
                    point: stop.location,
                    width: 60,
                    height: 60,
                    child: Tooltip(
                      message: stop.name,
                      child: Icon(
                        Icons.train,
                        color: Colors.blue,
                        size: 30,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildNearbyStopsList() {
    return Consumer<MobilityProvider>(
      builder: (context, provider, child) {
        if (provider.nearbyStops.isEmpty) return const SizedBox.shrink();

        return Container(
          height: 120,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Haltestellen in der Nähe (${provider.nearbyStops.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: provider.nearbyStops.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final stop = provider.nearbyStops[index];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.train, color: Colors.blue),
                            const SizedBox(height: 4),
                            Text(
                              stop.name,
                              style: const TextStyle(fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _getCurrentLocation() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Aktuelle Position wird geladen...')),
    );
  }

  void _searchLocation(String address, bool isEnd) {
    if (address.isEmpty) return;

    context.read<MobilityProvider>().geocodeAddress(address).then((_) {
      final results = context.read<MobilityProvider>().geocodeResults;
      if (results.isNotEmpty) {
        setState(() {
          final result = results.first;
          if (isEnd) {
            _endLocation = LatLng(result.lat, result.lng);
            _endController.text = result.displayName;
          } else {
            _startLocation = LatLng(result.lat, result.lng);
            _startController.text = result.displayName;
            context.read<MobilityProvider>().loadNearbyStops(
                  result.lat,
                  result.lng,
                );
          }
        });
        _mapController.move(
          isEnd ? _endLocation! : _startLocation!,
          14.0,
        );
      }
    });
  }

  void _searchConnections() {
    if (_startLocation == null || _endLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bitte Start und Ziel eingeben')),
      );
      return;
    }

    context.read<MobilityProvider>().getRoute(_startLocation!, _endLocation!);
    _showConnectionsDialog();
  }

  void _startNavigation() {
    if (_startLocation == null || _endLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bitte Start und Ziel eingeben')),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Navigation wird gestartet...')),
    );
  }

  void _showLocationSearch(bool isEnd) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isEnd ? 'Ziel auswählen' : 'Start auswählen',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Adresse oder Ort eingeben',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (value) {
                Navigator.pop(context);
                _searchLocation(value, isEnd);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showConnectionsDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Consumer<MobilityProvider>(
          builder: (context, provider, child) {
            if (provider.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.error != null) {
              return Center(child: Text(provider.error!));
            }

            final route = provider.currentRoute;
            return Container(
              padding: const EdgeInsets.all(16),
              child: ListView(
                controller: scrollController,
                children: [
                  Text(
                    'Route',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  if (route != null)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.directions),
                        title: Text(
                          'Distanz: ${(route.distance / 1000).toStringAsFixed(1)} km',
                        ),
                        subtitle: Text(
                          'Dauer: ${(route.duration / 60).toStringAsFixed(0)} Min',
                        ),
                      ),
                    )
                  else
                    const Text('Keine Route gefunden'),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }
}
