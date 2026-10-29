import { validateDoctorBootstrapDatabase } from './bootstrap-doctor';

describe('validateDoctorBootstrapDatabase', () => {
  it('should refuse execution if NODE_ENV is production', () => {
    expect(() =>
      validateDoctorBootstrapDatabase('doctor_opd_dev', {
        NODE_ENV: 'production',
      }),
    ).toThrow(
      'Direct CLI bootstrap execution is disabled in production environment.',
    );
  });

  it('should refuse execution if database target is not doctor_opd_dev', () => {
    expect(() =>
      validateDoctorBootstrapDatabase('doctor_opd_prod', {
        NODE_ENV: 'development',
      }),
    ).toThrow(
      'Bootstrap refused: Doctor bootstrap is strictly restricted to development database "doctor_opd_dev". Current target: "doctor_opd_prod".',
    );

    expect(() =>
      validateDoctorBootstrapDatabase('postgres', {
        NODE_ENV: 'development',
      }),
    ).toThrow(
      'Bootstrap refused: Doctor bootstrap is strictly restricted to development database "doctor_opd_dev". Current target: "postgres".',
    );
  });

  it('should accept execution when target is doctor_opd_dev in development environment', () => {
    expect(() =>
      validateDoctorBootstrapDatabase('doctor_opd_dev', {
        NODE_ENV: 'development',
      }),
    ).not.toThrow();
  });

  it('should accept execution when target is doctor_opd_dev in test environment', () => {
    expect(() =>
      validateDoctorBootstrapDatabase('doctor_opd_dev', {
        NODE_ENV: 'test',
      }),
    ).not.toThrow();
  });
});
