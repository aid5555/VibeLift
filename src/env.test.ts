import { describe, expect, it } from 'vitest';
import { parseEnv, type EnvSource } from '@/env';
import { EnvValidationError } from '@/lib/errors';

const validEnv: EnvSource = {
  LYFTA_API_KEY: 'lyfta-secret',
  AI_API_KEY: 'ai-secret',
};

describe('parseEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = parseEnv(validEnv);

    expect(env.LYFTA_API_KEY).toBe('lyfta-secret');
    expect(env.AI_API_KEY).toBe('ai-secret');
    expect(env.NODE_ENV).toBe('development');
    expect(env.DATABASE_URL).toBe('file:/data/vibelift.db');
    expect(env.LYFTA_BASE_URL).toBe('https://api.lyfta.com');
    expect(env.AI_MODEL).toBe('gpt-4o-mini');
    expect(env.OPENCODE_BASE_URL).toBe('http://localhost:8787');
    expect(env.PHOTO_STORAGE_PATH).toBe('/data/photos');
    expect(env.MAX_PHOTO_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it('throws when LYFTA_API_KEY is missing', () => {
    expect(() => parseEnv({ AI_API_KEY: 'ai-secret' })).toThrow(EnvValidationError);
  });

  it('throws when LYFTA_API_KEY is empty', () => {
    expect(() =>
      parseEnv({ LYFTA_API_KEY: '', AI_API_KEY: 'ai-secret' }),
    ).toThrow(EnvValidationError);
  });

  it('throws when AI_API_KEY is missing', () => {
    expect(() => parseEnv({ LYFTA_API_KEY: 'lyfta-secret' })).toThrow(
      EnvValidationError,
    );
  });

  it('throws when LYFTA_BASE_URL is malformed', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        LYFTA_BASE_URL: 'not-a-url',
      }),
    ).toThrow(EnvValidationError);
  });

  it('coerces numeric MAX_PHOTO_UPLOAD_BYTES from a string', () => {
    const env = parseEnv({ ...validEnv, MAX_PHOTO_UPLOAD_BYTES: '2048' });
    expect(env.MAX_PHOTO_UPLOAD_BYTES).toBe(2048);
  });

  it('reports which keys are missing in the error message', () => {
    let message = '';
    try {
      parseEnv({});
    } catch (error) {
      if (error instanceof EnvValidationError) {
        message = error.message;
      }
    }
    expect(message).toContain('LYFTA_API_KEY');
    expect(message).toContain('AI_API_KEY');
  });
});
