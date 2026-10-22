# JMeet Frontend

This is the frontend of JMeet: an Angular application using **ng-zorro-antd** as the component library, with a vendored video-conference component layer (see 组件规范 below).

## 组件规范（Component Decision Rule）

所有新增/修改的 UI 组件按以下规则选型，review 按此卡点（统一性由 token 层保证，而不是由组件库品牌保证）：

```
nz 有对应组件？   → 直接用 nz（nz-select / nz-input / nz-modal / nz-dropdown…）
                    存量原生 HTML 控件（select/input/textarea）已清理完毕，禁止新增。

nz 有底层原语？   → 基于原语封装（例：工具栏分体按钮 = nz-dropdown + 自绘两段按钮；
                    菜单投影 = 自定义触发器 + nz-menu）。

nz 完全没有？     → 自研组件（视频瓦片 / 智能布局 / 字幕浮层 / 会议 chrome），但必须：
                    ① 样式只消费 --jmeet-* / --im-* token（禁止裸色值，豁免须注明
                       design-system-allow-hardcoded）；
                    ② 尺寸/圆角/focus 环对齐 nz 视觉语法（36/44px 控件高、token 圆角、
                       --jmeet-focus-ring）；
                    ③ 暗色经 body.meeting-theme-dark 的 token 重映射适配（会议内）；
                    ④ 命名不得带 nz- 前缀（诚实标注自研，nz 前缀预留给真 ant 组件）。
```

背景：会议室是三层混合体系——ng-zorro 元件层（图标/提示/菜单/弹窗/标准控件）、
vendored OpenVidu 视频核心（ov-*，自研样式）、JMeet chrome 层（jmeet-*）。
视频域高频渲染（N 人会议 = N 瓦片 × 多个子元素），组件库实例开销不划算，
轻量自研 + token 对齐是刻意选择，勿"为统一而全量 nz 化"。

## How to run

For running the frontend you need to have installed [Node.js](https://nodejs.org/). Then you can run these commands:

```bash
pnpm install
pnpm run dev
```

This starts the Angular dev build (watch mode). In this workspace the app is served by the
backend at http://localhost:6080/meet/ (backend serves `meet-ce/backend/public/frontend`).

## How to build

For building the frontend you can run the following command:

```bash
pnpm install
pnpm run build:prod
```
