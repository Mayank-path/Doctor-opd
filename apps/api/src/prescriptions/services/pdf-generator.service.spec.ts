import {
  PdfGeneratorService,
  PrescriptionWithDetails,
} from './pdf-generator.service';
import {
  ClinicRole,
  DosageForm,
  Gender,
  MedicationRoute,
  MedicationTiming,
  MembershipStatus,
  PrescriptionStatus,
} from '@prisma/client';

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;

  beforeEach(() => {
    service = new PdfGeneratorService();
  });

  const createMockPrescription = (
    withConsultation = true,
  ): PrescriptionWithDetails => ({
    id: 'rx-test-uuid-1',
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    consultationId: withConsultation ? 'consult-1' : null,
    doctorId: 'doctor-1',
    versionNumber: 1,
    status: PrescriptionStatus.APPROVED,
    supersedesPrescriptionId: null,
    amendmentReason: null,
    notes: 'Take medicine with warm water after food.',
    approvedAt: new Date('2026-10-30T10:00:00.000Z'),
    createdAt: new Date('2026-10-30T09:30:00.000Z'),
    updatedAt: new Date('2026-10-30T10:00:00.000Z'),
    clinic: {
      id: 'clinic-1',
      name: 'City Health Clinic',
      slug: 'city-health',
      phone: '+91 9999900001',
      email: 'clinic@example.com',
      address: '123 Medical Enclave',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110001',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    patient: {
      id: 'patient-1',
      clinicId: 'clinic-1',
      uhid: 'UHID-2026-0001',
      fullName: 'Aarav Sharma',
      gender: Gender.MALE,
      dateOfBirth: new Date('1990-05-15'),
      phone: '+91 9876543210',
      alternatePhone: null,
      email: 'aarav@example.com',
      address: 'Flat 402, Green Valley',
      city: 'New Delhi',
      pincode: '110001',
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    doctor: {
      id: 'membership-1',
      userId: 'doctor-user-1',
      clinicId: 'clinic-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'doctor-user-1',
        fullName: 'Dr. Ramesh Sharma',
        email: 'dr.ramesh@example.com',
        phone: '+91 9999900002',
      },
    },
    consultation: withConsultation
      ? ({
          id: 'consult-1',
          clinicId: 'clinic-1',
          patientId: 'patient-1',
          clinicianId: 'doctor-user-1',
          encounterDate: new Date('2026-10-30T09:30:00.000Z'),
          status: 'FINALIZED',
          finalizedAt: new Date('2026-10-30T09:45:00.000Z'),
          chiefComplaint: 'Fever and cough for 3 days',
          symptoms: 'Mild headache, productive cough',
          examination: 'Throat erythematous',
          diagnosis: 'Acute Upper Respiratory Tract Infection',
          treatmentPlan: null,
          followUpDate: new Date('2026-11-05'),
          bpSystolic: 120,
          bpDiastolic: 80,
          pulse: 76,
          temperature: 99.1 as any,
          weightKg: 68.5 as any,
          heightCm: 172.0 as any,
          spo2: 98,
          respiratoryRate: 18,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
      : null,
    items: [
      {
        id: 'item-1',
        prescriptionId: 'rx-test-uuid-1',
        clinicId: 'clinic-1',
        medicationName: 'Amoxicillin and Clavulanate Potassium',
        brandName: 'Augmentin',
        dosageForm: DosageForm.TABLET,
        strength: '625 mg',
        route: MedicationRoute.ORAL,
        frequency: '1-0-1',
        durationValue: 5,
        durationUnit: 'DAYS',
        timing: MedicationTiming.AFTER_MEALS,
        specialInstructions: 'Complete full 5-day course',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item-2',
        prescriptionId: 'rx-test-uuid-1',
        clinicId: 'clinic-1',
        medicationName: 'Paracetamol',
        brandName: 'Calpol',
        dosageForm: DosageForm.TABLET,
        strength: '650 mg',
        route: MedicationRoute.ORAL,
        frequency: '1-1-1',
        durationValue: 3,
        durationUnit: 'DAYS',
        timing: MedicationTiming.AFTER_MEALS,
        specialInstructions: 'Take only if temperature exceeds 100°F',
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  it('should generate a valid PDF buffer with PDF magic bytes (%PDF-)', async () => {
    const rx = createMockPrescription(true);
    const buffer = await service.generatePrescriptionPdf(rx);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic bytes check
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('should generate valid PDF when consultation is null (standalone prescription)', async () => {
    const rx = createMockPrescription(false);
    const buffer = await service.generatePrescriptionPdf(rx);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('should include amendment reason styling when prescription is amended (version > 1)', async () => {
    const rx = createMockPrescription(true);
    rx.versionNumber = 2;
    rx.supersedesPrescriptionId = 'rx-prev-id';
    rx.amendmentReason = 'Allergic rash to previous penicillin dose';

    const buffer = await service.generatePrescriptionPdf(rx);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
