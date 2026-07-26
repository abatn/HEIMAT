import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import 'finance_provider.dart';

// ============================================================================
// Haupt-Screen
// ============================================================================

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<FinanceProvider>();
      provider.loadWallet();
      provider.loadTransactions();
    });
  }

  void _showSendSheet() {
    final toController = TextEditingController();
    final amountController = TextEditingController();

    showHeimatBottomSheet(
      context,
      title: 'Geld senden',
      footer: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: () async {
            final to = toController.text.trim();
            final amount = double.tryParse(amountController.text.trim());
            if (to.isEmpty || amount == null || amount <= 0) return;
            Navigator.pop(context);
            final ok =
                await context.read<FinanceProvider>().sendMoney(to, amount);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(ok
                      ? '${amount.toStringAsFixed(2)} KUDOS gesendet an $to'
                      : 'Zahlung fehlgeschlagen'),
                  backgroundColor: ok ? AppColors.success : AppColors.error,
                ),
              );
            }
          },
          child: const Text('Senden'),
        ),
      ),
      child: Column(
        children: [
          TextField(
            controller: toController,
            decoration: const InputDecoration(
              labelText: 'Empfänger (E-Mail oder User-ID)',
              prefixIcon: Icon(Icons.person_outline),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amountController,
            decoration: const InputDecoration(
              labelText: 'Betrag',
              prefixIcon: Icon(Icons.monetization_on),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ],
      ),
    );
  }

  void _showFundSheet() {
    showHeimatBottomSheet(
      context,
      title: 'Guthaben aufladen',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.success.withOpacity(0.15),
                  AppColors.success.withOpacity(0.05),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.success.withOpacity(0.25)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.auto_fix_high,
                          color: AppColors.success, size: 18),
                    ),
                    const SizedBox(width: 10),
                    const Text('Demo-KUDOS erhalten',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success)),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  '25 KUDOS direkt in dein Wallet — ohne Bank-Konto, ohne Taler-Exchange.',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final ok =
                          await context.read<FinanceProvider>().fundLocal();
                      if (!mounted) return;
                      Navigator.pop(context);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(ok
                              ? '25 KUDOS Demo-Guthaben erhalten!'
                              : 'Fehler: Demoguthaben konnte nicht geladen werden'),
                          backgroundColor:
                              ok ? AppColors.success : AppColors.error,
                        ),
                      );
                    },
                    icon: const Icon(Icons.add_circle, size: 18),
                    label: const Text('25 Demo-KUDOS erhalten'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.account_balance,
                          color: AppColors.warning, size: 18),
                    ),
                    const SizedBox(width: 10),
                    const Text('Taler-Bank-Wire',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.warning)),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Du hast ein Konto bei bank.demo.taler.net? HEIMAT erstellt eine Reserve-Adresse zum Befüllen.',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final result =
                          await context.read<FinanceProvider>().openReserve();
                      if (!mounted) return;
                      Navigator.pop(context);
                      if (!mounted) return;
                      _showReserveSheet(result);
                    },
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Reserve-Adresse erstellen'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.warning,
                      side:
                          BorderSide(color: AppColors.warning.withOpacity(0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
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

  void _showReserveSheet(ReserveOpenResult? result) {
    if (!mounted) return;
    if (result == null) {
      final provider = context.read<FinanceProvider>();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(provider.error ?? 'Reserve konnte nicht erstellt werden'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    showHeimatBottomSheet(
      context,
      title: 'Reserve-Adresse',
      footer: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () {
            context.read<FinanceProvider>().loadWallet();
            Navigator.pop(context);
          },
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Guthaben aktualisieren'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withOpacity(0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.account_balance_wallet,
                        size: 18, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text('Deine Reserve-Adresse',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryDark)),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: SelectableText(
                    result.reservePub,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lightbulb_outline,
                    color: AppColors.warning, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Guthaben entsteht durch eine Überweisung von der Taler-Bank auf deine Reserve-Adresse.',
                    style: TextStyle(
                        fontSize: 13,
                        color: AppColors.warning.withOpacity(0.8),
                        height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Schritt-für-Schritt:',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _StepRow('1', 'Gehe zu bank.demo.taler.net',
              'Dort hast du 100 KUDOS Guthaben'),
          _StepRow('2', 'Klicke "Geld senden"',
              'Wähle "an Taler-Wallet (App oder WebExtension)"'),
          _StepRow('3', 'Füge reserve_pub ein & sende 25 KUDOS',
              'Die Bank überweist an den Taler-Exchange'),
          _StepRow('4', 'Zurück zu HEIMAT → "Aktualisieren"',
              'Dein Guthaben wird live geladen'),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<FinanceProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && !provider.hasLoaded) {
            return const _FinanceSkeleton();
          }
          if (provider.error != null && !provider.hasLoaded) {
            return Center(
              child: EmptyState(
                icon: Icons.error_outline,
                title: 'Fehler beim Laden',
                description: provider.error!,
                action: ElevatedButton(
                  onPressed: () => provider.loadWallet(),
                  child: const Text('Erneut versuchen'),
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadWallet();
              await provider.loadTransactions();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _AnimatedBalanceCard(provider: provider),
                  const SizedBox(height: 20),
                  _QuickActions(onFund: _showFundSheet, onSend: _showSendSheet),
                  const SizedBox(height: 24),
                  _TransactionsSection(transactions: provider.transactions),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ============================================================================
// Animated Balance Card — animierter Zähler + Gradient
// ============================================================================

class _AnimatedBalanceCard extends StatefulWidget {
  final FinanceProvider provider;
  const _AnimatedBalanceCard({required this.provider});

  @override
  State<_AnimatedBalanceCard> createState() => _AnimatedBalanceCardState();
}

class _AnimatedBalanceCardState extends State<_AnimatedBalanceCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  double _displayedBalance = 0;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.03).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _displayedBalance = widget.provider.balance;
  }

  AnimationController? _balanceController;

  @override
  void didUpdateWidget(_AnimatedBalanceCard old) {
    super.didUpdateWidget(old);
    if (old.provider.balance != widget.provider.balance) {
      _animateBalance(old.provider.balance, widget.provider.balance);
    }
  }

  void _animateBalance(double from, double to) {
    _balanceController?.dispose();
    _balanceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    final animation = Tween<double>(begin: from, end: to).animate(
      CurvedAnimation(parent: _balanceController!, curve: Curves.easeOutBack),
    );
    animation.addListener(() {
      if (mounted) setState(() => _displayedBalance = animation.value);
    });
    _balanceController!.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _balanceController?.dispose();
        _balanceController = null;
      }
    });
    _balanceController!.forward();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _balanceController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) => Transform.scale(
        scale: _pulseAnimation.value,
        child: child,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [
              AppColors.primaryDark,
              AppColors.primary,
              AppColors.primaryLight
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Dein Guthaben',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.85), fontSize: 14)),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.account_balance_wallet,
                          size: 12, color: Colors.white.withOpacity(0.8)),
                      const SizedBox(width: 4),
                      Text(widget.provider.currency,
                          style: TextStyle(
                              fontSize: 11,
                              color: Colors.white.withOpacity(0.8))),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _displayedBalance.toStringAsFixed(2),
                  style: const TextStyle(
                      fontSize: 44,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      height: 1),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6, left: 6),
                  child: Text(
                    widget.provider.currency,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withOpacity(0.7)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Letztes Update: gerade eben',
                style: TextStyle(
                    fontSize: 11, color: Colors.white.withOpacity(0.5))),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// Quick Actions — Action-Buttons mit Icons
// ============================================================================

class _QuickActions extends StatelessWidget {
  final VoidCallback onFund;
  final VoidCallback onSend;

  const _QuickActions({required this.onFund, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.add_circle_outline,
            label: 'Guthaben aufladen',
            color: AppColors.primary,
            bgColor: AppColors.primary.withOpacity(0.1),
            onTap: onFund,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionCard(
            icon: Icons.send_rounded,
            label: 'Geld senden',
            color: AppColors.secondary,
            bgColor: AppColors.secondary.withOpacity(0.1),
            onTap: onSend,
          ),
        ),
      ],
    );
  }
}

class _ActionCard extends StatefulWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });

  @override
  State<_ActionCard> createState() => _ActionCardState();
}

