import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';

import '../ai_chat_dto.dart';
import 'ai_chat_provider.dart';

/// AiChatScreen — ChatGPT-ähnlicher Chat mit HEIMATs lokalem KI-Assistenten.
///
/// **Verbesserungen (2026-07-29):**
/// 1. Suggestion-Chips für schnelle Fragen (Wetter, Ärzte, etc.)
/// 2. Health-Disclaimer-Banner
/// 3. Timestamps auf Nachrichten
/// 4. Retry-Button bei fehlgeschlagenen Nachrichten
/// 5. Modell-Status in AppBar
/// 6. Auto-Scroll bei neuen Nachrichten
class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _textFocus = FocusNode();
  bool _initialized = false;
  int _lastMessageCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_initialized && mounted) {
        _initialized = true;
      }
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    _textFocus.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();
    context.read<AiChatProvider>().sendMessage(text);
    _textFocus.unfocus();
  }

  void _sendSuggestion(String question) {
    context.read<AiChatProvider>().sendMessage(question);
    _textFocus.unfocus();
  }

  void _scrollToBottom() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatTimestamp(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'eben';
    if (diff.inMinutes < 60) return 'vor ${diff.inMinutes} Min';
    if (diff.inHours < 24) return 'vor ${diff.inHours}h';
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}. ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AiChatProvider>();

    // Auto-scroll bei neuen Nachrichten
    if (_lastMessageCount != p.messages.length && p.messages.isNotEmpty) {
      _lastMessageCount = p.messages.length;
      Future.microtask(_scrollToBottom);
    }

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.auto_awesome,
                color: AppColors.primary,
                size: 18,
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'HEIMAT AI',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'llama3.1:8b · lokal · datenschutz',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            // Verbindungsstatus
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: p.isLoading ? AppColors.warning : AppColors.success,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
          ],
        ),
        actions: [
          if (p.messages.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              tooltip: 'Chat-Verlauf löschen',
              onPressed: () {
                p.clear();
                _lastMessageCount = 0;
              },
            ),
        ],
      ),
      body: Column(
        children: [
          // Health-Disclaimer-Banner (oben, aber dezent)
          _buildDisclaimerBanner(),

          // Chat-Bubble-Liste
          Expanded(
            child: p.messages.isEmpty && !p.isLoading
                ? _buildEmptyState(p)
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    itemCount: p.messages.length + (p.isLoading ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (p.isLoading && index == p.messages.length) {
                        return _buildTypingIndicator();
                      }
                      return _buildMessageBubble(p.messages[index]);
                    },
                  ),
          ),
          // Input-Zeile
          _buildInputBar(p),
        ],
      ),
    );
  }

  Widget _buildDisclaimerBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      color: AppColors.info.withOpacity(0.08),
      child: Row(
        children: [
          Icon(
            Icons.info_outline,
            size: 14,
            color: AppColors.info.withOpacity(0.8),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Keine medizinische Diagnose. Bei Notfällen wählen Sie 112.',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary.withOpacity(0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(AiChatProvider p) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
      children: [
        // Hero-Bereich
        Center(
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withOpacity(0.12),
                      AppColors.primaryLight.withOpacity(0.06),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  size: 48,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'HEIMAT AI',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 40),
                child: Text(
                  'Dein persönlicher Assistent für Wetter, Luftqualität, Gesundheit, Abfallkalender und mehr.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),

        // Suggestion-Chips
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 12),
          child: Text(
            'Frag mich etwas:',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: AiChatProvider.quickSuggestions.map((s) {
            return ActionChip(
              avatar: Icon(s.icon, size: 16, color: AppColors.primary),
              label: Text(
                s.label,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textPrimary,
                ),
              ),
              onPressed: () => _sendSuggestion(s.question),
              backgroundColor: AppColors.primary.withOpacity(0.06),
              side: BorderSide(color: AppColors.primary.withOpacity(0.15)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: 20),

        // Tipp: Nachricht eingeben
        Center(
          child: Text(
            'Oder gib eine eigene Nachricht ein ↓',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary.withOpacity(0.6),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMessageBubble(ChatMessage message) {
    final isUser = message.role == ChatRole.user;
    final isSystem = message.role == ChatRole.system;

    // System-Nachrichten (klein, zentriert)
    if (isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.info.withOpacity(0.06),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              message.content,
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary.withOpacity(0.8),
                fontStyle: FontStyle.italic,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 40 : 0,
        right: isUser ? 0 : 40,
        bottom: 8,
      ),
      child: Column(
        crossAxisAlignment: isUser
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: isUser
                ? MainAxisAlignment.end
                : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Avatar (nur bei AI)
              if (!isUser)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    color: AppColors.primary,
                    size: 14,
                  ),
                ),
              // Bubble
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.primary : AppColors.card,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: isUser ? null : Border.all(color: AppColors.border),
                    boxShadow: isUser
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        message.content,
                        style: TextStyle(
                          fontSize: 14,
                          color: isUser ? Colors.white : AppColors.textPrimary,
                          height: 1.4,
                        ),
                      ),
                      // Timestamp
                      const SizedBox(height: 4),
                      Text(
                        _formatTimestamp(message.timestamp),
                        style: TextStyle(
                          fontSize: 10,
                          color: isUser
                              ? Colors.white.withOpacity(0.6)
                              : AppColors.textSecondary.withOpacity(0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Avatar (nur bei User)
              if (isUser)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.person,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(left: 0, bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Avatar
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.auto_awesome,
              color: AppColors.primary,
              size: 14,
            ),
          ),
          // Typing-Bubble
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
              ),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dot(),
                const SizedBox(width: 4),
                _dot(),
                const SizedBox(width: 4),
                _dot(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dot() {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: AppColors.textSecondary,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }

  Widget _buildInputBar(AiChatProvider p) {
    // Prüfen ob letzte Nachricht fehlgeschlagen ist
    final hasError = p.error != null;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Error-Banner mit Retry-Button
            if (hasError)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.cloud_off,
                      size: 14,
                      color: AppColors.error.withOpacity(0.7),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Verbindung fehlgeschlagen',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.error.withOpacity(0.8),
                        ),
                      ),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.refresh, size: 14),
                      label: const Text(
                        'Wiederholen',
                        style: TextStyle(fontSize: 12),
                      ),
                      onPressed: () => p.retryLast(),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 0,
                        ),
                        minimumSize: const Size(0, 28),
                      ),
                    ),
                  ],
                ),
              ),

            // Input-Zeile
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    enabled: !p.isLoading,
                    focusNode: _textFocus,
                    textInputAction: TextInputAction.send,
                    onSubmitted: p.isLoading ? null : (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: p.isLoading
                          ? 'Antwort wird erstellt …'
                          : 'Nachricht eingeben …',
                      hintStyle: TextStyle(
                        color: AppColors.textSecondary.withOpacity(0.6),
                        fontSize: 14,
                      ),
                      filled: true,
                      fillColor: AppColors.surface,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(
                          color: AppColors.primary.withOpacity(0.3),
                        ),
                      ),
                    ),
                    maxLines: 3,
                    minLines: 1,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: BoxDecoration(
                    color: p.isLoading
                        ? AppColors.textSecondary.withOpacity(0.3)
                        : AppColors.primary,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: IconButton(
                    icon: p.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            Icons.send_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                    onPressed: p.isLoading ? null : _sendMessage,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
