import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, Photo } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';

/**
 * Domain-facing photo record. Keeps the Prisma-generated `Photo` type from
 * leaking outside the persistence adapter so this service stays testable with
 * an in-memory fake repository.
 */
export interface PhotoRecord {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavePhotoInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  category?: string;
}

export interface PhotoRepository {
  create(input: {
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    category?: string | null;
  }): Promise<PhotoRecord>;
  findById(id: string): Promise<PhotoRecord | null>;
  list(): Promise<PhotoRecord[]>;
  deleteById(id: string): Promise<PhotoRecord | null>;
}

export class PhotoService {
  constructor(
    private readonly repository: PhotoRepository,
    private readonly storageDir: string,
  ) {}

  async savePhoto(input: SavePhotoInput): Promise<PhotoRecord> {
    await fs.mkdir(this.storageDir, { recursive: true });

    const storedName = `${randomUUID()}-${path.basename(input.filename)}`;
    const filePath = path.join(this.storageDir, storedName);

    await fs.writeFile(filePath, input.data);

    try {
      return await this.repository.create({
        fileName: storedName,
        filePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        category: input.category ?? null,
      });
    } catch (error) {
      // Roll back the written file if persistence fails.
      await fs.unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async listPhotos(): Promise<PhotoRecord[]> {
    return this.repository.list();
  }

  async getPhoto(id: string): Promise<PhotoRecord> {
    const photo = await this.repository.findById(id);
    if (!photo) {
      throw new NotFoundError(`Photo "${id}" was not found.`);
    }
    return photo;
  }

  async deletePhoto(id: string): Promise<PhotoRecord> {
    const photo = await this.getPhoto(id);
    await fs.unlink(photo.filePath).catch(() => undefined);
    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError(`Photo "${id}" was not found.`);
    }
    return deleted;
  }
}

function toPhotoRecord(photo: Photo): PhotoRecord {
  return {
    id: photo.id,
    fileName: photo.fileName,
    filePath: photo.filePath,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    category: photo.category,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}

/**
 * Build the production PhotoService backed by Prisma and the on-disk storage
 * directory. The repository adapter keeps the Prisma-generated types internal.
 */
export function createPhotoService(
  prisma: PrismaClient,
  storageDir: string,
): PhotoService {
  const repository: PhotoRepository = {
    create: async (input) => {
      const data: Prisma.PhotoCreateInput = {
        fileName: input.fileName,
        filePath: input.filePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        category: input.category ?? null,
      };
      return toPhotoRecord(await prisma.photo.create({ data }));
    },
    findById: async (id) => {
      const photo = await prisma.photo.findUnique({ where: { id } });
      return photo ? toPhotoRecord(photo) : null;
    },
    list: async () => {
      const photos = await prisma.photo.findMany({ orderBy: { createdAt: 'desc' } });
      return photos.map(toPhotoRecord);
    },
    deleteById: async (id) => {
      const photo = await prisma.photo.delete({ where: { id } }).catch(() => null);
      return photo ? toPhotoRecord(photo) : null;
    },
  };

  return new PhotoService(repository, storageDir);
}
