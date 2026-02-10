import { useState } from 'react';
import { gcsUploader } from '../lib/gcs-upload';

export type UploadedFile = {
  url: string;
  type: 'front' | 'rear' | 'other';
  file: File;
  thumbnailUrl?: string;
};

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const uploadFile = async (file: File, itemId: string, type: 'front' | 'rear' | 'other' = 'other', certNumber?: string) => {
    if (!file) return null;

    setIsUploading(true);
    setError(null);

    try {
      const result = await gcsUploader.uploadFile(file, itemId, type, {
        originalName: file.name,
        size: file.size.toString(),
        type: file.type,
      }, certNumber);

      const uploadedFile: UploadedFile = {
        url: result.url,
        type,
        file,
        thumbnailUrl: result.thumbnailUrl,
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);
      return uploadedFile;
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setError(null);
  };

  return {
    uploadFile,
    removeFile,
    clearFiles,
    isUploading,
    uploadProgress,
    error,
    uploadedFiles,
    hasFiles: uploadedFiles.length > 0,
    frontImage: uploadedFiles.find(f => f.type === 'front')?.url,
    rearImage: uploadedFiles.find(f => f.type === 'rear')?.url,
  };
};
