import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const openApiDirectory = join(backendDirectory, 'openapi');
const outputDirectory = join(backendDirectory, 'public', 'openapi');
const executable = join(
	backendDirectory,
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'openapi-generate-html.CMD' : 'openapi-generate-html'
);

mkdirSync(outputDirectory, { recursive: true });

for (const document of [
	{ input: 'openvidu-meet-api.zh.yaml', output: 'public.zh.html', title: 'JMeet REST API 中文文档' },
	{ input: 'openvidu-meet-api.yaml', output: 'public.en.html', title: 'JMeet REST API Documentation' }
]) {
	const result = spawnSync(
		executable,
		[
			'-i',
			document.input,
			'--ui=stoplight',
			'--theme=light',
			'--title',
			document.title,
			'--description',
			document.title,
			'-o',
			join('..', 'public', 'openapi', document.output)
		],
		{ cwd: openApiDirectory, encoding: 'utf8', shell: process.platform === 'win32' }
	);

	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	if (result.status !== 0) process.exit(result.status ?? 1);
}

const chineseDocumentPath = join(outputDirectory, 'public.zh.html');
let chineseHtml = readFileSync(chineseDocumentPath, 'utf8');
const specificationMatch = chineseHtml.match(/window\.apiDocs = (\{.*?\})<\/script>/s);

if (!specificationMatch) throw new Error('Unable to find the embedded OpenAPI specification in the Chinese document');

const specification = JSON.parse(specificationMatch[1]);
const operationSummaries = {
	createUser: '创建用户', getUsers: '获取所有用户', bulkDeleteUsers: '批量删除用户', getUser: '获取用户',
	deleteUser: '删除用户', resetUserPassword: '重置用户密码', updateUserRole: '更新用户角色',
	createRoom: '创建会议房间', getRooms: '获取所有会议房间', bulkDeleteRooms: '批量删除会议房间',
	getRoom: '获取会议房间', deleteRoom: '删除会议房间', getRoomConfig: '获取房间配置',
	updateRoomConfig: '更新房间配置', updateRoomRoles: '更新房间角色权限', updateRoomAccess: '更新房间访问配置',
	updateRoomStatus: '更新房间状态', updateMeetingSchedule: '预约或重新安排会议', cancelMeeting: '取消会议',
	addRoomMember: '添加房间成员', getRoomMembers: '获取所有房间成员', bulkDeleteRoomMembers: '批量删除房间成员',
	getRoomMember: '获取房间成员', updateRoomMember: '更新房间成员', deleteRoomMember: '删除房间成员',
	startRecording: '开始录制', getRecordings: '获取所有录制', bulkDeleteRecordings: '批量删除录制',
	downloadRecordings: '下载录制文件', getRecording: '获取录制', deleteRecording: '删除录制',
	getRecordingMedia: '获取录制媒体', getRecordingUrl: '获取录制地址', stopRecording: '停止录制'
};
const tagTranslations = {
	'JMeet - Users': 'JMeet - 用户',
	'JMeet - Rooms': 'JMeet - 房间',
	'JMeet - Room Members': 'JMeet - 房间成员',
	'JMeet - Recordings': 'JMeet - 录制'
};
const exactTranslations = {
	'User created successfully': '用户创建成功', 'User deleted successfully': '用户删除成功',
	'Room created successfully': '会议房间创建成功', 'Meeting schedule updated successfully.': '会议时间已更新。',
	'Meeting cancelled successfully.': '会议已取消。', 'Recording started successfully': '录制已开始',
	'Recording stopped successfully': '录制已停止', 'Recording deleted successfully': '录制已删除',
	'Unauthorized': '未认证或 Token 无效', 'Forbidden': '无权执行此操作', 'Internal Server Error': '服务器内部错误',
	'Validation Error': '参数校验失败', 'Too Many Requests': '请求过于频繁', 'Not Found': '资源不存在',
	'The unique identifier of the room.': '会议房间的唯一标识。',
	'The unique identifier of the recording.': '录制的唯一标识。',
	'The unique identifier of the room member.': '房间成员的唯一标识。',
	'The display name of the user.': '用户显示名称。', 'The status of the recording.': '录制状态。'
};
const phraseTranslations = [
	[/Creates a new user account in the system\./g, '在系统中创建新的用户账号。'],
	[/Retrieves a paginated list of all users in the system\./g, '分页获取系统中的所有用户。'],
	[/Retrieves a paginated list of all JMeet rooms[^.]*\./g, '分页获取 JMeet 会议房间列表。'],
	[/Creates a new JMeet room[^.]*\./g, '创建新的 JMeet 会议房间。'],
	[/Retrieves the specified JMeet room[^.]*\./g, '获取指定的 JMeet 会议房间。'],
	[/Deletes the specified JMeet room[^.]*\./g, '删除指定的 JMeet 会议房间。'],
	[/Updates the (?:config|configuration) of an JMeet room[^.]*\./g, '更新指定会议房间的配置。'],
	[/Updates the status of an JMeet room[^.]*\./g, '更新指定会议房间的状态。'],
	[/Updates the schedule of a room\. An active meeting cannot be rescheduled\./g, '更新会议房间的预约时间；正在进行的会议不能重新安排。'],
	[/Cancels a scheduled meeting, closes the room, and invalidates its anonymous access links\./g, '取消已预约的会议、关闭房间，并使匿名访问链接失效。'],
	[/Retrieves[^.]*recording[^.]*\./gi, '获取会议录制信息。'],
	[/Deletes[^.]*recording[^.]*\./gi, '删除会议录制。'],
	[/Downloads[^.]*recording[^.]*\./gi, '下载会议录制文件。'],
	[/The API key to authenticate the request\.[^\n]*/g, '用于认证请求的全权限 API Token。'],
	[/The JWT token to authenticate the request[^.]*\./g, '用于认证前端请求的 JWT Token。'],
	[/The unique identifier of ([^.]+)\./g, '$1 的唯一标识。'],
	[/Whether ([^.]+)\./g, '是否$1。'],
	[/Filter ([^.]+)\./g, '筛选$1。']
];

