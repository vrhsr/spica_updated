import { Timestamp } from 'firebase/firestore';

export type Request = {
  status: 'pending' | 'approved' | 'rejected';
  repId: string;
  doctorId: string;
  createdAt: Timestamp;
  // Optional fields for history/context
  repName?: string;
  doctorName?: string;
  notes?: string;
};

export type RequestWithId = Request & { id: string };
