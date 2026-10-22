// nz 组件类名审计：校验主题层与组件层使用的 .ant-* 选择器
// 在当前安装的 ng-zorro 版本中真实存在。
//
// 背景：ng-zorro 大版本升级会改内部类名/结构（实例：.ant-collapse-content-box
// → .ant-collapse-body、.ant-pagination-item-link-icon 整层移除），失效的
// 覆盖规则会静默死亡。升级 ng-zorro 前后各跑一次本脚本：
//
//   node scripts/check-nz-selectors.mjs
//
// 有失效选择器时输出清单并以退出码 1 结束。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, '../meet-ce/frontend');
const libDir = path.resolve(frontendDir, 'projects/shared-meet-components');

// 1. 定位实际安装的 ng-zorro（兼容 pnpm 目录结构）
const requireFromFrontend = createRequire(path.join(frontendDir, 'index.js'));
let nzDir;
try {
	nzDir = path.dirname(requireFromFrontend.resolve('ng-zorro-antd/package.json'));
} catch {
	console.error('[nz-check] 未找到 ng-zorro-antd，请确认依赖已安装');
	process.exit(2);
}

// 2. 收集 ng-zorro 语料（CSS + 模板 + 组件代码）
function collect(dir, extensions, out = []) {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			collect(full, extensions, out);
		} else if (extensions.includes(path.extname(name))) {
			out.push(readFileSync(full, 'utf-8'));
		}
	}
	return out;
}
const corpus = collect(nzDir, ['.css', '.html', '.js', '.mjs']).join('\n');

// 3. 提取本仓库样式层 + 组件层使用的 .ant-* 类名
const classes = new Set();
for (const scss of ['styles', 'src/lib'].map((rel) => path.join(libDir, rel))) {
	for (const file of walkScss(scss)) {
		const text = readFileSync(file, 'utf-8');
		for (const match of text.matchAll(/\.ant-[a-z-]+/g)) {
			classes.add(match[0]);
		}
	}
}
function* walkScss(dir) {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			yield* walkScss(full);
		} else if (name.endsWith('.scss')) {
			yield full;
		}
	}
}

// 4. 逐类核对
const dead = [...classes].filter((cls) => !corpus.includes(`.${cls.slice(1)}`));
console.log(`[nz-check] ng-zorro ${nzDir.split(path.sep).find((p) => p.startsWith('ng-zorro-antd@')) ?? ''}`);
console.log(`[nz-check] .ant-* 选择器 ${classes.size} 个，失效 ${dead.length} 个`);
if (dead.length) {
	console.error('[nz-check] 失效选择器（ng-zorro 中已不存在，对应覆盖规则已静默死亡）:');
	for (const cls of dead) {
		console.error('  -', cls);
	}
	process.exit(1);
}
console.log('[nz-check] 全部有效 ✓');
