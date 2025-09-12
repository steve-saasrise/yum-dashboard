import sharp from 'sharp';

export class ImageOptimizer {
  /**
   * Crop and resize any image to exact dimensions for email digest
   * Always fills the container perfectly with center cropping
   */
  static async cropForEmailHero(
    imageUrl: string,
    width: number = 560,
    height: number = 315
  ): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${imageUrl}`);
        return null;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Crop to exact dimensions, centered, always fills the space
      const processedBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover', // This ensures it fills the space
          position: 'center', // Center crop
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      // Return as data URL for immediate use
      return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error cropping image:', error);
      return imageUrl; // Fallback to original
    }
  }
}
