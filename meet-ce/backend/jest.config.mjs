import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
	displayName: 'backend',
	...createDefaultEsmPreset(),
	testTimeout: 60000,
	resolver: 'ts-jest-resolver',
	testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
	moduleFileExtensions: ['js', 'ts', 'json', 'node'],
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^@openvidu-meet/typings$': '<rootDir>/../typings/src/index.ts',
		'^(\\.{1,2}/.*)\\.js$': '$1' // Allow importing js files and resolving to ts files
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: {
					module: 'esnext',
					moduleResolution: 'node16',
					esModuleInterop: true,
					allowSyntheticDefaultImports: true,
					isolatedModules: true
				},
				useESM: true
			}
		]
	}
};

export default jestConfig;
