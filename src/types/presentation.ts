import { Timestamp } from 'firebase/firestore';

export type Presentation = {
  doctorId: string;
  city: string; // District
  pdfUrl?: string;
  updatedAt: Timestamp;
  updatedBy: string;
  dirty: boolean;
  error?: string;
};

export type PresentationWithId = Presentation & { id: string };

export type EnrichedPresentation = PresentationWithId & {
  doctorName?: string;
  doctorCity?: string; // SubCity
  doctorDistrict?: string;
  doctorSlides?: number[];
  status: 'ready' | 'pending' | 'failed' | 'generating' | 'unknown';
};