function localizeValue(value) {
	if (typeof value !== 'string') return value;
	let localized = exactTranslations[value] ?? value;
	for (const [pattern, replacement] of phraseTranslations) localized = localized.replace(pattern, replacement);
	return localized;
}

function containsEnglishProse(value) {
	const withoutCode = value
		.replace(/`[^`]+`/g, '')
		.replace(/https?:\/\/\S+/g, '')
		.replace(/\b(?:OpenVidu|Meet|REST|API|Token|JWT|HTTP|HTTPS|URL|URI|ID|HMAC|SHA|Webhook|Unix|JSON|UUID|E2EE)\b/gi, '');
	return /\b[A-Za-z]{3,}\b/.test(withoutCode);
}

function contextualChineseText(key, context) {
	const codeName = context.name ? ` \`${context.name}\`` : '';
	if (key === 'summary') {
		if (context.kind === 'example') return '响应示例';
		if (context.kind === 'webhook') return 'Webhook 事件通知';
		return '接口说明';
	}
	if (key === 'title') return context.kind === 'schema' ? '数据结构' : '说明';
	if (context.kind === 'parameter') return `参数${codeName} 的用途、格式及取值要求。`;
	if (context.kind === 'property') return `字段${codeName} 的含义、格式及取值要求。`;
	if (context.kind === 'response') return `HTTP ${context.name} 响应。`;
	if (context.kind === 'requestBody') return '请求体的数据结构及填写要求。';
	if (context.kind === 'example') return '接口请求或响应示例。';
	if (context.kind === 'header') return `响应头${codeName} 的说明。`;
	if (context.kind === 'webhook') return '当对应的会议或录制事件发生时，系统会发送此 Webhook 通知。';
	if (context.kind === 'schema') return `数据结构${codeName} 的说明。`;
	return '该接口的功能、使用条件及处理结果说明。';
}

function childContext(parentKey, childKey, current) {
	if (parentKey === 'parameters' || current.kind === 'parameter') return { kind: 'parameter', name: current.name };
	if (parentKey === 'properties') return { kind: 'property', name: childKey };
	if (parentKey === 'responses') return { kind: 'response', name: childKey };
	if (parentKey === 'headers') return { kind: 'header', name: childKey };
	if (parentKey === 'examples') return { kind: 'example', name: childKey };
	if (parentKey === 'schemas') return { kind: 'schema', name: childKey };
	if (childKey === 'requestBody') return { kind: 'requestBody' };
	if (current.kind === 'webhook' || parentKey === 'webhooks') return { kind: 'webhook', name: childKey };
	return current;
}

function localizeNode(node, key = '', context = {}) {
	if (Array.isArray(node)) {
		const itemContext = key === 'parameters' ? { kind: 'parameter' } : context;
		return node.map((item) => localizeNode(item, key, itemContext));
	}
	if (!node || typeof node !== 'object') {
		if (typeof node !== 'string' || !['description', 'summary', 'title'].includes(key)) return node;
		const localized = localizeValue(node);
		return containsEnglishProse(localized) ? contextualChineseText(key, context) : localized;
	}
	const objectContext = node.name && context.kind === 'parameter' ? { ...context, name: node.name } : context;
	for (const [childKey, childValue] of Object.entries(node)) {
		node[childKey] = localizeNode(childValue, childKey, childContext(key, childKey, objectContext));
	}
	return node;
}

localizeNode(specification);
for (const pathItem of Object.values(specification.paths)) {
	for (const operation of Object.values(pathItem)) {
		if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
		operation.summary = operationSummaries[operation.operationId] ?? operation.summary;
		if (operation.tags) operation.tags = operation.tags.map((tag) => tagTranslations[tag] ?? tag);
	}
}
if (specification.components?.securitySchemes?.apiKeyHeader) {
	specification.components.securitySchemes.apiKeyHeader.description =
		'在管理员端“集成管理”中创建的系统唯一全权限 API Token。通过 `X-API-Key` 请求头传递；重新生成后旧 Token 立即失效。';
}

chineseHtml = chineseHtml.replace(specificationMatch[1], JSON.stringify(specification));
writeFileSync(chineseDocumentPath, chineseHtml, 'utf8');
