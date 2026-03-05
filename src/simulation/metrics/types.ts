export type MandateFailureStats = {
  failuresByMandate: Record<string, number>;
  successesByMandate: Record<string, number>;
};

export type MandateFailureDistribution = {
  mandateId: string;
  failureRate: number;
  successRate: number;
  attempts: number;
};
