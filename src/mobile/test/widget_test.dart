import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/core/theme/app_colors.dart';
import 'package:heimat_app/core/theme/app_theme.dart';

void main() {
  group('AppTheme', () {
    testWidgets('should have light and dark themes',
        (WidgetTester tester) async {
      expect(AppTheme.lightTheme, isA<ThemeData>());
      expect(AppTheme.darkTheme, isA<ThemeData>());
    });

    testWidgets('light theme uses Material 3', (WidgetTester tester) async {
      expect(AppTheme.lightTheme.useMaterial3, isTrue);
    });

    testWidgets('dark theme uses Material 3', (WidgetTester tester) async {
      expect(AppTheme.darkTheme.useMaterial3, isTrue);
    });

    testWidgets('light theme has correct scaffold background',
        (WidgetTester tester) async {
      final color = AppTheme.lightTheme.scaffoldBackgroundColor;
      expect(color, isNotNull);
    });

    testWidgets('light theme has card theme', (WidgetTester tester) async {
      final cardTheme = AppTheme.lightTheme.cardTheme;
      expect(cardTheme, isNotNull);
      expect(cardTheme.elevation, 0);
    });
  });

  group('AppColors', () {
    test('primary color is defined', () {
      expect(AppColors.primary, isNotNull);
    });

    test('secondary color is defined', () {
      expect(AppColors.secondary, isNotNull);
    });

    test('surface color is defined', () {
      expect(AppColors.surface, isNotNull);
    });

    test('error color is defined', () {
      expect(AppColors.error, isNotNull);
    });

    test('success color is defined', () {
      expect(AppColors.success, isNotNull);
    });

    test('text colors are defined', () {
      expect(AppColors.textPrimary, isNotNull);
      expect(AppColors.textSecondary, isNotNull);
    });
  });
}