class _ActionCardState extends State<_ActionCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
          decoration: BoxDecoration(
            color: _isPressed ? widget.color.withOpacity(0.15) : widget.bgColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: widget.color.withOpacity(_isPressed ? 0.4 : 0.2)),
          ),
          child: Column(
            children: [
              Icon(widget.icon, color: widget.color, size: 28),
              const SizedBox(height: 8),
              Text(widget.label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: widget.color)),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// Transactions Section — nach Datum gruppierte Timeline
// ============================================================================

class _TransactionsSection extends StatelessWidget {
  final List<Transaction> transactions;

  const _TransactionsSection({required this.transactions});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Transaktionen',
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary)),
            if (transactions.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('${transactions.length}',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary)),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        if (transactions.isEmpty)
          const EmptyState(
            icon: Icons.receipt_long,
            title: 'Noch keine Transaktionen',
            description: 'Sende Geld an einen Freund, um loszulegen.',
          )
        else
          ...transactions.map((tx) => _TransactionTimelineTile(tx: tx)),
      ],
    );
  }
}

// ============================================================================
// Transaction Timeline Tile
// ============================================================================

class _TransactionTimelineTile extends StatelessWidget {
  final Transaction tx;
  const _TransactionTimelineTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    final provider = context.read<FinanceProvider>();
    final isIncoming = tx.toWalletId == provider.walletId;
    final color = isIncoming ? AppColors.success : AppColors.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline indicator
          Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withOpacity(0.3), width: 2),
                ),
                child: Icon(
                  isIncoming ? Icons.arrow_downward : Icons.arrow_upward,
                  color: color,
                  size: 18,
                ),
              ),
              Container(
                width: 2,
                height: 40,
                color: Colors.grey.withOpacity(0.2),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              '${isIncoming ? '+' : '-'}${tx.amount.toStringAsFixed(2)} ${tx.currency}',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: isIncoming
                                    ? AppColors.success
                                    : AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: _statusColor(tx.status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(tx.status,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: _statusColor(tx.status))),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                            tx.description ??
                                (isIncoming ? 'Gutschrift' : 'Auszahlung'),
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  Text(
                    _formatDate(tx.createdAt),
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'failed':
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      final now = DateTime.now();
      if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
        return 'Heute';
      }
      final yesterday = now.subtract(const Duration(days: 1));
      if (dt.year == yesterday.year &&
          dt.month == yesterday.month &&
          dt.day == yesterday.day) {
        return 'Gestern';
      }
      return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
    } catch (_) {
      return iso.substring(0, 10);
    }
  }
}

