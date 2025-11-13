export const photoPath = (jobId: string, checklistId: string | null, filename: string) =>
  `photos/${jobId}/${checklistId ?? 'general'}/${filename}`;

export const signaturePath = (jobId: string, signer: 'plumber' | 'client') =>
  `signatures/${jobId}/${signer}.png`;

export const reportPath = (jobId: string) => `reports/${jobId}.pdf`;
