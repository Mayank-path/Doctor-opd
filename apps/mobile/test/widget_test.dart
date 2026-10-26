import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/app.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';

class MockAuthService extends Mock implements AuthService {}

void main() {
  testWidgets('DoctorOpdApp renders LoginScreen when unauthenticated', (WidgetTester tester) async {
    final mockAuth = MockAuthService();
    when(() => mockAuth.isInitialized).thenReturn(true);
    when(() => mockAuth.isAuthenticated).thenReturn(false);
    when(() => mockAuth.isLoading).thenReturn(false);
    when(() => mockAuth.errorMessage).thenReturn(null);

    await tester.pumpWidget(DoctorOpdApp(authService: mockAuth));

    expect(find.text('DOCTOR-OPD'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
  });
}
