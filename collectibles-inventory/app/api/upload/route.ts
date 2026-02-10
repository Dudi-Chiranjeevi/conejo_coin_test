import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'coenjocoins_inventory';
const bucket = storage.bucket(bucketName);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const metadata = JSON.parse(formData.get('metadata') as string || '{}');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${type}_${timestamp}.${fileExtension}`;
    const filePath = `uploads/${fileName}`;

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload the file to GCS
    const blob = bucket.file(filePath);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          type,
          uploadDate: new Date().toISOString(),
          ...metadata,
        },
      },
      resumable: false,
    });

    // Handle the upload process
    await new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        console.error('Upload error:', error);
        reject(new Error('Upload failed'));
      });

      blobStream.on('finish', async () => {
        // Make the file public
        await blob.makePublic();
        resolve(blob);
      });

      blobStream.end(buffer);
    });

    // Generate public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      thumbnailUrl: publicUrl, // In a real app, you would generate a thumbnail
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  // Handle preflight requests for CORS
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
