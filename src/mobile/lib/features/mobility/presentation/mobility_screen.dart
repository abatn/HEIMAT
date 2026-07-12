import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

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
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    // Starte an aktueller Position (wird später implementiert)
    _startLocation = LatLng(52.5200, 13.4050); // Berlin als Default
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
          // Suchfelder
          _buildSearchBar(),
          // Karte
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                center: _startLocation ?? LatLng(52.5200, 13.4050),
                zoom: 13.0,
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
                        builder: (ctx) => const Icon(
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
                        builder: (ctx) => const Icon(
                          Icons.location_on,
                          color: Colors.red,
                          size: 40,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
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
      color: Theme.of(context).colorScheme.surfaceVariant,
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
                  _startLocation = LatLng(52.5200, 13.4050);
                },
              ),
            ),
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
          ),
        ],
      ),
    );
  }

  void _getCurrentLocation() {
    // TODO: GPS-Position abrufen
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Aktuelle Position wird geladen...')),
    );
  }

  void _searchConnections() {
    if (_startLocation == null || _endLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bitte Start und Ziel eingeben')),
      );
      return;
    }
    // TODO: ÖPNV-Verbindungen suchen
    _showConnectionsDialog();
  }

  void _startNavigation() {
    if (_startLocation == null || _endLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bitte Start und Ziel eingeben')),
      );
      return;
    }
    // TODO: Navigation starten
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Navigation wird gestartet...')),
    );
  }

  void _showLocationSearch(bool isEnd) {
    // TODO: Standortsuche mit Autocomplete
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
                // TODO: Adresse in Koordinaten umwandeln
                setState(() {
                  if (isEnd) {
                    _endLocation = LatLng(52.5170, 13.3888); // Alexanderplatz
                    _endController.text = value;
                  } else {
                    _startLocation = LatLng(52.5170, 13.3888);
                    _startController.text = value;
                  }
                });
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showConnectionsDialog() {
    // TODO: ÖPNV-Verbindungen von API laden
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(16),
          child: ListView(
            controller: scrollController,
            children: [
              Text(
                'ÖPNV-Verbindungen',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              // Beispiel-Verbindungen
              _buildConnectionCard(
                departure: '08:30',
                arrival: '08:45',
                duration: '15 Min',
                transfers: 0,
                line: 'U2',
              ),
              _buildConnectionCard(
                departure: '08:35',
                arrival: '08:55',
                duration: '20 Min',
                transfers: 1,
                line: 'S-Bahn',
              ),
              _buildConnectionCard(
                departure: '08:40',
                arrival: '09:00',
                duration: '20 Min',
                transfers: 1,
                line: 'Bus 100',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConnectionCard({
    required String departure,
    required String arrival,
    required String duration,
    required int transfers,
    required String line,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              departure,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(duration, style: const TextStyle(color: Colors.grey)),
          ],
        ),
        title: Text(line),
        subtitle: Text('$transfers Umstieg${transfers == 1 ? '' : 'e'}'),
        trailing: Text(
          arrival,
          style: const TextStyle(fontWeight: FontWeight.bold),
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
