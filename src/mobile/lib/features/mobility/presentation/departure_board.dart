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
            final color = _parseColor(dep.routeColor);
            final timeParts = dep.departureTime.split(':');
            final timeStr = '${timeParts[0]}:${timeParts[1]}';
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
                      color: color,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      dep.routeShortName.isNotEmpty
                          ? dep.routeShortName
                          : dep.transportIcon,
                      style: TextStyle(
                        color: _textColorForBg(color),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      dep.headsign.isNotEmpty
                          ? dep.headsign
                          : dep.routeLongName,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
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
