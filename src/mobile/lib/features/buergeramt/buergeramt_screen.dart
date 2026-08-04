/// buergeramt_screen.dart — Buergeraemter & Behoerden
///
/// Nativ via OpenStreetMap Nominatim.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/buergeramt?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'buergeramt_provider.dart';
import 'buergeramt_dto.dart';

class BuergeramtScreen extends StatelessWidget {
  const BuergeramtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => BuergeramtProvider()..loadAemter(),
      child: const _BuergeramtBody(),
    );
  }
}

class _BuergeramtBody extends StatelessWidget {
  const _BuergeramtBody();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Buergeramt'),
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
        child: Consumer<BuergeramtProvider>(
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

  Widget _buildError(BuildContext context, BuergeramtProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.account_balance, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              provider.error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => provider.loadAemter(),
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, BuergeramtProvider provider) {
    if (provider.aemter.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Keine Aemter gefunden.',
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
            '${provider.count} Amt${provider.count == 1 ? '' : 'er'}',
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
          ...provider.aemter.map((amt) => _buildAmtCard(amt)),
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
            Text(
              amt.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
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
            if (amt.distanceKm != null) ...[
              const SizedBox(height: 8),
              Text(
                '${amt.distanceKm!.toStringAsFixed(1)} km entfernt',
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
