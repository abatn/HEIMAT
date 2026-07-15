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
    _startLocation = const LatLng(52.5200, 13.4050);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MobilityProvider>().loadNearbyStops(
            _startLocation!.latitude,
            _startLocation!.longitude,
          );
    });
  }

  LatLng? _resolveCity(String input) {
    final lower = input.trim().toLowerCase();
    if (MobilityProvider.cityCoords.containsKey(lower)) {
      return MobilityProvider.cityCoords[lower];
    }
    final parts = RegExp(r'(-?\d+\.?\d*)').allMatches(input);
    if (parts.length >= 2) {
      return LatLng(
        double.parse(parts.elementAt(0).group(0)!),
        double.parse(parts.elementAt(1).group(0)!),
      );
    }
    return null;
  }

  void _search() {
    final start = _startController.text.trim();
    final end = _endController.text.trim();
    if (start.isEmpty) return;

    final startCoords = _resolveCity(start);
    if (startCoords != null) {
      setState(() => _startLocation = startCoords);
      context.read<MobilityProvider>().loadNearbyStops(
            startCoords.latitude,
            startCoords.longitude,
          );
      _mapController.move(startCoords, 13.0);
    }

    if (end.isNotEmpty) {
      final endCoords = _resolveCity(end);
      if (endCoords != null) {
        setState(() => _endLocation = endCoords);
        context.read<MobilityProvider>().loadRoute(
              startCoords?.latitude ?? _startLocation!.latitude,
              startCoords?.longitude ?? _startLocation!.longitude,
              endCoords.latitude,
              endCoords.longitude,
            );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mobilit\u00e4t')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Column(
              children: [
                TextField(
                  controller: _startController,
                  decoration: const InputDecoration(
                    labelText: 'Start',
                    prefixIcon: Icon(Icons.circle, color: Colors.green),
                    border: OutlineInputBorder(),
                    hintText: 'z.B. Stuttgart',
                  ),
                  onSubmitted: (_) => _search(),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _endController,
                  decoration: const InputDecoration(
                    labelText: 'Ziel',
                    prefixIcon: Icon(Icons.circle, color: Colors.red),
                    border: OutlineInputBorder(),
                    hintText: 'z.B. Berlin',
                  ),
                  onSubmitted: (_) => _search(),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _search,
                    icon: const Icon(Icons.search),
                    label: const Text('Suchen'),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Consumer<MobilityProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (provider.error != null) {
                  return Center(child: Text(provider.error!));
                }
                return FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter:
                        _startLocation ?? const LatLng(52.5200, 13.4050),
                    initialZoom: 13.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'de.heimat.app',
                    ),
                    if (provider.route.isNotEmpty)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: provider.route.first,
                            color: Colors.blue,
                            strokeWidth: 4.0,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        if (_startLocation != null)
                          Marker(
                            point: _startLocation!,
                            width: 80,
                            height: 80,
                            child: const Icon(Icons.location_on,
                                color: Colors.green, size: 40),
                          ),
                        if (_endLocation != null)
                          Marker(
                            point: _endLocation!,
                            width: 80,
                            height: 80,
                            child: const Icon(Icons.location_on,
                                color: Colors.red, size: 40),
                          ),
                        for (final stop in provider.nearbyStops)
                          Marker(
                            point: stop.location,
                            width: 60,
                            height: 60,
                            child: Tooltip(
                              message: stop.name,
                              child: const Icon(Icons.train,
                                  color: Colors.blue, size: 30),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        ],
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
