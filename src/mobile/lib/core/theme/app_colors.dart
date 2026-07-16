import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF2E7D32);
  static const Color primaryLight = Color(0xFF4CAF50);
  static const Color primaryDark = Color(0xFF1B5E20);

  static const Color secondary = Color(0xFFFF6D00);
  static const Color secondaryLight = Color(0xFFFF9E40);

  static const Color surface = Color(0xFFF8F9FA);
  static const Color card = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE5E7EB);

  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  static const Color success = Color(0xFF16A34A);
  static const Color error = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);

  // Haltestellen-Typfarben
  static const Color bus = Color(0xFF16A34A);
  static const Color subway = Color(0xFF2563EB);
  static const Color train = Color(0xFFFF6D00);
  static const Color tram = Color(0xFF9333EA);

  static Color stopColor(String type) => switch (type) {
        'bus' => bus,
        'subway' => subway,
        'train' => train,
        'tram' => tram,
        _ => primary,
      };
}
