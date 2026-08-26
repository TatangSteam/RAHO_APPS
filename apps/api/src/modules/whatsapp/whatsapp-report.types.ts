export interface SessionReportSnapshot {
  templateVersion: 1;
  sessionId: string;
  sessionCode: string;
  member: { displayName: string };
  session: {
    infusionNumber: number;
    date: string;
    branchName: string;
  };
  infusion: Record<string, string>;
  vitals: {
    before: Record<string, string>;
    after: Record<string, string>;
  };
  recommendation?: string;
  notes?: string;
  nextVisit?: string;
  photo: { allowed: boolean; sourcePhotoId?: string };
}
