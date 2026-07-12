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
    _startLocation = LatLng(52.5200, 13.4050);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MobilityProvider>().loadNearbyStops(_startLocation!.latitude, _startLocation!.longitude);
    });
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
            child: Column(children: [
              TextField(controller: _startController, decoration: const InputDecoration labelText: 'Start', prefixIcon: Icon(Icons.circle, color: Colors.green), border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: _endController, decoration: const InputDecoration labelText: 'Ziel', prefixIcon: Icon(Icons.circle, color: Colors.red), border: OutlineInputBorder())),
            ]),
          ),
          Expanded(
            child: Consumer<MobilityProvider>(
              builder: (context, provider, child) {
                return FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(initialCenter: _startLocation ?? LatLng(52.5200, 13.4050), initialZoom: 13.0),
                  children: [
                    TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'de.heimat.app'),
                    MarkerLayer(markers: [
                      if (_startLocation != null) Marker(point: _startLocation!, width: 80, height: 80, child: const Icon(Icons.location_on, color: Colors.green, size: 40)),
                      if (_endLocation != null) Marker(point: _endLocation!, width: 80, height: 80, child: const Icon(Icons.location_on, color: Colors.red, size: 40)),
                      for (final stop in provider.nearbyStops) Marker(point: stop.location, width: 60, height: 60, child: Tooltip(message: stop.name, child: const Icon(Icons.train, color: Colors.blue, size: 30))),
                    ]),
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
