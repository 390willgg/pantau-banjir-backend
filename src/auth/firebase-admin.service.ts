import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

type FirebaseAdminCredentialConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private readonly app?: App;

  constructor() {
    const credentials = this.resolveCredentials();

    if (!credentials) {
      this.logger.warn(
        'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or provide FIREBASE_SERVICE_ACCOUNT_JSON_PATH / backend/credentials/firebase-admin.local.json.',
      );
      return;
    }

    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
      });
  }

  private resolveCredentials(): FirebaseAdminCredentialConfig | null {
    return this.resolveCredentialsFromServiceAccountFile() ?? this.resolveCredentialsFromEnv();
  }

  private resolveCredentialsFromEnv(): FirebaseAdminCredentialConfig | null {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  private resolveCredentialsFromServiceAccountFile(): FirebaseAdminCredentialConfig | null {
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH;
    const serviceAccountPath = this.resolveServiceAccountPath(configuredPath);

    if (!serviceAccountPath || !existsSync(serviceAccountPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      const projectId = parsed.project_id?.trim();
      const clientEmail = parsed.client_email?.trim();
      const privateKey = parsed.private_key?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          `Firebase service account file at ${serviceAccountPath} is missing project_id, client_email, or private_key.`,
        );
        return null;
      }

      return {
        projectId,
        clientEmail,
        privateKey,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to read Firebase service account file at ${serviceAccountPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private resolveServiceAccountPath(configuredPath?: string): string | null {
    const trimmedPath = configuredPath?.trim();

    if (trimmedPath) {
      return isAbsolute(trimmedPath) ? trimmedPath : resolve(process.cwd(), trimmedPath);
    }

    return resolve(process.cwd(), 'credentials', 'firebase-admin.local.json');
  }

  isEnabled() {
    return Boolean(this.app);
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin is not configured.');
    }

    return getAuth(this.app).verifyIdToken(token);
  }

  async sendMulticastMessage(message: MulticastMessage) {
    if (!this.app) {
      throw new Error('Firebase Admin is not configured.');
    }

    return getMessaging(this.app).sendEachForMulticast(message);
  }
}
