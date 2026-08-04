/// buergeramt_screen.dart — Bürgerämter & Behörden
///
/// Nativ via OpenStreetMap Nominatim.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/buergeramt?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/services/location_service.dart';
import 'buergeramt_dto.dart';

class BuergeramtScreen extends StatefulWidget {
  const BuergeramtScreen({super.key});

  @override
  State<BuergeramtScreen> createState() => _BuergeramtScreenState();
}

class _BuergeramtScreenState extends State<BuergeramtScreen> {
  BuergeramtResponse? _response;
  bool _loading = true;
  String? _error;
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    final pos = await LocationService.getCurrentLocation().timeout(
      const Duration(seconds: 5),
      onTimeout: () => null,
    );
    if (pos != null && mounted) {
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
      });
      _loadAemter();
    } else if (mounted) {
      setState(() {
        _error = 'Standort nicht verfügbar. Bitte GPS aktivieren.';
        _loading = false;
      });
    }
  }

  Future<void> _loadAemter() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_lat == null || _lng == null) return;
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/buergeramt'
          '?lat=$_lat&lng=$_lng&radius=10',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _response = BuergeramtResponse.fromJson(json);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🏛️ Bürgeramt'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.blueGrey.shade400, Colors.blueGrey.shade800],
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
            const Icon(Icons.account_balance, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadAemter,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_response == null || _response!.aemter.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Keine Ämter gefunden.',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAemter,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Text(
            '${_response!.aemter.length} Amt${_response!.aemter.length == 1 ? '' : 'er'}',
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

          // Ämter list
          ..._response!.aemter.map((amt) => _buildAmtCard(amt)),
        ],
      ),
    );
  }

  Widget _buildAmtCard(BuergeramtDto amt) {
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
            // Type badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade700,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                amt.type,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Name
            Text(
              amt.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),

            // Address
            if (amt.address != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.location_on,
                      size: 14, color: Colors.white54),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      amt.address!,
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
            if (amt.distanceKm != null) ...[
              const SizedBox(height: 8),
              Text(
                '📍 ${amt.distanceKm!.toStringAsFixed(1)} km entfernt',
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
