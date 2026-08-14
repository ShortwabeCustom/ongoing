/**
 * UPLOAD EVIDENCE TO R2 & UPDATE DATABASE
 *
 * 1. Sube las 6 imágenes SVG a Cloudflare R2
 * 2. Genera signed URLs
 * 3. Actualiza los Evidence records en BD con URLs reales
 */

import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://pruebas-maria.r2.cloudflarestorage.com';
const S3_BUCKET = process.env.S3_BUCKET || 'pruebas-maria-evidence';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_SIGNED_URL_EXPIRY = parseInt(process.env.S3_SIGNED_URL_EXPIRY || '86400'); // 24h

// Evidence data with finding IDs
const EVIDENCE_MAP: Record<
  string,
  {
    num: number;
    findingId: string;
    filename: string;
    filepath: string;
    mimeType: string;
  }
> = {
  '8abab28e80b9fbcf2d5b5585b8d159b8ed5f973aeb0891f90f0a0d1f09976d2e': {
    num: 1,
    findingId: '22ab16c0-75ee-4478-93fd-430603ff91b8',
    filename: 'evidence-1.svg',
    filepath: './public/evidence-placeholder/evidence-1.svg',
    mimeType: 'image/svg+xml',
  },
  '33e39cdbd19f6f3cf585d6e91171249edd103dc04ad206eaa1039216ab0c6702': {
    num: 2,
    findingId: '05362ed9-a982-48b8-9cec-e7fdc4332762',
    filename: 'evidence-2.svg',
    filepath: './public/evidence-placeholder/evidence-2.svg',
    mimeType: 'image/svg+xml',
  },
  '5c4c348dde8e2aad134465afe69f4ec63f7379d4d84c27309ee2f462853ab7f0': {
    num: 3,
    findingId: '87308251-b868-47e1-9402-57984cd8fa4b',
    filename: 'evidence-3.svg',
    filepath: './public/evidence-placeholder/evidence-3.svg',
    mimeType: 'image/svg+xml',
  },
  '1fb5152c50d5c22d2fab5f7d21460b647d840fa0f305cc9346d554fdc70cfe5b': {
    num: 4,
    findingId: 'a69e2a09-d51c-4092-840b-92010d6ebce7',
    filename: 'evidence-4.svg',
    filepath: './public/evidence-placeholder/evidence-4.svg',
    mimeType: 'image/svg+xml',
  },
  '60eb68e696f8cb9b74bf9f58c83f39465636ea92df09d479d5bd912db814875e': {
    num: 5,
    findingId: '43f79c3f-9aa7-4b16-8267-9317cdf40b85',
    filename: 'evidence-5.svg',
    filepath: './public/evidence-placeholder/evidence-5.svg',
    mimeType: 'image/svg+xml',
  },
  '242148c78c71c6002564b776e2f86994af37b78b7ed9ecb9e7a62ee3066d6624': {
    num: 6,
    findingId: '2b9477ca-c239-45e9-84a2-4105f55ed8df',
    filename: 'evidence-6.svg',
    filepath: './public/evidence-placeholder/evidence-6.svg',
    mimeType: 'image/svg+xml',
  },
};

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg: string, err?: any) => {
  console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
  if (err) console.error(err);
};

async function initializeS3Client() {
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

async function uploadFileToR2(
  s3Client: S3Client,
  filePath: string,
  key: string,
  mimeType: string,
): Promise<string> {
  try {
    const fileContent = fs.readFileSync(filePath);

    const putCommand = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: mimeType,
    });

    await s3Client.send(putCommand);
    log(`✅ Uploaded to R2: ${key}`);

    // Generate signed URL
    const signedUrl = await getSignedUrl(s3Client, new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }), { expiresIn: S3_SIGNED_URL_EXPIRY });

    return signedUrl.split('?')[0]; // Return base URL without signature
  } catch (err) {
    logError(`Failed to upload ${filePath}`, err);
    throw err;
  }
}

async function main() {
  log('🚀 UPLOAD EVIDENCE TO R2 & UPDATE DATABASE\n');

  // Check environment
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    logError('R2 credentials not configured. Please set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
    log('\n💡 Tip: These should be in your .env.local or environment');
    process.exit(1);
  }

  // Initialize clients
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logError('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const s3Client = await initializeS3Client();

  log(`📦 R2 Bucket: ${S3_BUCKET}`);
  log(`🔑 Endpoint: ${S3_ENDPOINT}\n`);

  // Upload files and update database
  const results: Array<{
    num: number;
    findingId: string;
    action: 'UPLOADED' | 'SKIPPED' | 'ERROR';
    reason?: string;
    url?: string;
  }> = [];

  for (const [fingerprint, data] of Object.entries(EVIDENCE_MAP)) {
    try {
      const filePath = path.resolve(data.filepath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        log(`⚠️  SKIPPED #${data.num}: File not found at ${data.filepath}`);
        results.push({
          num: data.num,
          findingId: data.findingId,
          action: 'SKIPPED',
          reason: 'File not found',
        });
        continue;
      }

      // Upload to R2
      const storageKey = `findings/${data.findingId}/${data.filename}`;
      const publicUrl = await uploadFileToR2(s3Client, filePath, storageKey, data.mimeType);

      // Update Evidence record in database
      const updated = await prisma.evidence.update({
        where: {
          findingId: data.findingId,
        },
        data: {
          url: publicUrl,
          fileSize: fs.statSync(filePath).size,
        },
      });

      log(`✅ EVIDENCE #${data.num} UPDATED`);
      log(`   Finding: ${data.findingId}`);
      log(`   URL: ${publicUrl.substring(0, 60)}...\n`);

      results.push({
        num: data.num,
        findingId: data.findingId,
        action: 'UPLOADED',
        url: publicUrl,
      });
    } catch (err) {
      logError(`Failed to process evidence #${data.num}`, err);
      results.push({
        num: data.num,
        findingId: data.findingId,
        action: 'ERROR',
        reason: String(err),
      });
    }
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log(`✅ UPLOADED: ${results.filter((r) => r.action === 'UPLOADED').length}`);
  console.log(`⚠️  SKIPPED: ${results.filter((r) => r.action === 'SKIPPED').length}`);
  console.log(`❌ ERROR: ${results.filter((r) => r.action === 'ERROR').length}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    r2Bucket: S3_BUCKET,
    r2Endpoint: S3_ENDPOINT,
    filesUploaded: results.filter((r) => r.action === 'UPLOADED').length,
    results,
  };

  fs.writeFileSync(
    path.join(__dirname, `r2-upload-${Date.now()}.json`),
    JSON.stringify(report, null, 2),
  );

  log(`\n📄 Report saved: r2-upload-${Date.now()}.json`);

  await prisma.$disconnect();
  await s3Client.destroy();
}

main().catch((err) => {
  logError('Fatal error', err);
  process.exit(1);
});
