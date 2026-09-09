import 'package:flutter_test/flutter_test.dart';
import 'package:saji_app/main.dart';

void main() {
  testWidgets('App boots to login or shell', (WidgetTester tester) async {
    await tester.pumpWidget(const SajiApp());
    expect(find.byType(SajiApp), findsOneWidget);
  });
}
