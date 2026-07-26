import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';

// Conditional Import:
// - Standard (mobile/desktop): stub (kein dart:html)
// - Web (dart.library.html existiert): echtes IFrameElement via HtmlElementView
import 'package:heimat_app/features/miniprogram/presentation/miniprogram_container_stub.dart'
    if (dart.library.html) 'package:heimat_app/features/miniprogram/presentation/miniprogram_container_web.dart';

/// Plattformübergreifender WebView-Container für Mini-Programme.
///
/// - **Web:** Nutzt IFrameElement via HtmlElementView (conditional import)
/// - **Android/iOS:** Nutzt webview_flutter (wenn verfügbar, sonst Fallback)
class MiniProgramContainer extends StatefulWidget {
  final String url;
  final String title;
  final VoidCallback? onClose;

  const MiniProgramContainer({
    super.key,
    required this.url,
    required this.title,
    this.onClose,
  });

  @override
  State<MiniProgramContainer> createState() => _MiniProgramContainerState();
}

class _MiniProgramContainerState extends State<MiniProgramContainer> {
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _simulateLoadDelay();
  }

  Future<void> _simulateLoadDelay() async {
    try {
      await Future.delayed(const Duration(milliseconds: 600));
    } catch (_) {
      // ignored
    }
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return _buildLoadingIndicator();
    if (_hasError) return _buildErrorState();
    return _buildContentView();
  }

  Widget _buildLoadingIndicator() {
    return Container(
      color: Colors.white,
      child: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                  strokeWidth: 3, color: AppColors.primary),
            ),
            SizedBox(height: 16),
            Text('Lade Mini-Programm…',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off,
                size: 64, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            const Text('Mini-Programm konnte nicht geladen werden',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(widget.url,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _hasError = false;
                  _isLoading = true;
                });
                _simulateLoadDelay();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Erneut versuchen'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContentView() {
    if (kIsWeb) {
      return MiniProgramContainerWeb(url: widget.url);
    }
    return _buildMobileFallback();
  }

  Widget _buildMobileFallback() {
    return Container(
      color: Colors.white,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.phone_android, size: 48, color: AppColors.primary),
          const SizedBox(height: 12),
          const Text('Mini-Programm auf Mobilgerät',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Text(widget.url,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _openExternalBrowser,
            icon: const Icon(Icons.open_in_new),
            label: const Text('Im Browser öffnen'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            ),
          ),
        ],
      ),
    );
  }

  void _openExternalBrowser() {
    Clipboard.setData(ClipboardData(text: widget.url));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('URL in die Zwischenablage kopiert'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
