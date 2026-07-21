import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import 'mobility_provider.dart';

class JourneyPlanner extends StatelessWidget {
  final String fromName;
  final String toName;

  const JourneyPlanner(
      {super.key, required this.fromName, required this.toName});

  static void show(BuildContext context, String fromName, String toName) {
    showHeimatBottomSheet(
      context,
      title: 'Verbindung: $fromName → $toName',
      child: JourneyPlanner(fromName: fromName, toName: toName),
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
        if (provider.journeys.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Keine Verbindungen gefunden',
                style: TextStyle(color: AppColors.textSecondary)),
          );
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: provider.journeys.map((journey) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
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
                      Text(
                        _formatTime(journey.departure),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Icon(Icons.arrow_forward,
                            size: 16, color: AppColors.textSecondary),
                      ),
                      Text(
                        _formatTime(journey.arrival),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${journey.totalDurationMin} Min',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...journey.legs.map((leg) {
                    final isTransit = leg.type == 'transit';
                    final color = isTransit
                        ? _parseColor(leg.routeColor ?? '#6B7280')
                        : AppColors.textSecondary;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          Icon(
                            isTransit
                                ? Icons.directions_bus
                                : Icons.directions_walk,
                            size: 16,
                            color: color,
                          ),
                          const SizedBox(width: 8),
                          if (isTransit && (leg.lineLabel).isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                leg.lineLabel,
                                style: TextStyle(
                                  color: _textColorForBg(color),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          if (isTransit) const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              isTransit
                                  ? leg.directionLabel
                                  : '${leg.durationMin} Min zu Fuß',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textSecondary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Color _parseColor(String hex) {
    try {
      final cleaned = hex.replaceAll('#', '');
      return Color(int.parse('FF$cleaned', radix: 16));
    } catch (_) {
      return AppColors.textSecondary;
    }
  }

  Color _textColorForBg(Color bg) {
    final luminance = bg.computeLuminance();
    return luminance > 0.5 ? Colors.black : Colors.white;
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
