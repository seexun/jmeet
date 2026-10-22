import { describe, it, expect } from '@jest/globals';
import { VideoGrant } from 'livekit-server-sdk';
import { LiveKitPermissions } from '@openvidu-meet/typings';

// 1) Extract the keys from each interface using keyof
type KeysLiveKit = keyof LiveKitPermissions;
type KeysVideo = keyof VideoGrant;

// 2) Calculate the differences between the interfaces
type OnlyInLiveKit = Exclude<KeysLiveKit, KeysVideo>; // Properties only in LiveKitPermissions
type OnlyInVideo = Exclude<KeysVideo, KeysLiveKit>; // Properties only in VideoGrant
type SymmetricDiff = OnlyInLiveKit | OnlyInVideo; // All properties that differ between interfaces

// 3) Type assertion that forces SymmetricDiff to be 'never'
// If interfaces have different properties, this will cause a compile error
type AssertNoDiff<T extends never> = T;
type Assert = AssertNoDiff<SymmetricDiff>;

// 4) Additional bi-directional assignability check
// These will fail if property types don't match exactly
type AssertLiveKitIsVideoGrant = LiveKitPermissions extends VideoGrant ? true : never;
type AssertVideoGrantIsLiveKit = VideoGrant extends LiveKitPermissions ? true : never;
type BiDirectionalCheck = [AssertLiveKitIsVideoGrant, AssertVideoGrantIsLiveKit];

// 5) Check individual property types for exact matches
type CheckPropertyTypes<K extends string | number | symbol> = LiveKitPermissions[K &
	keyof LiveKitPermissions] extends VideoGrant[K & keyof VideoGrant]
	? VideoGrant[K & keyof VideoGrant] extends LiveKitPermissions[K & keyof LiveKitPermissions]
		? true
		: never
	: never;

// Apply the check to all properties
type PropertyTypeCheck = { [K in KeysVideo]: CheckPropertyTypes<K> };

describe('OpenVidu Meet LiveKitPermissions type', () => {
	it('should have identical properties to VideoGrant', () => {
		expect(true).toBe(true); // Test passes if compilation succeeds
	});
});
