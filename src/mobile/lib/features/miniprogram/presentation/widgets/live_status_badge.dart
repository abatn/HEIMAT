import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/live_status_model.dart';

/// LiveStatusBadge - Animierter Indikator für Live-Daten
/// Pulse-Animation bei Live-State, statische Icons bei Fallback
class LiveStatusBadge extends StatefulWidget {
  final LiveState state;
  final double size;

  const LiveStatusBadge({
    super.key,
    required this.state,
    this.size = 12,
  });

  @override
  State<LiveStatusBadge> createState() => _LiveStatusBadgeState();
}

class _LiveStatusBadgeState extends State<LiveStatusBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color _colorForState() {
    switch (widget.state) {
      case LiveState.live:
        return AppColors.success;
      case LiveState.cached:
        return AppColors.info;
      case LiveState.loading:
        return AppColors.warning;
      case LiveState.fallback:
        return AppColors.textSecondary;
      case LiveState.error:
        return AppColors.error;
    }
  }

  IconData _iconForState() {
    switch (widget.state) {
      case LiveState.live:
        return Icons.circle;
      case LiveState.cached:
        return Icons.cloud_done;
      case LiveState.loading:
        return Icons.sync;
      case LiveState.fallback:
        return Icons.info_outline;
      case LiveState.error:
        return Icons.warning_amber;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorForState();
    final isLive = widget.state == LiveState.live;
    final isLoading = widget.state == LiveState.loading;
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final pulse = (isLive || isLoading) ? _animation.value : 1.0;
        return Container(
          padding:
              EdgeInsets.symmetric(horizontal: widget.size * 0.6, vertical: 2),
          decoration: BoxDecoration(
            color: color.withOpacity((isLive ? 0.15 + (pulse * 0.1) : 0.12)),
            borderRadius: BorderRadius.circular(widget.size),
            border: Border.all(color: color.withOpacity(0.35), width: 0.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isLoading)
                SizedBox(
                  width: widget.size,
                  height: widget.size,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                  ),
                )
              else
                Icon(_iconForState(), size: widget.size * 0.9, color: color),
              SizedBox(width: widget.size * 0.3),
              Text(
                widget.state.name.toUpperCase(),
                style: TextStyle(
                  fontSize: widget.size * 0.55,
                  color: color,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
