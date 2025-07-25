import AWS from 'aws-sdk';
import { Request, Response } from 'express';

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  signatureVersion: 'v4', // Force AWS4-HMAC-SHA256 signature
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'euride';

export class S3Service {
  /**
   * Generate pre-signed URL for direct upload to S3
   */
  static async generatePresignedUrl(
    fileName: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // Validate content type for images
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      throw new Error('Invalid content type. Only image files are allowed.');
    }

    console.log('S3 Configuration:', {
      bucket: BUCKET_NAME,
      region: process.env.AWS_REGION || 'us-east-1',
      signatureVersion: 'v4'
    });

    // Check bucket region for debugging
    try {
      const bucketRegion = await this.getBucketRegion();
      console.log('Actual bucket region:', bucketRegion);
    } catch (error) {
      console.log('Could not determine bucket region:', error);
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: `orders/${fileName}`,
      ContentType: contentType,
      Expires: expiresIn,
    };

    try {
      const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
      console.log('Generated presigned URL:', presignedUrl);
      return presignedUrl;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Generate pre-signed URL for reading files from S3
   */
  static async generateReadUrl(
    fileName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Expires: expiresIn,
    };

    try {
      const presignedUrl = await s3.getSignedUrlPromise('getObject', params);
      return presignedUrl;
    } catch (error) {
      console.error('Error generating read URL:', error);
      throw new Error('Failed to generate read URL');
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(fileName: string): Promise<void> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
    };

    try {
      await s3.deleteObject(params).promise();
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Check bucket region (for debugging)
   */
  static async getBucketRegion(): Promise<string> {
    try {
      const result = await s3.getBucketLocation({ Bucket: BUCKET_NAME }).promise();
      console.log('Bucket region:', result.LocationConstraint || 'us-east-1');
      return result.LocationConstraint || 'us-east-1';
    } catch (error) {
      console.error('Error getting bucket region:', error);
      throw new Error('Failed to get bucket region');
    }
  }

  /**
   * Generate unique filename
   */
  static generateFileName(orderId: string, imageType: 'before' | 'after', originalName: string): string {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop() || 'jpg';
    return `${orderId}/${imageType}_${timestamp}.${extension}`;
  }
} 