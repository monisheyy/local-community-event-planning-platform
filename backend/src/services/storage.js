/**
 * File storage for event images.
 *  - Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING is set (production)
 *  - Local ./uploads folder otherwise (development)
 * The container stays PRIVATE: files are streamed to clients through GET /api/files/:name,
 * so no public blob access needs to be enabled on the storage account.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HttpError, newId } from '../utils.js';

const ALLOWED = {
  'image/jpeg': { ext: '.jpg', magic: [[0xff, 0xd8, 0xff]] },
  'image/png': { ext: '.png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/gif': { ext: '.gif', magic: [[0x47, 0x49, 0x46, 0x38]] },
  'image/webp': { ext: '.webp', magic: [[0x52, 0x49, 0x46, 0x46]] },
};
const NAME_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|gif|webp)$/;
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

/** Check the declared MIME type AND the file's magic bytes so renamed files can't sneak through. */
export function validateImage(file) {
  if (!file) throw new HttpError(400, 'Please choose an image to upload.');
  const spec = ALLOWED[file.mimetype];
  if (!spec) throw new HttpError(400, 'Only JPEG, PNG, GIF or WebP images are allowed.');
  const ok = spec.magic.some((sig) => sig.every((byte, i) => file.buffer[i] === byte));
  if (!ok) throw new HttpError(400, 'The file does not look like a valid image.');
  return spec.ext;
}

let containerClient = null;
async function blobContainer() {
  if (containerClient) return containerClient;
  const { BlobServiceClient } = await import('@azure/storage-blob');
  const service = BlobServiceClient.fromConnectionString(config.storage.connectionString);
  containerClient = service.getContainerClient(config.storage.container);
  await containerClient.createIfNotExists(); // private by default
  return containerClient;
}

export async function saveImage(file) {
  const ext = validateImage(file);
  const name = `${newId()}${ext}`;
  if (config.storage.driver === 'azure-blob') {
    const container = await blobContainer();
    await container.getBlockBlobClient(name).uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype, blobCacheControl: 'public, max-age=31536000, immutable' },
    });
  } else {
    fs.mkdirSync(config.storage.localDir, { recursive: true });
    fs.writeFileSync(path.join(config.storage.localDir, name), file.buffer);
  }
  return `/api/files/${name}`;
}

/** Stream a stored file to the HTTP response. */
export async function streamImage(name, res) {
  if (!NAME_PATTERN.test(name)) throw new HttpError(404, 'File not found');
  const contentType = CONTENT_TYPES[path.extname(name)];
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (config.storage.driver === 'azure-blob') {
    const container = await blobContainer();
    try {
      const download = await container.getBlockBlobClient(name).download();
      download.readableStreamBody.pipe(res);
    } catch (err) {
      if (err.statusCode === 404) throw new HttpError(404, 'File not found');
      throw err;
    }
    return;
  }
  const filePath = path.join(config.storage.localDir, name);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'File not found');
  fs.createReadStream(filePath).pipe(res);
}

export async function deleteImage(url) {
  const name = url?.startsWith('/api/files/') ? url.slice('/api/files/'.length) : null;
  if (!name || !NAME_PATTERN.test(name)) return;
  try {
    if (config.storage.driver === 'azure-blob') {
      await (await blobContainer()).getBlockBlobClient(name).deleteIfExists();
    } else {
      fs.rmSync(path.join(config.storage.localDir, name), { force: true });
    }
  } catch (err) {
    console.warn('[storage] could not delete', name, err.message);
  }
}
