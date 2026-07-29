import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../ev_charging_dto.dart';

/// ChargingStationCard — Karte für eine E-Ladestation.
class ChargingStationCard extends StatelessWidget {
  final EvChargingStation station;

  const ChargingStationCard({super.key, required this.station});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Name + Status
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    const Icon(Icons.bolt, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      station.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (station.operator != null || station.network != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          [station.operator, station.network]
                              .whereType<String>()
                              .join(' · '),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
              // Status-Badge
              if (station.is247)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(8),
                    border:
                        Border.all(color: AppColors.success.withOpacity(0.2)),
                  ),
                  child: const Text(
                    '24/7',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.success,
                    ),
                  ),
                )
              else
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(8),
                    border:
                        Border.all(color: AppColors.warning.withOpacity(0.2)),
                  ),
                  child: Text(
                    station.openingHours ?? 'k.A.',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.warning,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          // Socket Badges
          if (station.sockets.isNotEmpty) ...[
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: station.sockets.map((s) {
                return _SocketBadge(socket: s);
              }).toList(),
            ),
            const SizedBox(height: 8),
          ],
          // Footer: Kapazität + Gebühr + Entfernung
          Row(
            children: [
              _FooterChip(
                icon: Icons.ev_station,
                label: station.sockets.isNotEmpty
                    ? '${station.sockets.length} Stecker-Typen'
                    : 'Keine Stecker-Daten',
              ),
              const SizedBox(width: 8),
              if (station.capacity != null)
                _FooterChip(
                  icon: Icons.local_parking,
                  label: '${station.capacity} Plätze',
                ),
              const SizedBox(width: 8),
              if (station.fee != null)
                _FooterChip(
                  icon: station.isFree
                      ? Icons.check_circle_outline
                      : Icons.monetization_on_outlined,
                  label: station.isFree ? 'Kostenlos' : 'Gebührenpflichtig',
                  color: station.isFree ? AppColors.success : AppColors.warning,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// SocketBadge — einzelner Stecker-Typ als Chip (z.B. "Type2 × 2")
class _SocketBadge extends StatelessWidget {
  final ChargingSocket socket;

  const _SocketBadge({required this.socket});

  @override
  Widget build(BuildContext context) {
    final label = _formatSocketType(socket.type);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.info.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.info.withOpacity(0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.power, size: 12, color: AppColors.info),
          const SizedBox(width: 4),
          Text(
            '$label × ${socket.count}',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.info,
            ),
          ),
        ],
      ),
    );
  }

  String _formatSocketType(String type) {
    // type2 → "Type2", type2:output → "Output", ccs → "CCS"
    if (type.contains(':')) {
      return type.split(':').last;
    }
    if (type == 'type2') return 'Type2';
    if (type == 'ccs') return 'CCS';
    if (type == 'chademo') return 'CHAdeMO';
    if (type == 'schuko') return 'Schuko';
    return type;
  }
}

/// FooterChip — kleine Info-Zeile in der StationCard.
class _FooterChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _FooterChip({
    required this.icon,
    required this.label,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppColors.textSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: chipColor),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: chipColor,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
