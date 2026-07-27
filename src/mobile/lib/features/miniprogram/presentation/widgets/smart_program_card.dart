import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/live_status_model.dart';
import '../miniprogram_model.dart';
import 'live_status_badge.dart';

/// SmartProgramCard - Zeigt Live-Daten prominent wenn verfügbar,
/// sonst die statische Beschreibung.
/// Visueller Zustand: 4 Stufen (live, cached, loading, fallback).
class SmartProgramCard extends StatelessWidget {
  final MiniProgram program;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  const SmartProgramCard({
    super.key,
    required this.program,
    required this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final live = program.liveData;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        onLongPress: onLongPress,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border, width: 0.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(),
              const SizedBox(height: 10),
              // Phase R.4-Part3 UX-Polish (2026-07-27): bei LiveState.fallback
              // ehrlicher Backend-Hint statt leerem Badge oder Beschreibung.
              if (live != null && live.isLive)
                _buildLiveBody(live)
              else if (live != null && live.state == LiveState.fallback)
                _buildFallbackHint(live)
              else
                _buildStaticBody(),
              const Spacer(),
              _buildFooter(live),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final live = program.liveData;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(_iconForPath(program.iconPath),
              color: AppColors.primary, size: 24),
        ),
        if (live != null) LiveStatusBadge(state: live.state, size: 11),
      ],
    );
  }

  Widget _buildLiveBody(LiveStatus live) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          live.value ?? '—',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          live.subtext ?? '',
          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildStaticBody() {
    return Text(
      program.description,
      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }

  /// Phase R.4-Part3 (2026-07-27): Ehrlicher Hint statt leerem Badge bei
  /// LiveState.fallback -- weckt User-Erwartung nicht ("Wetter zeigt 18°C")
  /// und macht transparent dass das Service-Backend noch nicht live ist.
  Widget _buildFallbackHint(LiveStatus live) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.hourglass_empty,
            size: 12, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            'Backend folgt — Live-Daten automatisch sobald das Service-Backend verfügbar ist.',
            style: const TextStyle(
                fontSize: 10,
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildFooter(LiveStatus? live) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(program.name,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(program.category,
              style: const TextStyle(
                  fontSize: 9,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
        ),
      ],
    );
  }

  IconData _iconForPath(String iconPath) {
    return switch (iconPath) {
      'weather' => Icons.wb_sunny_outlined,
      'air' => Icons.air_outlined,
      'mobility' => Icons.directions_bus_outlined,
      'finance' => Icons.account_balance_wallet_outlined,
      'health' => Icons.local_hospital_outlined,
      'events' => Icons.event_outlined,
      'work' => Icons.work_outline,
      'delete' => Icons.delete_outline,
      'hotel' => Icons.hotel_outlined,
      'domain' => Icons.business_outlined,
      _ => Icons.apps_outlined,
    };
  }
}
