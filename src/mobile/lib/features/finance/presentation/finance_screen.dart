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
            child: ElevatedButton.icon(
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
