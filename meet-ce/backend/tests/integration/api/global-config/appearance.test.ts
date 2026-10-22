import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetAppearanceConfig, MeetRoomThemeMode } from '@openvidu-meet/typings';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	getRoomsAppearanceConfig,
	restoreDefaultGlobalConfig,
	startTestServer,
	updateRoomsAppearanceConfig
} from '../../../helpers/request-helpers.js';

describe('Rooms Appearance Config API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		await restoreDefaultGlobalConfig();
	});

	describe('Update rooms appearance config', () => {
		it('should update rooms appearance config with valid complete data', async () => {
			const validConfig = {
				appearance: {
					themes: [
						{
							name: 'custom',
							enabled: true,
							baseTheme: MeetRoomThemeMode.DARK,
							backgroundColor: '#121212',
							primaryColor: '#bb86fc',
							secondaryColor: '#03dac6',
							accentColor: '#09554dff',
							surfaceColor: '#1f1f1f'
						}
					]
				}
			};

			let response = await updateRoomsAppearanceConfig(validConfig);
			expect(response.status).toBe(200);
			expect(response.body).toEqual(validConfig);

			response = await getRoomsAppearanceConfig();
			expect(response.status).toBe(200);
			expect(response.body).toEqual(validConfig);
		});

		it('should update rooms appearance config with minimal required data', async () => {
			const validConfig = {
				appearance: {
					themes: [
						{
							name: 'default',
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			};

			let response = await updateRoomsAppearanceConfig(validConfig);
			expect(response.status).toBe(200);
			expect(response.body).toEqual(validConfig);

			response = await getRoomsAppearanceConfig();
			expect(response.status).toBe(200);
			expect(response.body).toEqual(validConfig);
		});

		it('should replace existing config when updating', async () => {
			const initialConfig = {
				appearance: {
					themes: [
						{
							name: 'initial',
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT,
							primaryColor: '#1976d2',
							backgroundColor: '#ffffff'
						}
					]
				}
			};

			let response = await updateRoomsAppearanceConfig(initialConfig);
			expect(response.status).toBe(200);

			response = await getRoomsAppearanceConfig();
			expect(response.status).toBe(200);
			expect(response.body).toEqual(initialConfig);

			const newConfig: { appearance: MeetAppearanceConfig } = {
				appearance: {
					themes: [
						{
							name: 'new',
							enabled: false,
							baseTheme: MeetRoomThemeMode.DARK,
							primaryColor: '#bb86fc'
						}
					]
				}
			};

			response = await updateRoomsAppearanceConfig(newConfig);
			expect(response.status).toBe(200);

			response = await getRoomsAppearanceConfig();
			expect(response.status).toBe(200);
			newConfig.appearance.themes[0] = {
				...newConfig.appearance.themes[0],
				backgroundColor: '#ffffff'
			};
			expect(response.body).toEqual(newConfig);
		});
	});

	describe('Update rooms appearance config validation', () => {
		it('should reject when themes array is empty', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: []
				}
			});

			expectValidationError(response, 'appearance.themes', 'There must be exactly one theme defined');
		});

		it('should reject when themes array has more than one theme', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Theme 1',
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT
						},
						{
							name: 'Theme 2',
							enabled: true,
							baseTheme: MeetRoomThemeMode.DARK
						}
					]
				}
			});

			expectValidationError(response, 'appearance.themes', 'There must be exactly one theme defined');
		});

		it('should reject when theme name is empty', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: '',
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			});

			expectValidationError(response, 'appearance.themes.0.name', 'Theme name cannot be empty');
		});

		it('should reject when theme name exceeds 50 characters', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'a'.repeat(51),
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			});

			expectValidationError(response, 'appearance.themes.0.name', 'Theme name cannot exceed 50 characters');
		});

		it('should reject when theme name has invalid characters', async () => {
			const invalidNames = [
				'Corporate Blue', // Spaces
				'dark-mode.2024!', // Special characters
				'thème_français' // Accents
			];

			for (const name of invalidNames) {
				const response = await updateRoomsAppearanceConfig({
					appearance: {
						themes: [
							{
								name: name,
								enabled: true,
								baseTheme: MeetRoomThemeMode.LIGHT
							}
						]
					}
				});

				expectValidationError(
					response,
					'appearance.themes.0.name',
					'Theme name can only contain letters, numbers, hyphens and underscores'
				);
			}
		});

		it('should reject when enabled is not a boolean', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Valid Name',
							enabled: 'yes',
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });

			expectValidationError(response, 'appearance.themes.0.enabled', 'Expected boolean, received string');
		});

		it('should reject when baseTheme is not a valid enum value', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Invalid Theme',
							baseTheme: 'invalid'
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });

			expectValidationError(
				response,
				'appearance.themes.0.baseTheme',
				"Invalid enum value. Expected 'light' | 'dark', received 'invalid'"
			);
		});

		it('should reject when hex colors are invalid', async () => {
			let response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Invalid Color Theme',
							baseTheme: MeetRoomThemeMode.LIGHT,
							backgroundColor: 'not-a-color'
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.backgroundColor', 'Must be a valid hex color code');

			response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Invalid Color Theme',
							baseTheme: MeetRoomThemeMode.LIGHT,
							primaryColor: '#gggggg'
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.primaryColor', 'Must be a valid hex color code');

			response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Invalid Color Theme',
							baseTheme: MeetRoomThemeMode.LIGHT,
							secondaryColor: '#12345'
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.secondaryColor', 'Must be a valid hex color code');

			response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Invalid Color Theme',
							baseTheme: MeetRoomThemeMode.LIGHT,
							surfaceColor: 'rgb(255,255,255)'
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.surfaceColor', 'Must be a valid hex color code');
		});

		it('should accept valid 3-digit hex colors', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'custom',
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT,
							backgroundColor: '#fff',
							primaryColor: '#000',
							secondaryColor: '#f0f',
							surfaceColor: '#abc'
						}
					]
				}
			});

			expect(response.status).toBe(200);
		});

		it('should reject when name, enabled or baseTheme are not provided', async () => {
			let response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							enabled: true,
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.name', 'Required');

			response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Missing Enabled',
							baseTheme: MeetRoomThemeMode.LIGHT
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.enabled', 'Required');

			response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: [
						{
							name: 'Missing Base Theme',
							enabled: true
						}
					]
				}
			} as unknown as { appearance: MeetAppearanceConfig });
			expectValidationError(response, 'appearance.themes.0.baseTheme', 'Required');
		});

		it('should reject when appearance is not an object', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: 'invalid'
			} as unknown as { appearance: MeetAppearanceConfig });

			expectValidationError(response, 'appearance', 'Expected object, received string');
		});

		it('should reject when themes is not an array', async () => {
			const response = await updateRoomsAppearanceConfig({
				appearance: {
					themes: 'invalid'
				}
			} as unknown as { appearance: MeetAppearanceConfig });

			expectValidationError(response, 'appearance.themes', 'Expected array, received string');
		});
	});

	describe('Get rooms appearance config', () => {
		it('should return an empty array when no appearance config is set', async () => {
			const response = await getRoomsAppearanceConfig();

			expect(response.status).toBe(200);
			expect(response.body).toEqual({ appearance: { themes: [] } });
		});

		it('should return rooms appearance config when one is set', async () => {
			const configToSet = {
				appearance: {
					themes: [
						{
							name: 'custom',
							enabled: true,
							baseTheme: MeetRoomThemeMode.DARK,
							primaryColor: '#bb86fc'
						}
					]
				}
			};
			let response = await updateRoomsAppearanceConfig(configToSet);
			expect(response.status).toBe(200);

			response = await getRoomsAppearanceConfig();
			expect(response.status).toBe(200);
			expect(response.body).toEqual(configToSet);
		});
	});
});
