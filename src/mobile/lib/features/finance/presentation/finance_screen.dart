import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import 'finance_provider.dart';

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
              labelText: 'Empfänger (User-ID)',
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
          // DEMO: Direkt 25 KUDOS erhalten
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.success.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.success.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.auto_fix_high,
                        color: AppColors.success, size: 20),
                    const SizedBox(width: 8),
                    Text('Sofort Demo-KUDOS erhalten',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  '25 KUDOS direkt in dein Wallet — ohne Bank-Konto, ohne Taler-Exchange. '
                  'Nur zum Testen und Ausprobieren gedacht.',
                  style:
                      TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final ok =
                          await context.read<FinanceProvider>().fundLocal();
                      if (!mounted) return;
                      Navigator.pop(context);
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
          const SizedBox(height: 20),
          // TALER: Bank-Wire Anleitung
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.account_balance,
                        color: AppColors.warning, size: 20),
                    const SizedBox(width: 8),
                    Text('Taler-Bank-Wire (fortgeschritten)',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.warning)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Du hast ein Konto bei bank.demo.taler.net mit Guthaben? '
                  'Dann erstellt HEIMAT eine Reserve, die du von dort befüllen kannst.',
                  style:
                      TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
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
          // reserve_pub direkt oben — sofort sichtbar
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
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
                SelectableText(
                  result.reservePub,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'monospace',
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text('Tippen zum Kopieren',
                    style: TextStyle(
                        fontSize: 11, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 20),
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
                        color: AppColors.warning.withOpacity(0.8)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('So überweist du von der Bank:',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _stepRow('1', 'Gehe zu bank.demo.taler.net',
              'Du hast dort bereits 100 KUDOS (wie du uns gezeigt hast)'),
          _stepRow('2', 'Klicke "Geld senden" → "an Taler-Wallet"',
              'Füge deine reserve_pub als Empfänger ein'),
          _stepRow('3', 'Betrag 25 KUDOS eingeben und senden',
              'Die Bank überweist an den Taler-Exchange'),
          _stepRow('4', 'Zurück zu HEIMAT → "Aktualisieren"',
              'Dein Guthaben wird live vom Exchange geladen'),
        ],
      ),
    );
  }

  Widget _stepRow(String num, String title, String description) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
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
                Text(description,
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
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
            return const Center(child: CircularProgressIndicator());
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
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Gradient-Guthaben-Karte
                _buildBalanceCard(provider),
                const SizedBox(height: 24),
                // Transaktionen
                const Text('Transaktionen',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    )),
                const SizedBox(height: 12),
                if (provider.transactions.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long,
                    title: 'Noch keine Transaktionen',
                    description: 'Sende Geld an einen Freund, um loszulegen.',
                  )
                else
                  ...provider.transactions
                      .map((tx) => _buildTransactionTile(tx)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBalanceCard(FinanceProvider provider) {
    return Container(
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
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'User: ${provider.currentUserId}',
            style:
                TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            'Aktuelles Guthaben',
            style:
                TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                provider.balance.toStringAsFixed(2),
                style: const TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 6, left: 4),
                child: Text(
                  provider.currency,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white70,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: Column(
              children: [
                ElevatedButton.icon(
                  onPressed: _showFundSheet,
                  icon: const Icon(Icons.add_circle_outline, size: 18),
                  label: const Text('Guthaben aufladen'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.2),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ElevatedButton.icon(
                  onPressed: _showSendSheet,
                  icon: const Icon(Icons.send, size: 18),
                  label: const Text('Geld senden'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primaryDark,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
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

  Widget _buildTransactionTile(tx) {
    final provider = context.read<FinanceProvider>();
    final isIncoming = tx.toWalletId == provider.walletId;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: (isIncoming ? AppColors.success : AppColors.error)
                .withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isIncoming ? Icons.arrow_downward : Icons.arrow_upward,
            color: isIncoming ? AppColors.success : AppColors.error,
            size: 20,
          ),
        ),
        title: Text(
          '${isIncoming ? '+' : '-'}${tx.amount.toStringAsFixed(2)} ${tx.currency}',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: isIncoming ? AppColors.success : AppColors.textPrimary,
          ),
        ),
        subtitle: Text(
          tx.description ?? tx.status,
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        trailing: Text(
          tx.createdAt.substring(0, 10),
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}
