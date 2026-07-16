import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
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
  bool _showSearch = false;
  String _searchTarget = 'start';
  List<Map<String, dynamic>> _searchResults = [];
  Timer? _debounce;

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

  @override
  void dispose() {
    _debounce?.cancel();
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    if (query.length < 3) {
      setState(() => _searchResults = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final provider = context.read<MobilityProvider>();
      final results = await provider.geocode(query);
      if (mounted) setState(() => _searchResults = results);
    });
  }

  void _selectSearchResult(Map<String, dynamic> result) {
    final lat = double.parse(result['lat'].toString());
    final lng = double.parse(result['lng'].toString());
    final latLng = LatLng(lat, lng);
    final name = (result['display_name'] as String?)?.split(',').first ?? '';

    setState(() {
      if (_searchTarget == 'start') {
        _startLocation = latLng;
        _startController.text = name;
      } else {
        _endLocation = latLng;
        _endController.text = name;
      }
      _showSearch = false;
      _searchResults = [];
    });

    context.read<MobilityProvider>().loadNearbyStops(lat, lng);
    _mapController.move(latLng, 13.0);
  }

  void _swapLocations() {
    final tmpLoc = _startLocation;
    final tmpCtrl = _startController.text;
    setState(() {
      _startLocation = _endLocation;
      _startController.text = _endController.text;
      _endLocation = tmpLoc;
      _endController.text = tmpCtrl;
    });
  }

  void _showRouteInfo(MobilityProvider provider) {
    if (provider.route.isEmpty) return;
    final route = provider.route.first;
    double totalDist = 0;
    for (var i = 0; i < route.length - 1; i++) {
      totalDist += Distance().distance(route[i], route[i + 1]);
    }
    final distKm = (totalDist / 1000).toStringAsFixed(1);
    final distMin = (totalDist / 80).round();

    showHeimatBottomSheet(
      context,
      title: 'Routeninformationen',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _routeInfoChip(Icons.straighten, '$distKm km'),
              const SizedBox(width: 12),
              _routeInfoChip(Icons.schedule, '$distMin Min'),
            ],
          ),
          const SizedBox(height: 16),
          Text('Von: ${_startController.text}',
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 4),
          Text('Nach: ${_endController.text}',
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _routeInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              )),
        ],
      ),
    );
  }

  Color _stopColor(String type) => AppColors.stopColor(type);

  IconData _stopIcon(String type) => switch (type) {
        'bus' => Icons.directions_bus,
        'subway' => Icons.subway,
        'train' => Icons.train,
        'tram' => Icons.tram,
        _ => Icons.bus_alert,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Karte
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
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
                            color: AppColors.primary,
                            strokeWidth: 5.0,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        if (_startLocation != null)
                          Marker(
                            point: _startLocation!,
                            width: 44,
                            height: 44,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.circle,
                                  color: Colors.white, size: 12),
                            ),
                          ),
                        if (_endLocation != null)
                          Marker(
                            point: _endLocation!,
                            width: 44,
                            height: 44,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.error.withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.circle,
                                  color: Colors.white, size: 12),
                            ),
                          ),
                        for (final stop in provider.nearbyStops)
                          Marker(
                            point: stop.location,
                            width: 36,
                            height: 36,
                            child: GestureDetector(
                              onTap: () => _showStopInfo(stop),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: _stopColor(stop.stopType),
                                  shape: BoxShape.circle,
                                  border:
                                      Border.all(color: Colors.white, width: 2),
                                  boxShadow: [
                                    BoxShadow(
                                      color: _stopColor(stop.stopType)
                                          .withOpacity(0.25),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Icon(_stopIcon(stop.stopType),
                                    color: Colors.white, size: 16),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),

          // Suchfeld oben
          if (!_showSearch)
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 12,
              right: 12,
              child: _buildSearchPanel(),
            ),

          // Ladezustand
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (!provider.isLoading) return const SizedBox.shrink();
                return Positioned(
                  top: 160,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2)),
                            SizedBox(width: 12),
                            Text('Lade Daten...',
                                style: TextStyle(fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),

          // Fehler
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (provider.error == null) return const SizedBox.shrink();
                return Positioned(
                  bottom: 24,
                  left: 16,
                  right: 16,
                  child: Card(
                    color: AppColors.error,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(provider.error!,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13)),
                    ),
                  ),
                );
              },
            ),

          // Routen-Button
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (provider.route.isEmpty) return const SizedBox.shrink();
                return Positioned(
                  bottom: 24,
                  right: 16,
                  child: FloatingActionButton.extended(
                    onPressed: () => _showRouteInfo(provider),
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    icon: const Icon(Icons.info_outline),
                    label: const Text('Route'),
                  ),
                );
              },
            ),

          // Vollbild-Suche
          if (_showSearch)
            Positioned.fill(
              child: Material(
                color: AppColors.card,
                child: SafeArea(
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: () => setState(() {
                                _showSearch = false;
                                _searchResults = [];
                              }),
                              icon: const Icon(Icons.arrow_back),
                            ),
                            Expanded(
                              child: TextField(
                                autofocus: true,
                                decoration: InputDecoration(
                                  hintText: _searchTarget == 'start'
                                      ? 'Start eingeben...'
                                      : 'Ziel eingeben...',
                                  border: InputBorder.none,
                                  hintStyle: const TextStyle(
                                      color: AppColors.textSecondary),
                                ),
                                onChanged: _onSearchChanged,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1),
                      Expanded(
                        child: _searchResults.isEmpty
                            ? const Center(
                                child: Text('Tippe mindestens 3 Buchstaben...',
                                    style: TextStyle(
                                        color: AppColors.textSecondary)),
                              )
                            : ListView.builder(
                                itemCount: _searchResults.length,
                                itemBuilder: (context, index) {
                                  final result = _searchResults[index];
                                  final displayName =
                                      result['display_name'] as String? ?? '';
                                  return ListTile(
                                    leading: const Icon(Icons.location_on,
                                        color: AppColors.textSecondary,
                                        size: 20),
                                    title: Text(displayName.split(',').first,
                                        style: const TextStyle(fontSize: 15)),
                                    subtitle: Text(displayName,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary)),
                                    onTap: () => _selectSearchResult(result),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchPanel() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 8, 4),
        child: Row(
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Column(
                children: [
                  Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                          color: AppColors.primary, shape: BoxShape.circle)),
                  Container(width: 1, height: 20, color: AppColors.border),
                  Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                          color: AppColors.error, shape: BoxShape.circle)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                children: [
                  _buildSearchField(
                    controller: _startController,
                    hint: 'Start eingeben',
                    target: 'start',
                  ),
                  const SizedBox(height: 4),
                  _buildSearchField(
                    controller: _endController,
                    hint: 'Ziel eingeben',
                    target: 'end',
                  ),
                ],
              ),
            ),
            if (_startController.text.isNotEmpty ||
                _endController.text.isNotEmpty)
              IconButton(
                onPressed: _swapLocations,
                icon: const Icon(Icons.swap_vert, size: 20),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.surface,
                  foregroundColor: AppColors.textSecondary,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchField({
    required TextEditingController controller,
    required String hint,
    required String target,
  }) {
    return GestureDetector(
      onTap: () => setState(() {
        _showSearch = true;
        _searchTarget = target;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.search, size: 18, color: AppColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                controller.text.isEmpty ? hint : controller.text,
                style: TextStyle(
                  fontSize: 14,
                  color: controller.text.isEmpty
                      ? AppColors.textSecondary
                      : AppColors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showStopInfo(dynamic stop) {
    showHeimatBottomSheet(
      context,
      title: stop.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _stopColor(stop.stopType).withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_stopIcon(stop.stopType),
                    size: 14, color: _stopColor(stop.stopType)),
                const SizedBox(width: 4),
                Text(stop.stopType.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _stopColor(stop.stopType),
                    )),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '${stop.latitude.toStringAsFixed(5)}, ${stop.longitude.toStringAsFixed(5)}',
            style:
                const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
