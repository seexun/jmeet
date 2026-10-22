import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { register } from 'ts-node';
import path from 'path';
import glob from 'glob';
import { exit } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

register({
	transpileOnly: true,
	project: 'tsconfig.test.json'
});

const testFiles = glob.sync(path.resolve('tests/e2e/**/*.test.ts'));
console.log('Tests found:', testFiles);

export default {
	extension: ['ts'],
	spec: testFiles,
	timeout: 30000,
	recursive: true,
	loader: 'ts-node/esm',
	require: ['ts-node/register',],
	exit: true
};
