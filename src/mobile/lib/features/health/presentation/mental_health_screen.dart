import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../mental_health_dto.dart';
import 'mental_health_provider.dart';

/// MentalHealthScreen — PHQ-9 Depressions-Screening mit Ollama Hybrid.
///
/// **Features:**
/// 1. PHQ-9 Screening (9 Fragen, Score 0-27)
/// 2. Verlauf anzeigen
/// 3. Notfall-Kontakte
/// 4. Statistiken
class MentalHealthScreen extends StatefulWidget {
  final bool isEmbedded;
  const MentalHealthScreen({super.key, this.isEmbedded = false});

  @override
  State<MentalHealthScreen> createState() => _MentalHealthScreenState();
}

class _MentalHealthScreenState extends State<MentalHealthScreen> {
  int _currentQuestionIndex = 0;
  final Map<String, int> _answers = {};
  bool _showResults = false;
  bool _showHistory = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    final provider = context.read<MentalHealthProvider>();
    provider.loadHistory();
    provider.loadStats();
    provider.loadEmergencyContacts();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isEmbedded) {
      return _buildContent();
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mentale Gesundheit'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _showHistory ? Icons.assessment_outlined : Icons.history,
              size: 20,
            ),
            onPressed: () => setState(() => _showHistory = !_showHistory),
            tooltip: _showHistory ? 'Screening' : 'Verlauf',
          ),
          IconButton(
            icon: const Icon(Icons.emergency_outlined, size: 20),
            onPressed: _showEmergencyContacts,
            tooltip: 'Notfall-Kontakte',
          ),
        ],
      ),
      body: _buildContent(),
    );
  }

  Widget _buildContent() {
    return _showHistory ? _buildHistoryView() : _buildScreeningView();
  }

  // ====================================================================
  // Screening View
  // ====================================================================
  Widget _buildScreeningView() {
    return Consumer<MentalHealthProvider>(
      builder: (context, provider, _) {
        if (_showResults && provider.lastAssessment != null) {
          return _buildResultsView(provider.lastAssessment!);
        }

        return Column(
          children: [
            // Header
            _buildScreeningHeader(),

            // Fortschritt
            _buildProgressBar(),

            // Aktuelle Frage
            Expanded(
              child: _buildCurrentQuestion(),
            ),

            // Navigation
            _buildNavigationButtons(),
          ],
        );
      },
    );
  }

  // ====================================================================
  // Screening Header
  // ====================================================================
  Widget _buildScreeningHeader() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.06),
            AppColors.primaryLight.withOpacity(0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.psychology_outlined,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PHQ-9 Depressions-Screening',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  'Frage ${_currentQuestionIndex + 1} von 9',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Progress Bar
  // ====================================================================
  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${((_currentQuestionIndex + 1) / 9 * 100).round()}%',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              Text(
                '${_answers.length}/9 beantwortet',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (_currentQuestionIndex + 1) / 9,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Current Question
  // ====================================================================
  Widget _buildCurrentQuestion() {
    final questions = [
      'Wenig Interesse oder Freude an Dingen, die Sie normalerweise gerne machen',
      'Niedergeschlagen, hoffnungslos oder verzweifelt',
      'Schwierigkeiten, ein- oder durchzuschlafen',
      'Müde oder kaum Energie',
      'Schlechter Appetit oder Überessen',
      'Schlecht über sich selbst — oder das Gefühl, ein Versager zu sein',
      'Schwer, sich auf Dinge zu konzentrieren, z.B. beim Lesen oder Fernsehen',
      'So langsam oder unruhig, dass es anderen aufgefallen ist — oder das Gegenteil',
      'Daran gedacht, sich selbst weh zu tun oder sich etwas anzutun',
    ];

    final fields = [
      'q1_lustlos', 'q2_niedergeschlagen', 'q3_schlafprobleme',
      'q4_muedigkeit', 'q5_appetit', 'q6_schlecht',
      'q7_konzentration', 'q8_bewegung', 'q9_selbstverletzung',
    ];

    final scale = [
      {'value': 0, 'label': 'Überhaupt nicht'},
      {'value': 1, 'label': 'An einzelnen Tagen'},
      {'value': 2, 'label': 'Mehr als die Hälfte der Tage'},
      {'value': 3, 'label': 'Fast jeden Tag'},
    ];

    final currentField = fields[_currentQuestionIndex];
    final currentValue = _answers[currentField];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Frage
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Text(
                          '${_currentQuestionIndex + 1}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Im vergangenen 2-Wochen-Interval:',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  questions[_currentQuestionIndex],
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Antwort-Skala
          const Text(
            'Wie oft haben Sie diese Beschwerden gehabt?',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),

          ...scale.map((option) {
            final value = option['value'] as int;
            final label = option['label'] as String;
            final isSelected = currentValue == value;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _answers[currentField] = value;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary.withOpacity(0.08)
                        : AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.border,
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected
                              ? AppColors.primary
                              : Colors.transparent,
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.border,
                          ),
                        ),
                        child: isSelected
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          label,
                          style: TextStyle(
                            fontSize: 14,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textPrimary,
                            fontWeight:
                                isSelected ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                      ),
                      Text(
                        '$value',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),

          // Warnung bei Frage 9
          if (_currentQuestionIndex == 8) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withOpacity(0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.error),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Wenn Sie gerade in einer Krise sind, rufen Sie bitte sofort die 112 oder die Telefonseelsorge (0800 111 0 111) an.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ====================================================================
  // Navigation Buttons
  // ====================================================================
  Widget _buildNavigationButtons() {
    final currentField = ['q1_lustlos', 'q2_niedergeschlagen', 'q3_schlafprobleme',
        'q4_muedigkeit', 'q5_appetit', 'q6_schlecht',
        'q7_konzentration', 'q8_bewegung', 'q9_selbstverletzung'][_currentQuestionIndex];
    final hasAnswer = _answers.containsKey(currentField);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          if (_currentQuestionIndex > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  setState(() => _currentQuestionIndex--);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Zurück'),
              ),
            ),
          if (_currentQuestionIndex > 0) const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: hasAnswer
                  ? () {
                      if (_currentQuestionIndex < 8) {
                        setState(() => _currentQuestionIndex++);
                      } else {
                        _submitScreening();
                      }
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.textSecondary.withOpacity(0.3),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                _currentQuestionIndex < 8 ? 'Weiter' : 'Ergebnis',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Submit Screening
  // ====================================================================
  Future<void> _submitScreening() async {
    if (_answers.length != 9) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bitte beantworten Sie alle 9 Fragen'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final provider = context.read<MentalHealthProvider>();
    final answers = Phq9Answers(
      q1Lustlos: _answers['q1_lustlos'] ?? 0,
      q2Niedergeschlagen: _answers['q2_niedergeschlagen'] ?? 0,
      q3Schlafprobleme: _answers['q3_schlafprobleme'] ?? 0,
      q4Muedigkeit: _answers['q4_muedigkeit'] ?? 0,
      q5Appetit: _answers['q5_appetit'] ?? 0,
      q6Schlecht: _answers['q6_schlecht'] ?? 0,
      q7Konzentration: _answers['q7_konzentration'] ?? 0,
      q8Bewegung: _answers['q8_bewegung'] ?? 0,
      q9Selbstverletzung: _answers['q9_selbstverletzung'] ?? 0,
    );

    final result = await provider.createAssessment(answers: answers);

    if (mounted && result != null) {
      setState(() {
        _showResults = true;
      });
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Screening fehlgeschlagen'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  // ====================================================================
  // Results View
  // ====================================================================
  Widget _buildResultsView(Phq9Assessment assessment) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Score Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Color(assessment.severityColor).withOpacity(0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: Color(assessment.severityColor).withOpacity(0.25),
              ),
            ),
            child: Column(
              children: [
                Text(
                  assessment.severityEmoji,
                  style: const TextStyle(fontSize: 48),
                ),
                const SizedBox(height: 16),
                Text(
                  '${assessment.totalScore}/27',
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w700,
                    color: Color(assessment.severityColor),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  assessment.severityLabel,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(assessment.severityColor),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Empfehlung
          if (assessment.aiRecommendation != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
                      SizedBox(width: 8),
                      Text(
                        'Empfehlung',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    assessment.aiRecommendation!,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),

          // Ollama-Analyse
          if (assessment.aiAnalysis != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.info.withOpacity(0.06),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.info.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.psychology, size: 18, color: AppColors.info),
                      SizedBox(width: 8),
                      Text(
                        'AI-Analyse',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    assessment.aiAnalysis!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textPrimary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Notfall-Button (bei hohem Score)
          if (assessment.totalScore >= 15)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _showEmergencyContacts,
                icon: const Icon(Icons.emergency, size: 20),
                label: const Text('Notfall-Kontakte anzeigen'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

          const SizedBox(height: 12),

          // Neues Screening
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                setState(() {
                  _showResults = false;
                  _currentQuestionIndex = 0;
                  _answers.clear();
                });
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Neues Screening starten'),
            ),
          ),

          const SizedBox(height: 16),

          // Disclaimer
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.06),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: AppColors.warning),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Dieses Screening ersetzt keine professionelle Diagnose. Bei Unsicherheit wenden Sie sich an einen Arzt.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // History View
  // ====================================================================
  Widget _buildHistoryView() {
    return Consumer<MentalHealthProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.history.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.history.isEmpty) {
          return const Center(
            child: EmptyState(
              icon: Icons.history,
              title: 'Noch kein Screening durchgeführt',
              description: 'Starten Sie Ihr erstes PHQ-9 Screening.',
            ),
          );
        }

        return Column(
          children: [
            // Stats Header
            if (provider.stats != null) _buildStatsHeader(provider.stats!),

            // Verlauf
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: provider.history.length,
                itemBuilder: (context, index) {
                  final assessment = provider.history[index];
                  return _buildHistoryCard(assessment);
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // ====================================================================
  // Stats Header
  // ====================================================================
  Widget _buildStatsHeader(Phq9Stats stats) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.06),
            AppColors.primaryLight.withOpacity(0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          _StatItem(
            label: 'Durchschnitt',
            value: stats.averageScore.toStringAsFixed(1),
            color: AppColors.primary,
          ),
          _StatItem(
            label: 'Trend',
            value: stats.trendEmoji,
            color: AppColors.info,
          ),
          _StatItem(
            label: 'Risiko',
            value: stats.riskLevel,
            color: Color(stats.riskColor),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // History Card
  // ====================================================================
  Widget _buildHistoryCard(Phq9Assessment assessment) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Color(assessment.severityColor).withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                assessment.severityEmoji,
                style: const TextStyle(fontSize: 24),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Score: ${assessment.totalScore}/27',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  assessment.severityLabel,
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(assessment.severityColor),
                  ),
                ),
              ],
            ),
          ),
          Text(
            _formatDate(assessment.createdAt),
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Emergency Contacts
  // ====================================================================
  void _showEmergencyContacts() {
    final provider = context.read<MentalHealthProvider>();
    final contacts = provider.emergencyContacts;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.5,
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.emergency, color: AppColors.error, size: 24),
                  SizedBox(width: 12),
                  Text(
                    'Notfall-Kontakte',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: contacts.length,
                itemBuilder: (context, index) {
                  final contact = contacts[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.phone,
                            color: AppColors.error,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                contact.name,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                contact.description,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          contact.number,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ====================================================================
  // Helper
  // ====================================================================
  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inDays == 0) return 'Heute';
      if (diff.inDays == 1) return 'Gestern';
      if (diff.inDays < 7) return 'Vor ${diff.inDays} Tagen';
      return '${date.day}.${date.month}.${date.year}';
    } catch (_) {
      return dateStr;
    }
  }
}

// ============================================================================
// Stat Item
// ============================================================================

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
