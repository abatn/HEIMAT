import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import 'mobility_provider.dart';

class DepartureBoard extends StatelessWidget {
  final String stopName;

  const DepartureBoard({super.key, required this.stopName});

  static void show(BuildContext context, String stopName) {
    context.read<MobilityProvider>().loadDepartures(stopName);
    showHeimatBottomSheet(
      context,
      title: 'Abfahrten — $stopName',
      child: DepartureBoard(stopName: stopName),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<MobilityProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        if (provider.departures.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Keine Abfahrten gefunden',
                style: TextStyle(color: AppColors.textSecondary)),
          );
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: provider.departures.map((dep) {
            final delayStr = dep.delay > 0 ? ' +${dep.delay}\'' : '';
            final platformStr =
                dep.platform.isNotEmpty ? ' · Gl. ${dep.platform}' : '';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      dep.lineLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      dep.directionLabel,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '${_formatTime(dep.departureTime)}$delayStr$platformStr',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color:
                          dep.delay > 0 ? AppColors.error : AppColors.primary,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

String _formatTime(String isoString) {
  try {
    final dt = DateTime.parse(isoString);
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    final parts = isoString.split('T');
    final timePart = parts.length > 1 ? parts.last : isoString;
    final tParts = timePart.split(':');
    return tParts.length >= 2 ? '${tParts[0]}:${tParts[1]}' : isoString;
  }
}
