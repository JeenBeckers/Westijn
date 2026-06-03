import sharp from 'sharp'

/**
 * Compress and resize an image buffer so the resulting PDF stays under 1MB.
 * Target: max 600px wide, JPEG quality 72 — typically yields 40–150KB per photo.
 */
export async function compressImage(input: Buffer | ArrayBuffer): Promise<Buffer> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)

  return sharp(buffer)
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, progressive: true })
    .toBuffer()
}
