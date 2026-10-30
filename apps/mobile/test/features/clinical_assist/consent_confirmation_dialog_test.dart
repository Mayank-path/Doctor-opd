import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/widgets/consent_confirmation_dialog.dart';

void main() {
  final samplePatient = Patient(
    id: 'p1111111-1111-1111-1111-111111111111',
    clinicId: 'c1111111-1111-1111-1111-111111111111',
    uhid: 'UHID-000042',
    fullName: 'Sunita Devi',
    gender: 'FEMALE',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  Widget createTestWidget(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => ConsentConfirmationDialog.show(context, patient: samplePatient),
            child: const Text('Open Consent'),
          ),
        ),
      ),
    );
  }

  group('ConsentConfirmationDialog Tests', () {
    testWidgets('renders patient identity and required consent points', (tester) async {
      await tester.pumpWidget(createTestWidget(Container()));
      await tester.tap(find.text('Open Consent'));
      await tester.pumpAndSettle();

      expect(find.text('Patient Consent Required'), findsOneWidget);
      expect(find.textContaining('Sunita Devi (UHID-000042)'), findsOneWidget);
      expect(find.textContaining('Cloud Processing'), findsOneWidget);
      expect(find.textContaining('Clinician Review'), findsOneWidget);
      expect(find.textContaining('Ephemeral Audio'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Confirm & Proceed'), findsOneWidget);
    });

    testWidgets('returns false when Cancel is tapped', (tester) async {
      bool? result;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await ConsentConfirmationDialog.show(context, patient: samplePatient);
              },
              child: const Text('Open Consent'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open Consent'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(result, false);
      expect(find.byType(ConsentConfirmationDialog), findsNothing);
    });

    testWidgets('returns true when Confirm & Proceed is tapped', (tester) async {
      bool? result;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await ConsentConfirmationDialog.show(context, patient: samplePatient);
              },
              child: const Text('Open Consent'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open Consent'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Confirm & Proceed'));
      await tester.pumpAndSettle();

      expect(result, true);
      expect(find.byType(ConsentConfirmationDialog), findsNothing);
    });
  });
}
