import { Timestamp } from 'firebase/firestore';

export type Doctor = {
  name: string;
  city: string;
  subCity?: string;
  selectedSlides: number[];
};

export type DoctorWithId = Doctor & { id: string };

/**
 * Type for creating a new doctor.
 * Explicitly does not include 'id' or other DB-calculated fields.
 */
export type CreateDoctorInput = Doctor;

/**
 * Type for updating an existing doctor.
 */
export type UpdateDoctorInput = Partial<Doctor>;
