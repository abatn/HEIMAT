import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../air_quality_dto.dart';

/// AQI-Ring: Zeigt den European AQI als animierten Ring + Level-Text.
class AqiRingCard extends StatelessWidget {
  final CurrentAirQualityDto current;
  final bool isStale;

  const AqiRingCard({
    super.key,
    required this.current,
    this.isStale = false,
  });

  Color _aqiColor() {
    final hex = current.aqiColor.replaceFirst('#', '');
    if (hex.length == 6) {
      return Color(int.parse('FF$hex', radix: 16));
    }
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    final aqiColor = _aqiColor();
    final aqi = current.europeanAqi?.toInt();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            aqiColor.withOpacity(0.15),
            aqiColor.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: aqiColor.withOpacity(0.2), width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: aqiColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.air, color: aqiColor, size: 22),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Luftqualität',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    current.aqiLevel,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: aqiColor,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              if (isStale)
                Icon(Icons.cloud_off, color: AppColors.warning, size: 16),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildPill('PM₂.₅', current.pm25, 'µg/m³'),
              const SizedBox(width: 8),
              _buildPill('PM₁₀', current.pm10, 'µg/m³'),
              const SizedBox(width: 8),
              _buildPill('O₃', current.ozone, 'µg/m³'),
            ],
          ),
          const SizedBox(height: 12),
          // EAQI-Ring
          Center(
            child: SizedBox(
              width: 100,
              height: 100,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: aqi != null ? (aqi / 120).clamp(0.0, 1.0) : 0,
                    strokeWidth: 8,
                    backgroundColor: aqiColor.withOpacity(0.15),
                    valueColor: AlwaysStoppedAnimation(aqiColor),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        aqi?.toString() ?? '--',
                        style: TextStyle(
                          fontSize: aqi != null ? 28 : 18,
                          fontWeight: FontWeight.w800,
                          color: aqiColor,
                        ),
                      ),
                      Text(
                        'EAQI',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPill(String label, double? value, String unit) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border, width: 0.5),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value?.toStringAsFixed(1) ?? '--',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              unit,
              style: const TextStyle(
                fontSize: 9,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// HourlyAQIStrip — 24-Stunden AQI-Vorhersage horizontal scrollbar
class HourlyAQIStrip extends StatelessWidget {
  final List<HourlyAirQualityDto> hourly;

  const HourlyAQIStrip({super.key, required this.hourly});

  Color _aqiColor(double? aqi) {
    if (aqi == null) return AppColors.textSecondary;
    if (aqi < 20) return const Color(0xFF1bc81b);
    if (aqi < 40) return const Color(0xFF3ea83e);
    if (aqi < 60) return const Color(0xFFa8a83e);
    if (aqi < 80) return const Color(0xFFff9933);
    if (aqi < 100) return const Color(0xFFff3333);
    return const Color(0xFF990000);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.schedule, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                '24h-Vorhersage',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: hourly.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final h = hourly[i];
                final color = _aqiColor(h.europeanAqi);
                final aqi = h.europeanAqi?.toInt();
                final hour =
                    h.time.length >= 16 ? h.time.substring(11, 16) : h.time;
                return Column(
                  children: [
                    Text(
                      hour,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Text(
                          aqi?.toString() ?? '--',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'EAQI',
                      style: TextStyle(
                        fontSize: 9,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// PollutantDetailCard — Detaillierte Aufschlüsselung aller Schadstoffe
class PollutantDetailCard extends StatelessWidget {
  final CurrentAirQualityDto current;

  const PollutantDetailCard({super.key, required this.current});

  @override
  Widget build(BuildContext context) {
    final pollutants = [
      _PollutantData('Feinstaub PM₂.₅', current.pm25, 'µg/m³', Icons.blur_on,
          const Color(0xFF6366F1)),
      _PollutantData('Feinstaub PM₁₀', current.pm10, 'µg/m³', Icons.blur_on,
          const Color(0xFF8B5CF6)),
      _PollutantData('Stickstoffdioxid NO₂', current.nitrogenDioxide, 'µg/m³',
          Icons.science, const Color(0xFFF59E0B)),
      _PollutantData('Ozon O₃', current.ozone, 'µg/m³', Icons.wb_sunny,
          const Color(0xFF3B82F6)),
      _PollutantData('Kohlenmonoxid CO', current.carbonMonoxide, 'mg/m³',
          Icons.factory, const Color(0xFF6B7280)),
      _PollutantData('Schwefeldioxid SO₂', current.sulphurDioxide, 'µg/m³',
          Icons.science_outlined, const Color(0xFF10B981)),
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.analytics_outlined,
                  size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              const Text(
                'Schadstoffdetails',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...pollutants.map((p) => _buildPollutantRow(p)),
        ],
      ),
    );
  }

  Widget _buildPollutantRow(_PollutantData p) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: p.color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(p.icon, color: p.color, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              p.label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            p.value != null ? p.value!.toStringAsFixed(1) : '--',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            p.unit,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _PollutantData {
  final String label;
  final double? value;
  final String unit;
  final IconData icon;
  final Color color;
  const _PollutantData(
      this.label, this.value, this.unit, this.icon, this.color);
}
