import dotenv from 'dotenv';
import path from 'path';

// Carrega .env do root do monorepo ou da API
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  firebase: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    isConfigured: boolean;
  };
  gcs: {
    bucketName?: string;
    projectId?: string;
    keyFile?: string;
    isConfigured: boolean;
  };
  openWeatherApiKey?: string;
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const isFirebaseConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey,
);

const isGcsConfigured = Boolean(process.env.GCS_BUCKET_NAME);

export const env: EnvironmentConfig = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/autogest',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
    isConfigured: isFirebaseConfigured,
  },
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME,
    projectId: process.env.GCS_PROJECT_ID,
    keyFile: process.env.GCS_KEY_FILE,
    isConfigured: isGcsConfigured,
  },
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
};
