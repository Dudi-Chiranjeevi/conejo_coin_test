// Using dynamic import for browser compatibility
let Storage: any;

// Only import on server-side
if (typeof window === 'undefined') {
  import('@google-cloud/storage').then((gcs) => {
    Storage = gcs.Storage;
  });
}

export interface GCSConfig {
  projectId: string;
  bucketName: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

class GCSUploader {
  private storage: any;
  private bucketName: string;
  private basePath = 'NGCImages';
  private isInitialized = false;

  constructor(config: GCSConfig) {
    if (typeof window === 'undefined') {
      // Server-side initialization
      this.storage = new Storage({
        projectId: config.projectId,
        credentials: {
          client_email: config.credentials.client_email,
          private_key: config.credentials.private_key,
        },
      });
      this.bucketName = config.bucketName;
      this.isInitialized = true;
    } else {
      // Client-side - we'll use a fallback or API route
      this.bucketName = config.bucketName;
    }
  }

  async uploadFile(
    file: File,
    itemId: string,
    type: 'front' | 'rear' | 'other' = 'other',
    metadata: Record<string, string> = {},
    certNumber?: string
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    // If running in the browser, use an API route for upload
    if (typeof window !== 'undefined') {
      return this.uploadViaAPI(file, itemId, type, metadata);
    }

    // Server-side upload
    if (!this.isInitialized) {
      throw new Error('GCS Uploader not initialized');
    }

    try {
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${type === 'front' ? 'OBV' : 'REV'}.${fileExtension}`;
      const baseDir = certNumber || itemId;
      const filePath = `${this.basePath}/${baseDir}/${fileName}`;
      
      const bucket = this.storage.bucket(this.bucketName);
      const blob = bucket.file(filePath);
      
      // Create a write stream to upload the file
      const stream = blob.createWriteStream({
        metadata: {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            itemId,
            uploadDate: new Date().toISOString(),
            ...metadata
          },
        },
        resumable: false,
      });

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload the file
      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(buffer);
      });

      // Make the file public
      await blob.makePublic();

      // Generate public URL in the format expected by the frontend
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${this.basePath}/${baseDir}/NGC${baseDir}_${type === 'front' ? 'OBV' : 'REV'}.${fileExtension}`;

      return {
        url: publicUrl,
      };
    } catch (error) {
      console.error('Error uploading to GCS:', error);
      throw new Error('Failed to upload file to GCS');
    }
  }

  // Method to handle uploads via API route when in the browser
  private async uploadViaAPI(
    file: File,
    itemId: string,
    type: 'front' | 'rear' | 'other',
    metadata: Record<string, string>
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('itemId', itemId);
    formData.append('type', type);
    formData.append('metadata', JSON.stringify(metadata));

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return {
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  // Add more methods as needed (e.g., delete, getSignedUrl, etc.)
}

// Example configuration - replace with your actual GCS config
const gcsConfig: GCSConfig = {
  projectId: process.env.NEXT_PUBLIC_GCS_PROJECT_ID || 'your-project-id',
  bucketName: 'coenjocoins_inventory',
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL || '',
    private_key: (process.env.GCS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

export const gcsUploader = new GCSUploader(gcsConfig);
