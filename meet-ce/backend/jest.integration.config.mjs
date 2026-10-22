import baseConfig from './jest.config.mjs';

const integrationConfig = {
	...baseConfig,

	runInBand: true,
	forceExit: true,
	detectOpenHandles: true,
	testMatch: ['**/tests/integration/**/*.(spec|test).ts']
};

export default integrationConfig;
