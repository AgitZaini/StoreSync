export type FilePurpose =
  | "ATTENDANCE_PHOTO"
  | "CASHIER_PHOTO"
  | "DOCTOR_NOTE"
  | "RETURN_PHOTO"
  | "STOCK_OPNAME_EVIDENCE"
  | "VISIT_EVIDENCE"
  | "MOU_SIGNATURE"
  | "MOU_SIGNER_PHOTO"
  | "MOU_DOCUMENT";

export type StoredFile = {
  id: string;
  key: string;
  purpose: FilePurpose;
  mimeType: string;
  size: number;
  status: "PENDING" | "UPLOADED";
  createdAt: string;
  uploadedAt: string | null;
};

export type PresignResponse = {
  file: StoredFile;
  upload: { method: "PUT"; url: string; headers: Record<string, string> };
};
