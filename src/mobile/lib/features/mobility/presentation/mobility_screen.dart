import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import 'mobility_provider.dart';
import 'departure_board.dart';
import 'journey_planner.dart';

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
    // _startLocation bleibt null bis LocationService liefert
    _initLocation();
  }

  Future<void> _initLocation() async {
    LatLng? location = await LocationService.getCurrentLocation();
    if (mounted) {
      setState(() {
        _startLocation = location;
      });
      if (_startLocation != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          context.read<MobilityProvider>().loadNearbyStops(
                _startLocation!.latitude,
                _startLocation!.longitude,
              );
        });
      }
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  void _zoomIn() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(
        _mapController.camera.center, (currentZoom + 1).clamp(3.0, 19.0));
  }

  void _zoomOut() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(
        _mapController.camera.center, (currentZoom - 1).clamp(3.0, 19.0));
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

    _mapController.move(latLng, 13.0);

    final provider = context.read<MobilityProvider>();
    provider.loadNearbyStops(lat, lng);

    if (_startLocation != null && _endLocation != null) {
      provider
          .loadRoute(
            _startLocation!.latitude,
            _startLocation!.longitude,
            _endLocation!.latitude,
            _endLocation!.longitude,
          )
          .then((_) => _fitRoute());
    }
  }

  void _fitRoute() {
    if (_startLocation == null || _endLocation == null) return;
    final bounds = LatLngBounds.fromPoints([_startLocation!, _endLocation!]);
    _mapController.fitCamera(
      CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(60)),
    );
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
    if (_startLocation != null && _endLocation != null) {
      final provider = context.read<MobilityProvider>();
      provider
          .loadRoute(
            _startLocation!.latitude,
            _startLocation!.longitude,
            _endLocation!.latitude,
            _endLocation!.longitude,
          )
          .then((_) => _fitRoute());
    }
  }

  void _showRouteInfo(MobilityProvider provider) {
    if (provider.route.isEmpty) return;
    final distKm = (provider.routeDistance / 1000).toStringAsFixed(1);
    final distMin = (provider.routeDuration / 60).round();

    showHeimatBottomSheet(
      context,
      title: 'Routeninformationen',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _routeInfoChip(Icons.straighten, '$distKm km', AppColors.primary),
              const SizedBox(width: 12),
              _routeInfoChip(
                  Icons.schedule, '$distMin Min', AppColors.secondary),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                _routeLine(
                    Icons.circle, _startController.text, AppColors.primary),
                const SizedBox(height: 4),
                _routeLine(Icons.arrow_downward, '$distKm km · $distMin Min',
                    AppColors.textSecondary),
                const SizedBox(height: 4),
                _routeLine(
                    Icons.location_on, _endController.text, AppColors.error),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _routeLine(IconData icon, String text, Color color) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 8),
        Text(text,
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _routeInfoChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.12), color.withOpacity(0.04)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: color,
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
          // Map (nur rendern wenn Standort bekannt)
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (_startLocation == null) {
                  return const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 12),
                        Text('Standort wird ermittelt...'),
                      ],
                    ),
                  );
                }
                return FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _startLocation!,
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
                            child: _MapMarker(color: AppColors.primary),
                          ),
                        if (_endLocation != null)
                          Marker(
                            point: _endLocation!,
                            width: 44,
                            height: 44,
                            child: _MapMarker(color: AppColors.error),
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
                                  gradient: LinearGradient(
                                    colors: [
                                      _stopColor(stop.stopType),
                                      _stopColor(stop.stopType)
                                          .withOpacity(0.8),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  shape: BoxShape.circle,
                                  border:
                                      Border.all(color: Colors.white, width: 2),
                                  boxShadow: [
                                    BoxShadow(
                                      color: _stopColor(stop.stopType)
                                          .withOpacity(0.35),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
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

          // Search panel
          if (!_showSearch)
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 12,
              right: 12,
              child: _buildSearchPanel(),
            ),

          // Zoom Controls + GPS Button
          if (!_showSearch)
            Positioned(
              top: MediaQuery.of(context).padding.top + 140,
              right: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _ZoomButton(
                    icon: Icons.add,
                    onPressed: _zoomIn,
                  ),
                  Container(
                    height: 1,
                    width: 24,
                    color: AppColors.border.withOpacity(0.3),
                  ),
                  _ZoomButton(
                    icon: Icons.remove,
                    onPressed: _zoomOut,
                  ),
                  const SizedBox(height: 8),
                  _GpsButton(
                    onPressed: () async {
                      LatLng? loc = await LocationService.getCurrentLocation();
                      if (loc != null && mounted) {
                        setState(() => _startLocation = loc);
                        _mapController.move(loc, 13.0);
                        context.read<MobilityProvider>().loadNearbyStops(
                              loc.latitude,
                              loc.longitude,
                            );
                      }
                    },
                  ),
                ],
              ),
            ),

          // Loading state
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (!provider.isLoading) return const SizedBox.shrink();
                return Positioned(
                  top: 160,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                  AppColors.primary),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text('Lade Daten...',
                              style: TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),

          // Error
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (provider.error == null) return const SizedBox.shrink();
                return Positioned(
                  bottom: 24,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.error.withOpacity(0.9),
                          AppColors.error.withOpacity(0.7),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.error.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(provider.error!,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

          // Route + Journey buttons
          if (!_showSearch)
            Consumer<MobilityProvider>(
              builder: (context, provider, _) {
                if (provider.route.isEmpty) return const SizedBox.shrink();
                return Positioned(
                  bottom: 24,
                  right: 16,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ActionButton(
                        heroTag: 'journey',
                        icon: Icons.route,
                        label: 'Reise',
                        color: AppColors.secondary,
                        onPressed: () async {
                          final p = context.read<MobilityProvider>();
                          await p.loadJourney(
                            _startLocation!.latitude,
                            _startLocation!.longitude,
                            _endLocation!.latitude,
                            _endLocation!.longitude,
                          );
                          if (context.mounted) {
                            JourneyPlanner.show(
                              context,
                              _startController.text,
                              _endController.text,
                            );
                          }
                        },
                      ),
                      const SizedBox(height: 8),
                      _ActionButton(
                        heroTag: 'routeInfo',
                        icon: Icons.info_outline,
                        label: 'Route',
                        color: AppColors.primary,
                        onPressed: () => _showRouteInfo(provider),
                      ),
                    ],
                  ),
                );
              },
            ),

          // Full-screen search
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
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: IconButton(
                                onPressed: () => setState(() {
                                  _showSearch = false;
                                  _searchResults = [];
                                }),
                                icon: const Icon(Icons.arrow_back),
                              ),
                            ),
                            const SizedBox(width: 8),
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
                      const Divider(height: 1, color: AppColors.border),
                      Expanded(
                        child: _searchResults.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.search,
                                        size: 48,
                                        color: AppColors.textSecondary
                                            .withOpacity(0.3)),
                                    const SizedBox(height: 12),
                                    const Text(
                                        'Tippe mindestens 3 Buchstaben...',
                                        style: TextStyle(
                                            color: AppColors.textSecondary)),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                itemCount: _searchResults.length,
                                itemBuilder: (context, index) {
                                  final result = _searchResults[index];
                                  final displayName =
                                      result['display_name'] as String? ?? '';
                                  final lat = result['lat'];
                                  final lng = result['lng'];
                                  return Container(
                                    margin: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 2),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: ListTile(
                                      leading: Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: AppColors.primary
                                              .withOpacity(0.1),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                        ),
                                        child: const Icon(Icons.location_on,
                                            color: AppColors.primary, size: 20),
                                      ),
                                      title: Text(displayName.split(',').first,
                                          style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w500)),
                                      subtitle: Text('$lat, $lng',
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.textSecondary)),
                                      onTap: () => _selectSearchResult(result),
                                    ),
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
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: IconButton(
                  onPressed: _swapLocations,
                  icon: const Icon(Icons.swap_vert, size: 20),
                  style: IconButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                  ),
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
          border: Border.all(color: AppColors.border.withOpacity(0.5)),
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
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _stopColor(stop.stopType).withOpacity(0.15),
                  _stopColor(stop.stopType).withOpacity(0.05),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(10),
              border:
                  Border.all(color: _stopColor(stop.stopType).withOpacity(0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_stopIcon(stop.stopType),
                    size: 16, color: _stopColor(stop.stopType)),
                const SizedBox(width: 6),
                Text(stop.stopType.toUpperCase(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _stopColor(stop.stopType),
                    )),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.location_on,
                        size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      '${stop.latitude.toStringAsFixed(5)}, ${stop.longitude.toStringAsFixed(5)}',
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                DepartureBoard.show(
                    context, stop.name, stop.latitude, stop.longitude);
              },
              icon: const Icon(Icons.schedule, size: 18),
              label: const Text('Abfahrten anzeigen'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// Map Marker
// ============================================================================

class _MapMarker extends StatelessWidget {
  final Color color;
  const _MapMarker({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(Icons.circle, color: Colors.white, size: 12),
    );
  }
}

// ============================================================================
// Zoom Button (+ / -)
// ============================================================================

class _ZoomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  const _ZoomButton({required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        borderRadius: BorderRadius.circular(14),
        color: AppColors.card,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: Container(
            padding: const EdgeInsets.all(12),
            child: Icon(icon, color: AppColors.textPrimary, size: 20),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// GPS Button
// ============================================================================

class _GpsButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _GpsButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        borderRadius: BorderRadius.circular(14),
        color: AppColors.card,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: Container(
            padding: const EdgeInsets.all(12),
            child: const Icon(Icons.my_location,
                color: AppColors.primary, size: 22),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// Action Button (Route / Journey)
// ============================================================================

class _ActionButton extends StatelessWidget {
  final String heroTag;
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  const _ActionButton({
    required this.heroTag,
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: FloatingActionButton.extended(
        heroTag: heroTag,
        onPressed: onPressed,
        backgroundColor: color,
        foregroundColor: Colors.white,
        icon: Icon(icon, size: 20),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    );
  }
}
