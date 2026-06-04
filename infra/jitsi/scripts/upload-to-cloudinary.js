#!/usr/bin/env node
/**
 * Uploads a Jibri recording to Cloudinary.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Optional: CLOUDINARY_UPLOAD_PRESET (unsigned), RECORDING_WEBHOOK_URL
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error('[upload] File not found:', filePath);
  process.exit(1);
}

const clean = (v) => (v || '').replace(/[\r\n]+/g, '').trim();
const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = clean(process.env.CLOUDINARY_API_KEY);
const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);
const uploadPreset = clean(process.env.CLOUDINARY_UPLOAD_PRESET);
const webhookUrl = clean(process.env.RECORDING_WEBHOOK_URL);

if (!cloudName) {
  console.error('[upload] CLOUDINARY_CLOUD_NAME required');
  process.exit(1);
}

function postForm(url, fields, fileField) {
  const boundary = '----JitsiUpload' + Date.now();
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
    );
  }

  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`
  );
  chunks.push(fileData);
  chunks.push(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c, 'utf8'))));

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${cloudName}/video/upload`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(data));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function signedUpload() {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp: String(timestamp) };
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(sorted + apiSecret).digest('hex');

  return postForm('', {
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  }, 'file');
}

async function main() {
  let result;
  if (uploadPreset) {
    result = await postForm('', { upload_preset: uploadPreset }, 'file');
  } else if (apiKey && apiSecret) {
    result = await signedUpload();
  } else {
    console.error('[upload] Need CLOUDINARY_UPLOAD_PRESET or API key+secret');
    process.exit(1);
  }

  if (result.error) {
    console.error('[upload] Cloudinary error:', result.error.message);
    process.exit(1);
  }

  console.log('[upload] Success:', result.secure_url);

  if (webhookUrl && result.secure_url) {
    const payload = JSON.stringify({
      recordingUrl: result.secure_url,
      publicId: result.public_id,
      fileName: path.basename(filePath),
      uploadedAt: new Date().toISOString(),
    });
    await new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    console.log('[upload] Webhook notified');
  }
}

main().catch((err) => {
  console.error('[upload] Failed:', err);
  process.exit(1);
});
