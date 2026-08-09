import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../core/widgets/empty_state.dart';
import 'presentation/waste_provider.dart';
import 'waste_dto.dart';
import 'widgets/waste_widgets.dart';

/// WasteScreen — Native Flutter-Screen für Abfallkalender (Phase B-3).
///
/// **Datenquelle:** WasteProvider → /api/waste/calendar (Backend Phase B-2).
///
/// **Widgets:**
/// 1. AddressDialog (BottomSheet) wenn Backend HTTP 422 liefert
/// 2. Event-List mit Müllart-Badge + Datum
/// 3. City-Badge im Header (Berlin/Hamburg/München)
///
/// **Architecture-Mirror zu air_quality_screen.dart**:
/// PostFrameCallback initialisierung + RefreshIndicator + SkeletonLoader-
/// während-erstem-load + EmptyState on error.
class WasteScreen extends StatefulWidget {
  const WasteScreen({super.key});

  @override
  State<WasteScreen> createState() => _WasteScreenState();
}

class _WasteScreenState extends State<WasteScreen> {
  bool _initialized = false;
  bool _addressDialogShown = false;
  bool _scheduleIdDialogShown = false;

  final _streetCtrl = TextEditingController();
  final _houseNrCtrl = TextEditingController();
  final _scheduleIdCtrl = TextEditingController();
  String _dialogCity = 'hamburg';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized && mounted) {
        _initialized = true;
        final p = context.read<WasteProvider>();
        if (!p.hasData) {
          p.refresh();
        }
      }
    });
  }

  @override
  void dispose() {
    _streetCtrl.dispose();
    _houseNrCtrl.dispose();
    _scheduleIdCtrl.dispose();
    super.dispose();
  }

  /// Bottom-Sheet Dialog (AddressRequiredError-Backend-422).
  /// Wird vom build() aufgerufen wenn p.addressRequired toggle.
  void _showAddressDialog(BuildContext context) {
    if (_addressDialogShown) return;
    _addressDialogShown = true;

    final p = context.read<WasteProvider>();
    _streetCtrl.text = p.street;
    _houseNrCtrl.text = p.houseNr;
    _dialogCity = p.city;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(sheetCtx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.location_on, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Adresse benötigt',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(sheetCtx),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Für ${p.calendar?.displayName ?? p.city} brauchen wir Straße + Hausnummer, damit der BSR/AWB-Endpoint die richtigen Termine liefert.',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _streetCtrl,
                decoration: const InputDecoration(
                  labelText: 'Straße',
                  hintText: 'z.B. Unter den Linden',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _houseNrCtrl,
                decoration: const InputDecoration(
                  labelText: 'Hausnummer',
                  hintText: 'z.B. 1',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () {
                  final street = _streetCtrl.text.trim();
                  final houseNr = _houseNrCtrl.text.trim();
                  if (street.isEmpty || houseNr.isEmpty) {
                    ScaffoldMessenger.of(sheetCtx).showSnackBar(
                      const SnackBar(
                          content: Text('Beide Felder sind erforderlich.')),
                    );
                    return;
                  }
                  p.updateAddress(
                    city: _dialogCity,
                    street: street,
                    houseNr: houseNr,
                  );
                  Navigator.pop(sheetCtx);
                },
                icon: const Icon(Icons.check),
                label: const Text('Speichern & Neu laden'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    ).whenComplete(() {
      _addressDialogShown = false;
    });
  }

  /// Phase B-3 code-reviewer fix: dialog-trigger laeuft jetzt ueber
  /// didChangeDependencies (eine Lifecycle-Phase, nicht build-rebuild).
  /// So wird das BottomSheet nur bei false→true Transition geoeffnet,
  /// NICHT bei jedem build-rebuild (vermeidet infinite-dialog-loop wenn
  /// User dismiss-by-tap-outside und _addressRequired bleibt true).
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_addressDialogShown || _scheduleIdDialogShown) return;
    final p = context.read<WasteProvider>();
    if (p.addressRequired && _initialized) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showAddressDialog(context);
      });
    }
    // BSR schedule_id dialog: wenn Fehlermeldung schedule_id erfordert
    if (p.error != null &&
        p.error!.contains('schedule_id') &&
        _initialized &&
        !p.hasData) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showScheduleIdDialog(context);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<WasteProvider>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        title: const Text(
          'Abfallkalender',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: p.refreshWithLocation,
        color: AppColors.primary,
        child: _buildBody(context, p),
      ),
    );
  }

  Widget _buildBody(BuildContext context, WasteProvider p) {
    if (p.isLoading && !p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 24),
          SkeletonLoader(height: 48, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 80, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 80, borderRadius: 14),
          SizedBox(height: 12),
          SkeletonLoader(height: 80, borderRadius: 14),
        ],
      );
    }

    if (!p.hasData && p.error != null) {
      final needsScheduleId = p.error!.contains('schedule_id');
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            title: p.addressRequired
                ? 'Adresse benötigt'
                : needsScheduleId
                    ? 'BSR schedule_id benötigt'
                    : 'Abfallkalender nicht verfügbar',
            description: p.error!,
          ),
          if (!p.addressRequired && !needsScheduleId) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: FilledButton.icon(
                onPressed: p.refreshWithLocation,
                icon: const Icon(Icons.refresh),
                label: const Text('Erneut versuchen'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
              ),
            ),
          ],
          if (needsScheduleId) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: FilledButton.icon(
                onPressed: () => _showScheduleIdDialog(context),
                icon: const Icon(Icons.key),
                label: const Text('schedule_id eingeben'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
              ),
            ),
          ],
        ],
      );
    }

    if (!p.hasData) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 80),
          EmptyState(
            title: 'Keine Daten',
            description: 'Initialisiere …',
          ),
        ],
      );
    }

    final cal = p.calendar!;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        _buildHeader(p, cal),
        const SizedBox(height: 12),
        if (cal.events.isNotEmpty)
          ...cal.events.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: WasteEventCard(event: e),
              ))
        else
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyState(
              title: 'Keine Termine',
              description:
                  'Für den gewählten Zeitraum sind keine Abfuhrtermine hinterlegt.',
            ),
          ),
        const SizedBox(height: 12),
        _buildAttribution(cal),
      ],
    );
  }

  Widget _buildHeader(WasteProvider p, WasteCalendarResponse cal) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.delete_outline,
              color: AppColors.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              cal.displayName,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${cal.events.length} Termine · nächste ${cal.weeks} Wochen',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const Spacer(),
        if (p.isStale)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.cloud_off, color: AppColors.warning, size: 12),
                SizedBox(width: 4),
                Text(
                  'Veraltet',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.warning,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else if (p.lastUpdated != null)
          Text(
            'Aktualisiert ${_relativeTime(p.lastUpdated!)}',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
      ],
    );
  }

  /// Bottom-Sheet Dialog für BSR schedule_id (24-stelliger Code).
  void _showScheduleIdDialog(BuildContext context) {
    if (_scheduleIdDialogShown) return;
    _scheduleIdDialogShown = true;

    final p = context.read<WasteProvider>();
    _scheduleIdCtrl.text = p.scheduleId;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(sheetCtx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.key, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'BSR schedule_id',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(sheetCtx),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Für Berlin benötigen wir deine 24-stellige BSR schedule_id.\n\n'
                'So findest du sie:\n'
                '1. Gehe zu www.bsr.de/abfuhrkalender\n'
                '2. Gib deine Adresse ein\n'
                '3. Klicke auf den ICS-Download-Link\n'
                '4. Kopiere den 24-stelligen Code aus der URL',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _scheduleIdCtrl,
                decoration: const InputDecoration(
                  labelText: 'schedule_id',
                  hintText: 'z.B. 049011000107000039600010',
                  border: OutlineInputBorder(),
                ),
                maxLength: 30,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () {
                  final scheduleId = _scheduleIdCtrl.text.trim();
                  if (scheduleId.isEmpty || scheduleId.length < 20) {
                    ScaffoldMessenger.of(sheetCtx).showSnackBar(
                      const SnackBar(
                          content: Text(
                              'Bitte gib eine gültige schedule_id ein (24-stellig).')),
                    );
                    return;
                  }
                  p.updateScheduleId(scheduleId);
                  Navigator.pop(sheetCtx);
                },
                icon: const Icon(Icons.check),
                label: const Text('Speichern & Neu laden'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    ).whenComplete(() {
      _scheduleIdDialogShown = false;
    });
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min';
    if (diff.inHours < 24) return 'vor ${diff.inHours} Std';
    return 'vor ${diff.inDays} Tagen';
  }

  Widget _buildAttribution(WasteCalendarResponse cal) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Text(
        'Daten: ${cal.source} · ${cal.attribution}',
        style: const TextStyle(
          fontSize: 10,
          color: AppColors.textSecondary,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
