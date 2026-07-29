import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../ai_chat_dto.dart';
import 'ai_chat_provider.dart';

/// AiChatScreen — ChatGPT-ähnlicher Chat mit HEIMATs lokalem KI-Assistenten.
///
/// **Backend:** ollamaService → llama3.1:8b (localhost:11434)
/// **Fallback:** Bei offline-Ollama: deutscher Hinweistext + Retry-Button.
///
/// **Widgets:**
/// 1. Chat-Bubble-List (scrollbar, auto-scroll bei neuer Nachricht)
/// 2. Input-Zeile mit TextField + Senden-Button
/// 3. Clear-Button in AppBar
/// 4. Loading-Indikator bei Backend-Antwort
class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
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
    super.dispose();
  }

  void _sendMessage() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();
    context.read<AiChatProvider>().sendMessage(text);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<AiChatProvider>();

    // Auto-scroll bei neuen Nachrichten (Listener auf messages.length)
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
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.auto_awesome,
                  color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'HEIMAT AI',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                Text(
                  'llama3.1:8b · lokal',
                  style:
                      TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ],
        ),
        actions: [
          if (p.messages.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              tooltip: 'Chat-Verlauf löschen',
              onPressed: () => p.clear(),
            ),
        ],
      ),
      body: Column(
        children: [
          // Chat-Bubble-Liste
          Expanded(
            child: p.messages.isEmpty && !p.isLoading
                ? _buildEmptyState()
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
          _buildInputBar(p.isLoading),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.auto_awesome,
                size: 48, color: AppColors.primary),
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
              'Dein persönlicher Assistent für Wetter, Luftqualität, Abfallkalender und mehr.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Frag mich etwas!',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary.withOpacity(0.7),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage message) {
    final isUser = message.role == ChatRole.user;

    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 40 : 0,
        right: isUser ? 0 : 40,
        bottom: 8,
      ),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
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
              child: const Icon(Icons.auto_awesome,
                  color: AppColors.primary, size: 14),
            ),
          // Bubble
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
              child: Text(
                message.content,
                style: TextStyle(
                  fontSize: 14,
                  color: isUser ? Colors.white : AppColors.textPrimary,
                  height: 1.4,
                ),
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
              child: const Icon(Icons.person, color: Colors.white, size: 14),
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
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.auto_awesome,
                color: AppColors.primary, size: 14),
          ),
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

  Widget _buildInputBar(bool isLoading) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(
          top: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _textController,
                enabled: !isLoading,
                textInputAction: TextInputAction.send,
                onSubmitted: isLoading ? null : (_) => _sendMessage(),
                decoration: InputDecoration(
                  hintText: isLoading ? 'Antwort wird erstellt …' : 'Nachricht',
                  hintStyle: TextStyle(
                    color: AppColors.textSecondary.withOpacity(0.6),
                    fontSize: 14,
                  ),
                  filled: true,
                  fillColor: AppColors.surface,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                color: isLoading
                    ? AppColors.textSecondary.withOpacity(0.3)
                    : AppColors.primary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: IconButton(
                icon: isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded,
                        color: Colors.white, size: 20),
                onPressed: isLoading ? null : _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
