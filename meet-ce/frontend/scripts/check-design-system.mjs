import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const colorPattern = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
// 批次4 门禁扩展：roots 增补全局层 styles/（6 域 partial + _tables + layout/_utilities 等，
// 此前无自动裸色门禁）；令牌层与会议域样式的裸色处置见 allowDirs。
const roots = ['projects/shared-meet-components/src/lib', 'projects/shared-meet-components/styles'];
// 整目录豁免（照既有配置常量结构，非新规则体系）：
// - styles/tokens：设计令牌唯一出生点，具体色值由契约测试单独锁点（primitive palette 等）；
// - styles/meeting：会议域令牌（_tokens）与 prejoin 样式，迁移归会议域任务（批次4 裁定：豁免+报告）。
const allowDirs = ['projects/shared-meet-components/styles/tokens', 'projects/shared-meet-components/styles/meeting'];
// 批次5 门禁硬化：豁免判定由子串 includes 收紧为路径段前缀比较——
// 子串匹配会让 styles/meeting-xxx 这类同前缀目录（或路径中任意同前缀段）误享豁免。
const isAllowedDir = (file, dir) => file === dir || file.startsWith(`${dir}/`);

async function files(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}

export async function scan(paths) {
	const warnings = [];
	for (const file of paths) {
		if (!file.endsWith('.scss')) continue;
		const normalized = file.split('\\').join('/');
		if (allowDirs.some((dir) => isAllowedDir(normalized, dir))) continue;
		const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
		lines.forEach((line, index) => {
			// 行注释（// 之后）不构成发射 CSS，不参与拦截（同契约「注释提及不拦截」口径）
			const code = line.split('//')[0];
			if (colorPattern.test(code) && !line.includes('design-system-allow-hardcoded:')) warnings.push(`${file}:${index + 1}`);
		});
	}
	return warnings;
}

if (process.argv.includes('--self-test')) {
	const dir = await mkdtemp(join(tmpdir(), 'jmeet-design-system-'));
	const bad = join(dir, 'bad.scss');
	const good = join(dir, 'good.scss');
	await writeFile(bad, '.x { color: #123456; }');
	await writeFile(good, '.x { color: var(--jmeet-color-text-primary); }');
	assert.equal((await scan([bad])).length, 1);
	assert.equal((await scan([good])).length, 0);
	// 批次4：注释行/行尾注释不拦截，但声明本体仍拦
	const commented = join(dir, 'commented.scss');
	await writeFile(commented, '// 旧值 rgb(0 0 0 / 5%) 已令牌化\n.y { background: var(--x); // 原 rgb(1 2 3 / 4%) }\n.z { border: 1px solid #abcdef; }');
	assert.equal((await scan([commented])).length, 1);
	// 批次5 门禁硬化：allowDirs 豁免按路径段前缀比较——同前缀不同段（tokens-extra，
	// 对应未来可能出现的 styles/meeting-xxx 类目录）不得误享豁免
	const lookalikeDir = join(dir, 'nested', 'projects', 'shared-meet-components', 'styles', 'tokens-extra');
	await mkdir(lookalikeDir, { recursive: true });
	const lookalike = join(lookalikeDir, 'bad.scss');
	await writeFile(lookalike, '.x { color: #123456; }');
	assert.equal((await scan([lookalike])).length, 1);
	console.log('design-system scanner self-test passed');
} else {
	const warnings = await scan((await Promise.all(roots.map(files))).flat());
	warnings.forEach((warning) => console.warn(`design-system warning: ${warning}`));
	if (process.argv.includes('--strict') && warnings.length) process.exitCode = 1;
}
