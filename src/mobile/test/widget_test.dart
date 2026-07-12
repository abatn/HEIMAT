import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/core/theme/app_theme.dart';

void main() {
  testWidgets('AppTheme should have light and dark themes', (WidgetTester tester) async {
    expect(AppTheme.lightTheme, isA<ThemeData>());
    expect(AppTheme.darkTheme, isA<ThemeData>());
  });

  testWidgets('AppTheme light theme uses Material 3', (WidgetTester tester) async {
    expect(AppTheme.lightTheme.useMaterial3, isTrue);
  });

  testWidgets('AppTheme dark theme uses Material 3', (WidgetTester tester) async {
    expect(AppTheme.darkTheme.useMaterial3, isTrue);
  });
}
