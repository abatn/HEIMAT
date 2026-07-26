import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import 'miniprogram_provider.dart';
import 'miniprogram_model.dart';
import 'miniprogram_container.dart';

/// Launcher-Screen: Zeigt alle verfügbaren Mini-Programme als
/// moderne Karten mit Kategorie-Filter.
class MiniProgramLauncherScreen extends StatefulWidget {
  const MiniProgramLauncherScreen({super.key});

  @override
  State<MiniProgramLauncherScreen> createState() =>
      _MiniProgramLauncherScreenState();
}

class _MiniProgramLauncherScreenState extends State<MiniProgramLauncherScreen> {
  String _selectedCategory = 'Alle';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MiniProgramProvider>().loadPrograms();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<MiniProgramProvider>(
      builder: (context, provider, _) {
        return Column(
          children: [
            _buildHeader(),
            _buildSearchBar(),
            _buildCategoryFilter(provider),
            const SizedBox(height: 8),
            Expanded(child: _buildProgramGrid(provider)),
          ],
        );
      },
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.apps_rounded,
                color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 14),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mini-Programme',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary)),
              SizedBox(height: 2),
              Text('Erweiterte Dienste für deinen Alltag',
                  style:
                      TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: TextField(
        controller: _searchController,
        onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
        decoration: InputDecoration(
          hintText: 'Mini-Programm suchen…',
          hintStyle: const TextStyle(color: AppColors.textSecondary),
          prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          filled: true,
          fillColor: AppColors.surface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryFilter(MiniProgramProvider provider) {
    final categories = provider.categories;
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = categories[index];
          final isSelected = cat == _selectedCategory;
          return GestureDetector(
            onTap: () => setState(() => _selectedCategory = cat),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.border,
                  width: 1,
                ),
              ),
              child: Text(
                cat,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  fontSize: 13,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProgramGrid(MiniProgramProvider provider) {
    var programs = provider.programsByCategory(_selectedCategory);
    if (_searchQuery.isNotEmpty) {
      programs = programs
          .where((p) =>
              p.name.toLowerCase().contains(_searchQuery) ||
              p.description.toLowerCase().contains(_searchQuery) ||
              p.category.toLowerCase().contains(_searchQuery))
          .toList();
    }
    if (programs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _searchQuery.isNotEmpty ? Icons.search_off : Icons.apps,
              size: 56,
              color: AppColors.textSecondary.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 12),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Keine Mini-Programme gefunden'
                  : 'Keine Mini-Programme verfügbar',
              style:
                  const TextStyle(fontSize: 16, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.85,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: programs.length,
      itemBuilder: (context, index) =>
          _buildProgramCard(context, programs[index]),
    );
  }

  Widget _buildProgramCard(BuildContext context, MiniProgram program) {
    final iconData = _getIconForProgram(program.iconPath);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _launchProgram(context, program),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border, width: 0.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(iconData, color: AppColors.primary, size: 26),
              ),
              const Spacer(),
              Text(program.name,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 3),
              Text(program.description,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(program.category,
                    style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _launchProgram(BuildContext context, MiniProgram program) {
    final provider = context.read<MiniProgramProvider>();
    provider.launchProgram(program);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChangeNotifierProvider.value(
          value: provider,
          child: const _MiniProgramViewerWrapper(),
        ),
      ),
    );
  }

  IconData _getIconForProgram(String iconPath) {
    return switch (iconPath) {
      'chat' => Icons.chat_bubble_outline,
      'weather' => Icons.wb_sunny_outlined,
      'air' => Icons.air_outlined,
      'events' => Icons.event_outlined,
      'work' => Icons.work_outline,
      'ev' => Icons.electric_bolt_outlined,
      'delete' => Icons.delete_outline,
      'hotel' => Icons.hotel_outlined,
      'parking' => Icons.local_parking_outlined,
      'domain' => Icons.business_outlined,
      _ => Icons.apps_outlined,
    };
  }
}

// ---------------------------------------------------------------------------
// Viewer Wrapper — reicht Provider-Kontext durch Navigator hindurch
// ---------------------------------------------------------------------------

class _MiniProgramViewerWrapper extends StatelessWidget {
  const _MiniProgramViewerWrapper();

  @override
  Widget build(BuildContext context) {
    return const _MiniProgramViewerScreen();
  }
}

// ---------------------------------------------------------------------------
// Viewer-Screen — WebView-Container für aktives Mini-Programm
// ---------------------------------------------------------------------------

class _MiniProgramViewerScreen extends StatelessWidget {
  const _MiniProgramViewerScreen();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MiniProgramProvider>();
    final program = provider.activeProgram;
    if (program == null) {
      return const Scaffold(
        body: Center(child: Text('Kein Mini-Programm ausgewählt')),
      );
    }
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(program.name),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            provider.closeProgram();
            Navigator.of(context).pop();
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.open_in_new),
            tooltip: 'Im Browser öffnen',
            onPressed: () => _openInBrowser(context, program.url),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border(
                bottom: BorderSide(color: AppColors.border, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_outline,
                    size: 14, color: AppColors.success),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(program.url,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ),
          Expanded(
            child: MiniProgramContainer(url: program.url, title: program.name),
          ),
        ],
      ),
    );
  }

  void _openInBrowser(BuildContext context, String url) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _ExternalOpenSheet(url: url),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom Sheet für "Im Browser öffnen"
// ---------------------------------------------------------------------------

class _ExternalOpenSheet extends StatelessWidget {
  final String url;
  const _ExternalOpenSheet({required this.url});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          const Icon(Icons.open_in_new, size: 40, color: AppColors.primary),
          const SizedBox(height: 12),
          const Text('Im Browser öffnen',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text(url,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: url));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('URL kopiert!'),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 2)),
                );
                Navigator.pop(context);
              },
              icon: const Icon(Icons.copy),
              label: const Text('URL kopieren'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
              },
              icon: const Icon(Icons.close),
              label: const Text('Schließen'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: AppColors.border),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