// ============================================================================
// Skeleton Loading — Shimmer-Animation
// ============================================================================

class _FinanceSkeleton extends StatefulWidget {
  const _FinanceSkeleton();

  @override
  State<_FinanceSkeleton> createState() => _FinanceSkeletonState();
}

class _FinanceSkeletonState extends State<_FinanceSkeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) => SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _shimmerCard(height: 200),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _shimmerCard(height: 80)),
                const SizedBox(width: 12),
                Expanded(child: _shimmerCard(height: 80)),
              ],
            ),
            const SizedBox(height: 24),
            _shimmerCard(height: 16, width: 120),
            const SizedBox(height: 12),
            _shimmerCard(height: 70),
            const SizedBox(height: 8),
            _shimmerCard(height: 70),
            const SizedBox(height: 8),
            _shimmerCard(height: 70),
          ],
        ),
      ),
    );
  }

  Widget _shimmerCard({double height = 60, double? width}) {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            Colors.grey.shade200,
            Colors.grey.shade100,
            Colors.grey.shade200,
          ],
          stops: [
            0.0,
            _animation.value.clamp(0.3, 0.7),
            1.0,
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// StepRow Helper (Bottom Sheet)
// ============================================================================

class _StepRow extends StatelessWidget {
  final String num;
  final String title;
  final String description;

  const _StepRow(this.num, this.title, this.description);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.3),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Center(
              child: Text(num,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(description,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
