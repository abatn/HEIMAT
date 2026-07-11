import { healthService } from '../services/healthService';

describe('HealthService', () => {
  describe('searchDoctors', () => {
    it('should return all doctors when no filter is applied', async () => {
      const doctors = await healthService.searchDoctors();
      expect(doctors.length).toBeGreaterThan(0);
    });

    it('should filter doctors by specialty', async () => {
      const doctors = await healthService.searchDoctors('Allgemeinmedizin');
      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach(doc => {
        expect(doc.specialty).toContain('Allgemeinmedizin');
      });
    });
  });

  describe('getDoctorById', () => {
    it('should return a doctor by id', async () => {
      const doctor = await healthService.getDoctorById('doc1');
      expect(doctor).toBeDefined();
      expect(doctor.id).toBe('doc1');
    });

    it('should throw error for non-existent doctor', async () => {
      await expect(healthService.getDoctorById('nonexistent'))
        .rejects.toThrow('Doctor not found');
    });
  });

  describe('bookAppointment', () => {
    it('should book an appointment successfully', async () => {
      const appointment = await healthService.bookAppointment(
        'doc1',
        'Test Patient',
        '2024-02-20',
        '09:00'
      );
      expect(appointment).toBeDefined();
      expect(appointment.status).toBe('pending');
    });

    it('should throw error for unavailable slot', async () => {
      await expect(healthService.bookAppointment(
        'doc1',
        'Test Patient',
        '2024-02-20',
        '99:99'
      )).rejects.toThrow('This time slot is not available');
    });
  });
});
