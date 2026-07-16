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

  Future<LatLng?> _resolveLocation(String input) async {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return null;

    // 1. Direkte Koordinaten-Eingabe (z.B. "52.52, 13.40")
    final parts = RegExp(r'(-?\d+\.\d+)').allMatches(trimmed);
    if (parts.length >= 2) {
      return LatLng(
        double.parse(parts.elementAt(0).group(0)!),
        double.parse(parts.elementAt(1).group(0)!),
      );
    }

    // 2. Bekannte Stadt (schneller Pfad ohne Netzwerk)
    final lower = trimmed.toLowerCase();
    if (MobilityProvider.cityCoords.containsKey(lower)) {
      return MobilityProvider.cityCoords[lower];
    }

    // 3. Echtes Geocoding: jede reale Adresse/Ort via Nominatim (OpenStreetMap)
    final results = await context.read<MobilityProvider>().geocode(trimmed);
    if (results.isNotEmpty) {
      return LatLng(
        double.parse(results.first['lat'].toString()),
        double.parse(results.first['lng'].toString()),
      );
    }
    return null;
  }

  Future<void> _search() async {
    final start = _startController.text.trim();
    final end = _endController.text.trim();
    if (start.isEmpty) return;

    final startCoords = await _resolveLocation(start);
    if (!mounted) return;
    if (startCoords != null) {
      setState(() => _startLocation = startCoords);
      context.read<MobilityProvider>().loadNearbyStops(
            startCoords.latitude,
            startCoords.longitude,
          );
      _mapController.move(startCoords, 13.0);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ort "$start" nicht gefunden')),
      );
      return;
    }

    if (end.isNotEmpty) {
      final endCoords = await _resolveLocation(end);
      if (!mounted) return;
      if (endCoords != null) {
        setState(() => _endLocation = endCoords);
        context.read<MobilityProvider>().loadRoute(
              startCoords.latitude,
              startCoords.longitude,
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
