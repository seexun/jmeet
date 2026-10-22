import type { MeetApiKey } from '@openvidu-meet/typings';
import bcrypt from 'bcryptjs';
import { uid } from 'uid/secure';

const SALT_ROUNDS = 10;

export class PasswordHelper {
	static async hashPassword(password: string): Promise<string> {
		return bcrypt.hash(password, SALT_ROUNDS);
	}

	static async verifyPassword(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	// Generate a secure API key using uid with a length of 32 characters
	// If a key is provided, it will be used instead of generating a new one
	static generateApiKey(key?: string): MeetApiKey {
		return { key: key || `ovmeet-${uid(32)}`, creationDate: new Date().getTime() };
	}
}
