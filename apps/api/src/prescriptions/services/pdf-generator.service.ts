import { Injectable } from '@nestjs/common';
import {
  Clinic,
  ClinicMembership,
  Consultation,
  Patient,
  Prescription,
  PrescriptionItem,
  User,
} from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helveticaFonts = require('pdfmake/standard-fonts/Helvetica');

export type PrescriptionWithDetails = Prescription & {
  clinic: Clinic;
  patient: Patient;
  doctor: ClinicMembership & {
    user: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  };
  consultation?: Consultation | null;
  items: PrescriptionItem[];
};

@Injectable()
export class PdfGeneratorService {
  constructor() {
    pdfmake.setFonts(helveticaFonts);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(() => true);
  }

  /**
   * Generates a PDF buffer for an approved prescription using verified database records.
   */
  async generatePrescriptionPdf(
    prescription: PrescriptionWithDetails,
  ): Promise<Buffer> {
    const docDefinition = this.buildDocumentDefinition(prescription);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }

  private buildDocumentDefinition(prescription: PrescriptionWithDetails) {
    const { clinic, patient, doctor, consultation, items } = prescription;

    const dateStr = (prescription.approvedAt ?? prescription.createdAt)
      .toISOString()
      .split('T')[0];

    // Compute patient age
    let patientAgeStr = 'N/A';
    if (patient.dateOfBirth) {
      const birth = new Date(patient.dateOfBirth);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
      patientAgeStr = `${age} yrs`;
    }

    const content: any[] = [];

    // 1. Clinic Header
    content.push({
      columns: [
        {
          width: '*',
          stack: [
            { text: clinic.name.toUpperCase(), style: 'clinicName' },
            {
              text: [
                clinic.address ? `${clinic.address}, ` : '',
                clinic.city ? `${clinic.city}, ` : '',
                clinic.state ? `${clinic.state} ` : '',
                clinic.postalCode ? `- ${clinic.postalCode}` : '',
              ]
                .filter(Boolean)
                .join(''),
              style: 'clinicSub',
            },
            {
              text: [
                clinic.phone ? `Phone: ${clinic.phone}  ` : '',
                clinic.email ? `Email: ${clinic.email}` : '',
              ]
                .filter(Boolean)
                .join(''),
              style: 'clinicSub',
            },
          ],
        },
        {
          width: 'auto',
          stack: [
            { text: 'OPD PRESCRIPTION', style: 'docTypeTitle' },
            { text: `Date: ${dateStr}`, style: 'docDate' },
            {
              text: `Version: ${prescription.versionNumber}${
                prescription.supersedesPrescriptionId ? ' (Amended)' : ''
              }`,
              style: 'docMeta',
            },
            { text: `Status: ${prescription.status}`, style: 'docMeta' },
          ],
          alignment: 'right',
        },
      ],
    });

    content.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 10,
          x2: 515,
          y2: 10,
          lineWidth: 1.5,
          lineColor: '#1a5f7a',
        },
      ],
      margin: [0, 0, 0, 10],
    });

    // 2. Patient Demographics Banner
    content.push({
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            { text: 'Patient Name:', style: 'labelBold' },
            { text: patient.fullName, style: 'valueText' },
            { text: 'UHID:', style: 'labelBold' },
            { text: patient.uhid, style: 'valueText' },
          ],
          [
            { text: 'Age / Gender:', style: 'labelBold' },
            {
              text: `${patientAgeStr} / ${patient.gender}`,
              style: 'valueText',
            },
            { text: 'Phone:', style: 'labelBold' },
            { text: patient.phone || 'N/A', style: 'valueText' },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 10],
    });

    // 3. Consultation Context & Vitals (if linked)
    if (consultation) {
      const vitalsText: string[] = [];
      if (consultation.bpSystolic && consultation.bpDiastolic) {
        vitalsText.push(
          `BP: ${consultation.bpSystolic}/${consultation.bpDiastolic} mmHg`,
        );
      }
      if (consultation.pulse)
        vitalsText.push(`Pulse: ${consultation.pulse} bpm`);
      if (consultation.temperature)
        vitalsText.push(`Temp: ${consultation.temperature} °F`);
      if (consultation.spo2) vitalsText.push(`SpO2: ${consultation.spo2}%`);
      if (consultation.weightKg)
        vitalsText.push(`Weight: ${consultation.weightKg} kg`);

      const consultationStack: any[] = [];
      if (consultation.chiefComplaint) {
        consultationStack.push({
          text: [
            { text: 'Chief Complaint: ', bold: true },
            { text: consultation.chiefComplaint },
          ],
          fontSize: 10,
        });
      }
      if (consultation.diagnosis) {
        consultationStack.push({
          text: [
            { text: 'Diagnosis / Indication: ', bold: true },
            { text: consultation.diagnosis },
          ],
          fontSize: 10,
          margin: [0, 2, 0, 0],
        });
      }
      if (vitalsText.length > 0) {
        consultationStack.push({
          text: [
            { text: 'Vitals: ', bold: true },
            { text: vitalsText.join(' | ') },
          ],
          fontSize: 9,
          color: '#4a4a4a',
          margin: [0, 2, 0, 0],
        });
      }

      if (consultationStack.length > 0) {
        content.push({
          table: {
            widths: ['100%'],
            body: [
              [
                {
                  fillColor: '#f7f9fa',
                  stack: consultationStack,
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dce2e6',
            vLineColor: () => '#dce2e6',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 0, 0, 12],
        });
      }
    }

    // 4. Rx Medications Section
    const tableBody: any[] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'Medicine & Strength', style: 'tableHeader' },
        { text: 'Form / Route', style: 'tableHeader' },
        { text: 'Frequency', style: 'tableHeader', alignment: 'center' },
        { text: 'Duration', style: 'tableHeader', alignment: 'center' },
        { text: 'Timing & Advice', style: 'tableHeader' },
      ],
    ];

    items.forEach((item, index) => {
      const medTitle = item.brandName
        ? `${item.brandName} (${item.medicationName})`
        : item.medicationName;

      const timingText = item.timing.replace(/_/g, ' ');
      const instructions = item.specialInstructions
        ? `${timingText} - ${item.specialInstructions}`
        : timingText;

      tableBody.push([
        { text: `${index + 1}`, alignment: 'center', style: 'tableCell' },
        {
          text: [
            { text: medTitle, bold: true },
            { text: ` - ${item.strength}`, color: '#2b2b2b' },
          ],
          style: 'tableCell',
        },
        {
          text: `${item.dosageForm} (${item.route})`,
          style: 'tableCell',
        },
        { text: item.frequency, alignment: 'center', style: 'tableCell' },
        {
          text: `${item.durationValue} ${item.durationUnit.toLowerCase()}`,
          alignment: 'center',
          style: 'tableCell',
        },
        { text: instructions, style: 'tableCell' },
      ]);
    });

    content.push(
      {
        text: 'Rx (Prescription)',
        style: 'rxHeader',
        margin: [0, 4, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ['5%', '33%', '18%', '14%', '12%', '18%'],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0
              ? '#1a5f7a'
              : rowIndex % 2 === 0
                ? '#fcfcfc'
                : '#ffffff',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e0e0e0',
          vLineColor: () => '#e0e0e0',
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 15],
      },
    );

    // 5. Notes & Advice
    if (prescription.notes) {
      content.push({
        stack: [
          { text: 'Advice & Instructions:', bold: true, fontSize: 10 },
          { text: prescription.notes, fontSize: 9.5, margin: [0, 2, 0, 10] },
        ],
      });
    }

    if (prescription.amendmentReason) {
      content.push({
        stack: [
          {
            text: `Amendment Reason (v${prescription.versionNumber}):`,
            bold: true,
            fontSize: 9,
            color: '#c0392b',
          },
          {
            text: prescription.amendmentReason,
            fontSize: 8.5,
            color: '#7f1d1d',
            margin: [0, 1, 0, 8],
          },
        ],
      });
    }

    // 6. Doctor Signature & Disclaimer
    content.push({
      columns: [
        {
          width: '*',
          text: 'This is a digitally generated medical prescription approved by the licensed attending doctor.',
          fontSize: 8,
          color: '#777777',
          margin: [0, 25, 0, 0],
        },
        {
          width: '40%',
          alignment: 'right',
          stack: [
            {
              canvas: [
                {
                  type: 'line',
                  x1: 0,
                  y1: 0,
                  x2: 160,
                  y2: 0,
                  lineWidth: 0.8,
                  lineColor: '#666666',
                },
              ],
              margin: [0, 20, 0, 4],
            },
            { text: doctor.user.fullName, bold: true, fontSize: 11 },
            {
              text: `Attending Doctor (${doctor.role})`,
              fontSize: 9,
              color: '#444444',
            },
            {
              text: prescription.approvedAt
                ? `Digitally Approved: ${prescription.approvedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC`
                : 'DRAFT - NOT FINALIZED',
              fontSize: 8,
              color: prescription.approvedAt ? '#1a5f7a' : '#d9534f',
            },
          ],
        },
      ],
    });

    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content,
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9.5,
        lineHeight: 1.2,
      },
      styles: {
        clinicName: {
          fontSize: 15,
          bold: true,
          color: '#1a5f7a',
        },
        clinicSub: {
          fontSize: 8.5,
          color: '#555555',
          margin: [0, 1, 0, 0],
        },
        docTypeTitle: {
          fontSize: 13,
          bold: true,
          color: '#1a5f7a',
        },
        docDate: {
          fontSize: 9.5,
          color: '#333333',
        },
        docMeta: {
          fontSize: 8.5,
          color: '#666666',
        },
        labelBold: {
          fontSize: 9.5,
          bold: true,
          color: '#222222',
        },
        valueText: {
          fontSize: 9.5,
          color: '#333333',
        },
        rxHeader: {
          fontSize: 12,
          bold: true,
          color: '#1a5f7a',
        },
        tableHeader: {
          fontSize: 9,
          bold: true,
          color: '#ffffff',
        },
        tableCell: {
          fontSize: 8.5,
          color: '#222222',
        },
      },
    };
  }
}
