import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

export const runtime = "nodejs";

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucketName =
  process.env.GOOGLE_CLOUD_BUCKET_NAME || "coenjocoins_inventory";
const bucket = storage.bucket(bucketName);

type SyncRequestBody = {
  certNumber: string;
  frontUrl?: string | null;
  rearUrl?: string | null;
};

function sanitizeCertNumber(certNumber: string): string {
  return certNumber
    .trim()
    .replace(/[\\/\\\\]/g, "-")
    .replace(/\.+/g, "-")
    .replace(/[^0-9A-Za-z-]/g, "");
}

async function downloadToBuffer(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download image: ${resp.status}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const contentType = resp.headers.get("content-type") || "image/jpeg";
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

async function uploadBuffer(params: {
  certNumber: string;
  filename: "front.jpg" | "rear.jpg";
  buffer: Buffer;
  contentType: string;
}) {
  const { certNumber, filename, buffer, contentType } = params;
  const filePath = `NGC_Coins/${certNumber}/${filename}`;

  const blob = bucket.file(filePath);
  const stream = blob.createWriteStream({
    metadata: { contentType },
    resumable: false,
  });

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    stream.end(buffer);
  });

  await blob.makePublic();

  return {
    path: filePath,
    url: `https://storage.googleapis.com/${bucketName}/${filePath}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncRequestBody;

    const certNumber = sanitizeCertNumber(body.certNumber || "");
    if (!certNumber) {
      return NextResponse.json({ error: "Missing certNumber" }, { status: 400 });
    }

    const frontUrl = (body.frontUrl || "").trim();
    const rearUrl = (body.rearUrl || "").trim();

    const results: {
      front?: { path: string; url: string };
      rear?: { path: string; url: string };
    } = {};

    if (frontUrl) {
      const { buffer, contentType } = await downloadToBuffer(frontUrl);
      results.front = await uploadBuffer({
        certNumber,
        filename: "front.jpg",
        buffer,
        contentType,
      });
    }

    if (rearUrl) {
      const { buffer, contentType } = await downloadToBuffer(rearUrl);
      results.rear = await uploadBuffer({
        certNumber,
        filename: "rear.jpg",
        buffer,
        contentType,
      });
    }

    return NextResponse.json({ success: true, certNumber, ...results });
  } catch (error) {
    console.error("NGC image sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync NGC images" },
      { status: 500 },
    );
  }
}
