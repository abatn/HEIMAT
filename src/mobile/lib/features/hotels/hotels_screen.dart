/// hotels_screen.dart — Hotels & Unterkünfte
///
/// Nativ via OpenStreetMap Overpass.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/hotels?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'hotels_dto.dart';

class HotelsScreen extends StatefulWidget {
  final double lat;
  final double lng;

  const HotelsScreen({
    super.key,
    this.lat = 52.52,
    this.lng = 13.41,
  });

  @override
  State<HotelsScreen> createState() => _HotelsScreenState();
}

class _HotelsScreenState extends State<HotelsScreen> {
  HotelsResponse? _response;
  bool _loading = true;
  String? _error;
  String _selectedType = 'all';

  @override
  void initState() {
    super.initState();
    _loadHotels();
  }

  Future<void> _loadHotels() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/hotels'
          '?lat=${widget.lat}&lng=${widget.lng}&radius=5',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _response = HotelsResponse.fromJson(json);
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Fehler: ${response.statusCode}';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Netzwerkfehler: $e';
        _loading = false;
      });
    }
  }

  List<HotelDto> get _filteredHotels {
    if (_response == null) return [];
    if (_selectedType == 'all') return _response!.hotels;
    return _response!.hotels.where((h) => h.type == _selectedType).toList();
  }

  Set<String> get _types {
    if (_response == null) return {};
    return _response!.hotels.map((h) => h.type).toSet();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🏨 Hotels'),
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
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.white))
            : _error != null
                ? _buildError()
                : _buildContent(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.hotel, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadHotels,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_response == null || _response!.hotels.isEmpty) {
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
      onRefresh: _loadHotels,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Text(
            '${_response!.hotels.length} Unterkunft${_response!.hotels.length == 1 ? '' : 'en'}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'In deiner Nähe (${_response!.radius.toStringAsFixed(0)} km)',
            style: const TextStyle(color: Colors.white54, fontSize: 14),
          ),
          const SizedBox(height: 16),

          // Type chips
          if (_types.length > 1) _buildTypeChips(),
          const SizedBox(height: 16),

          // Hotels list
          ..._filteredHotels.map((hotel) => _buildHotelCard(hotel)),
        ],
      ),
    );
  }

  Widget _buildTypeChips() {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                'Alle (${_response!.hotels.length})',
                style: TextStyle(
                  color: _selectedType == 'all'
                      ? Colors.teal.shade900
                      : Colors.white,
                  fontSize: 13,
                ),
              ),
              selected: _selectedType == 'all',
              selectedColor: Colors.white,
              backgroundColor: Colors.white.withOpacity(0.15),
              onSelected: (_) => setState(() => _selectedType = 'all'),
            ),
          ),
          ..._types.map((type) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(
                    type,
                    style: TextStyle(
                      color: _selectedType == type
                          ? Colors.teal.shade900
                          : Colors.white,
                      fontSize: 13,
                    ),
                  ),
                  selected: _selectedType == type,
                  selectedColor: Colors.white,
                  backgroundColor: Colors.white.withOpacity(0.15),
                  onSelected: (_) => setState(() => _selectedType = type),
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
            // Type badge + Stars
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

            // Name
            Text(
              hotel.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),

            // Address
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

            // Distance
            if (hotel.distanceKm != null) ...[
              const SizedBox(height: 8),
              Text(
                '📍 ${hotel.distanceKm!.toStringAsFixed(1)} km entfernt',
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
