export type ConditionGrade = 'excellent' | 'good' | 'fair' | 'damaged' | 'missing_parts';

export interface ConditionReport {
  id: string;
  bookingId: string;
  resourceId: string;
  inspectorId: string;
  inspectorName: string;
  stage: 'checkout' | 'return';
  grade: ConditionGrade;
  notes: string;
  reportedDamage?: string[];
  photoUrls?: string[];
  createdAt: string;
}
