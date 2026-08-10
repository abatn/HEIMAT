/// job_screen.dart — Erweiterter Job-Suche Screen
///
/// Features:
/// 1. Suchleiste mit Stichwort + Standort
/// 2. Branchen-Filter Chips (Alle, Technik, Gesundheit, Handwerk, etc.)
/// 3. Job-Liste mit Firmenname, Titel, Standort, Remote-Badge, Gehalt
/// 4. Lazy Loading (weitere laden)
/// 5. Skeleton-Loader während Laden
/// 6. EmptyState bei keinen Treffern

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../core/widgets/empty_state.dart';
import 'job_dto.dart';
import 'job_provider.dart';

class JobScreen extends StatefulWidget {
  const JobScreen({super.key});

  @override
  State<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends State<JobScreen> {
  final _searchController = TextEditingController();
  final _locationController = TextEditingController();
  final _scrollController = ScrollController();
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _locationController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<JobProvider>().loadMore();
    }
  }

  void _search() {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    final location = _locationController.text.trim();
    context.read<JobProvider>().searchJobs(
          query,
          location: location.isNotEmpty ? location : null,
        );
    setState(() => _initialized = true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Job-Suche'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
      ),
      body: Column(
        children: [
          // Suchleiste + Branchen-Filter
          _buildSearchBar(),
          // Ergebnisse
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border(
          bottom: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Stichwort (z.B. Krankenpfleger)',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _locationController,
                  decoration: InputDecoration(
                    hintText: 'Ort (optional)',
                    prefixIcon:
                        const Icon(Icons.location_on_outlined, size: 20),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Branchen-Filter
          _buildBranchenFilter(),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _search,
              icon: const Icon(Icons.search, size: 18),
              label: const Text('Jobs suchen'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBranchenFilter() {
    return Consumer<JobProvider>(
      builder: (context, provider, _) {
        return SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: BranchenFilter.all.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final key = BranchenFilter.all[index];
              final label = BranchenFilter.labels[key] ?? key;
              final isSelected = provider.branchen == key;

              return FilterChip(
                label: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                selected: isSelected,
                onSelected: (_) => provider.setBranchen(key),
                backgroundColor: AppColors.surface,
                selectedColor: AppColors.primary,
                checkmarkColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildBody() {
    return Consumer<JobProvider>(
      builder: (context, provider, _) {
        if (!_initialized) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.work_outline,
                    size: 64, color: AppColors.textSecondary),
                SizedBox(height: 16),
                Text(
                  'Wonach suchst du?',
                  style: TextStyle(
                    fontSize: 18,
                    color: AppColors.textSecondary,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Gib einen Stichwort ein und finde Jobs in deiner Nähe',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          );
        }

        if (provider.isLoading && provider.jobs.isEmpty) {
          return _buildSkeleton();
        }

        if (provider.error != null && provider.jobs.isEmpty) {
          return EmptyState(
            icon: Icons.error_outline,
            title: 'Fehler bei der Suche',
            description: provider.error!,
          );
        }

        if (provider.jobs.isEmpty) {
          return EmptyState(
            icon: Icons.search_off,
            title: 'Keine Jobs gefunden',
            description: 'Versuche einen anderen Suchbegriff oder Branchen-Filter',
          );
        }

        return _buildJobList(provider);
      },
    );
  }

  Widget _buildSkeleton() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 5,
      itemBuilder: (_, __) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonLoader(width: 120, height: 16),
              const SizedBox(height: 8),
              SkeletonLoader(width: 200, height: 20),
              const SizedBox(height: 8),
              SkeletonLoader(width: 160, height: 14),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildJobList(JobProvider provider) {
    return Column(
      children: [
        // Treffer-Anzahl + Quelle
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          alignment: Alignment.centerLeft,
          child: Row(
            children: [
              Text(
                '${provider.total} Jobs gefunden',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  provider.result?.source == 'adzuna'
                      ? 'Adzuna'
                      : provider.result?.source == 'arbeitnow'
                          ? 'Arbeitnow'
                          : 'Gemischt',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
        // Job-Liste
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: provider.jobs.length + (provider.hasMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= provider.jobs.length) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              return _buildJobCard(provider.jobs[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildJobCard(JobListing job) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showJobDetail(job),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Firma + Remote-Badge + Quelle
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.companyName,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (job.remote)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Remote',
                        style: TextStyle(
                          color: Colors.green,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  if (job.formattedSalary != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        job.formattedSalary!
                        style: TextStyle(
                          color: Colors.orange,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              // Titel
              Text(
                job.title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              // Standort + Zeit + Kategorie
              Row(
                children: [
                  Icon(Icons.location_on_outlined,
                      size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    job.location.isNotEmpty ? job.location : 'Nicht angegeben',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  if (job.category != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        job.category!,
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                  const Spacer(),
                  Text(
                    job.relativeTime,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              // Tags
              if (job.tags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: job.tags.take(5).map((tag) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showJobDetail(JobListing job) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.3,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                // Firma
                Text(
                  job.companyName,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                // Titel
                Text(
                  job.title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                // Meta-Info
                Row(
                  children: [
                    Icon(Icons.location_on_outlined,
                        size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      job.location.isNotEmpty ? job.location : 'Remote',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    if (job.remote) ...[
                      const SizedBox(width: 12),
                      Icon(Icons.wifi, size: 16, color: Colors.green),
                      const SizedBox(width: 4),
                      const Text('Remote möglich',
                          style: TextStyle(color: Colors.green)),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                // Gehalt
                if (job.formattedSalary != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.euro, size: 20, color: Colors.orange),
                        const SizedBox(width: 8),
                        Text(
                          job.formattedSalary!,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.orange,
                          ),
                        ),
                        if (job.salaryIsPredicted) ...[
                          const SizedBox(width: 8),
                          Text(
                            '(geschätzt)',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.orange.withOpacity(0.7),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                // Job-Typen
                if (job.jobTypes.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    children: job.jobTypes.map((type) {
                      return Chip(
                        label: Text(type, style: const TextStyle(fontSize: 12)),
                        backgroundColor: AppColors.surface,
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      );
                    }).toList(),
                  ),
                const SizedBox(height: 16),
                // Beschreibung
                const Text(
                  'Beschreibung',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  job.description.replaceAll(RegExp(r'<[^>]*>'), ''),
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                // Bewerben-Button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: job.url.isNotEmpty
                        ? () async {
                            final uri = Uri.parse(job.url);
                            if (await canLaunchUrl(uri)) {
                              await launchUrl(uri,
                                  mode: LaunchMode.externalApplication);
                            }
                            if (context.mounted) Navigator.pop(context);
                          }
                        : null,
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Angebot ansehen'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
