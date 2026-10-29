import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '@/lib/errors';
import {
  PhotoService,
  type PhotoRecord,
  type PhotoRepository,
} from '@/services/photoService';

function makeRecord(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'p1',
    fileName: 'photo.jpg',
    filePath: '/data/photos/photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakePhotoRepository implements PhotoRepository {
  readonly store = new Map<string, PhotoRecord>();

  async create(input: {
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    category?: string | null;
  }): Promise<PhotoRecord> {
    const record = makeRecord({
      id: `id-${this.store.size + 1}`,
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      category: input.category ?? null,
    });
    this.store.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<PhotoRecord | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<PhotoRecord[]> {
    return Array.from(this.store.values());
  }

  async deleteById(id: string): Promise<PhotoRecord | null> {
    const record = this.store.get(id);
    if (record) {
      this.store.delete(id);
    }
    return record ?? null;
  }
}

describe('PhotoService', () => {
  let storageDir: string;
  let service: PhotoService;

  beforeEach(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibelift-photo-'));
    service = new PhotoService(new FakePhotoRepository(), storageDir);
  });

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('persists photo bytes to disk and stores metadata', async () => {
    const record = await service.savePhoto({
      filename: 'progress.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 5,
      data: Buffer.from('hello'),
    });

    expect(record.fileName).toContain('progress.jpg');
    expect(record.category).toBeNull();

    const written = await fs.readFile(record.filePath, 'utf8');
    expect(written).toBe('hello');
  });

  it('returns a stored photo by id', async () => {
    const record = await service.savePhoto({
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2,
      data: Buffer.from('x'),
    });

    const fetched = await service.getPhoto(record.id);
    expect(fetched.id).toBe(record.id);
  });

  it('throws NotFoundError for a missing photo', async () => {
    await expect(service.getPhoto('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('removes the file and record on delete', async () => {
    const record = await service.savePhoto({
      filename: 'gone.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
      data: Buffer.from('z'),
    });

    await service.deletePhoto(record.id);

    await expect(fs.access(record.filePath)).rejects.toThrow();
    await expect(service.getPhoto(record.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
