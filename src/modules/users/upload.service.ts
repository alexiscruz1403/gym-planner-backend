import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadApiResponse, v2 as CloudinaryType } from 'cloudinary';
import { CLOUDINARY } from '../../config/cloudinary.config';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class UploadService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryType,
  ) {}

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    // Validate mime type — never trust the client's Content-Type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG and WebP are allowed.',
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }

    // Upload buffer to Cloudinary
    // Using upload_stream because multer stores the file in memory (buffer),
    // not on disk — we pipe the buffer directly to Cloudinary
    return new Promise<string>((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        {
          folder: 'gym-planner/avatars',
          // Cloudinary will use the userId as public_id so re-uploading
          // an avatar overwrites the previous one instead of creating duplicates
          resource_type: 'image',
        },
        (error, result: UploadApiResponse) => {
          if (error) {
            reject(new InternalServerErrorException('Failed to upload image.'));
          } else {
            resolve(result.secure_url);
          }
        },
      );

      stream.end(file.buffer);
    });
  }
}
