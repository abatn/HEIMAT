import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/main.dart';

void main() {
  testWidgets('App should render', (WidgetTester tester) async {
    await tester.pumpWidget(const HeimatApp());
    expect(find.text('Mobilität'), findsOneWidget);
  });
}
