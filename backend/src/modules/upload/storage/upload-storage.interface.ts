export type StoredFileResult = {
  filename: string;
  size: number;
  path: string;
};

export interface UploadStorage {
  saveImage(file: Express.Multer.File): Promise<StoredFileResult>;
}

