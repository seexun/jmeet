module.exports = {
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
	transform: {
		'^.+\\.ts?$': 'ts-jest' // Si usas TypeScript
	},
	moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
	moduleNameMapper: {
		'\\.(css|less|scss|sass)$': 'identity-obj-proxy' // Para importar estilos en componentes
	}
};
