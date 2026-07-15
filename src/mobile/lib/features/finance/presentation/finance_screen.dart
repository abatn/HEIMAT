import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

  void _showSendDialog() {
    final toController = TextEditingController();
    final amountController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Geld senden'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: toController,
              decoration: const InputDecoration(
                labelText: 'Empfänger (User-ID)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: amountController,
              decoration: const InputDecoration(
                labelText: 'Betrag (EUR)',
                border: OutlineInputBorder(),
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Abbrechen'),
          ),
          ElevatedButton(
            onPressed: () async {
              final to = toController.text.trim();
              final amount = double.tryParse(amountController.text.trim());
              if (to.isEmpty || amount == null || amount <= 0) return;
              Navigator.pop(ctx);
              final ok =
                  await context.read<FinanceProvider>().sendMoney(to, amount);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok
                        ? '€${amount.toStringAsFixed(2)} gesendet an $to'
                        : 'Zahlung fehlgeschlagen'),
                    backgroundColor: ok ? Colors.green : Colors.red,
                  ),
                );
              }
            },
            child: const Text('Senden'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Finanzen')),
      body: Consumer<FinanceProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && !provider.hasLoaded) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.error != null && !provider.hasLoaded) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.loadWallet(),
                    child: const Text('Erneut versuchen'),
                  ),
                ],
              ),
            );
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  elevation: 4,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Text('User: ${provider.currentUserId}',
                            style: const TextStyle(
                                fontSize: 12, color: Colors.grey)),
                        const SizedBox(height: 4),
                        const Text('Aktuelles Guthaben',
                            style: TextStyle(fontSize: 16, color: Colors.grey)),
                        const SizedBox(height: 8),
                        Text(
                          '${provider.balance.toStringAsFixed(2)} \u20ac',
                          style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              color: Colors.green),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _showSendDialog,
                            icon: const Icon(Icons.send),
                            label: const Text('Geld senden'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Text('Transaktionen',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (provider.transactions.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Noch keine Transaktionen'),
                    ),
                  )
                else
                  for (final tx in provider.transactions)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          tx.amount > 0
                              ? Icons.arrow_downward
                              : Icons.arrow_upward,
                          color: tx.amount > 0 ? Colors.green : Colors.red,
                        ),
                        title: Text(
                            '${tx.amount.toStringAsFixed(2)} ${tx.currency}'),
                        subtitle: Text(tx.description ?? tx.status),
                        trailing: Text(
                          tx.createdAt.substring(0, 10),
                          style:
                              const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
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
