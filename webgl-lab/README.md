# WebAI Chemistry Lab · WebGL Prototype

一个基于 React + React Three Fiber 的最小化学实验台原型。

当前版本聚焦 3 个核心对象：
- 实验台
- 酒精灯
- 试管

目标不是一次做完整实验系统，而是先把最小可交互实验场景做稳：
- 灯和试管可移动
- 火焰可切换
- 热区判定成立
- 重置逻辑可靠
- 状态面板与真实状态一致
- 总体验收可自动跑通

## 当前状态

当前 5 个功能已经全部通过：

1. 火焰开关
2. 热区判定
3. 重置逻辑
4. 状态面板一致性
5. 总体验收

同时，项目已经具备最小可恢复的串行执行 flow：
- `flow:reset`
- `flow:run`
- `flow:status`

## 技术栈

- React 19
- TypeScript
- Vite
- React Three Fiber
- Drei
- Playwright

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：
- http://127.0.0.1:5173 或 Vite 当前输出端口

## 构建

```bash
npm run build
npm run preview
```

## 测试命令

### 单功能测试

```bash
npm run test:flame-toggle
npm run test:heat-zone
npm run test:reset-logic
npm run test:status-panel
```

### 总体验收

```bash
npm run test:e2e
```

### 串行 flow

```bash
npm run flow:reset
npm run flow:run
npm run flow:status
```

flow 说明见：
- `FLOW.md`

## 当前测试策略

项目测试分成两层：

### 1. 单功能测试
分别校验：
- 火焰开关
- 热区进出
- 重置恢复
- 状态面板一致性

### 2. 组合总验收
通过 `test:e2e` 把结构、交互、热区、边界状态、响应式一起串起来验证，避免“单项通过但组合失败”。

## 工程约定

### 1. 修复原则
- 优先局部修复
- 只改当前失败链路直接相关的代码
- 不为了“顺手更优雅”扩大重构范围
- 先让功能和验收通过，再考虑整理结构

### 2. 测试稳定性原则
- 不依赖脆弱的随机等待
- 关键断言前，优先等待真实状态落下
- 测试按钮走统一测试入口，避免散乱状态写入

### 3. 连续执行原则
- 每个功能独立验收
- 每步结果持久化
- 失败时优先区分环境问题和功能问题
- 组合链路必须最终回到总体验收闭环

## 版本管理

本目录继承上层仓库的版本管理语义，但维护自己的实现节奏。

### 版本继承规则
- **仓库级版本**：在上层 `WebAI-chemistry/README.md` 中维护，对外表达整个化学项目的阶段版本
- **子项目级版本**：本目录聚焦 `webgl-lab` 原型实现，跟随仓库主线演进，但不单独发散成另一套产品线
- 当 `webgl-lab` 发生重要阶段变化时，应同时做两件事：
  1. 更新本 README 的“当前状态 / 测试能力 / 工程约定”
  2. 在上层 README 增加或更新对应版本记录，说明这次阶段性变化属于哪个版本

### 提交规范
建议按改动性质提交，例如：
- `feat:` 新功能
- `fix:` 功能修复
- `test:` 测试稳定性或验收链修复
- `docs:` 文档更新
- `refactor:` 纯重构（仅在不改变行为时使用）

### 文档同步要求
出现以下情况时，README 必须同步更新：
- 新增或移除核心功能
- 测试命令发生变化
- flow 机制发生变化
- 当前版本阶段发生变化
- 工程约定发生变化

## 关键文件

- `src/App.tsx`：主场景与状态逻辑
- `src/App.css`：页面与场景外层样式
- `scripts/test-flame-toggle.mjs`：功能 1 验收
- `scripts/test-heat-zone.mjs`：功能 2 验收
- `scripts/test-reset-logic.mjs`：功能 3 验收
- `scripts/test-status-panel.mjs`：功能 4 验收
- `scripts/run-e2e.mjs`：功能 5 总体验收
- `scripts/feature-flow.mjs`：串行 flow runner
- `FLOW.md`：flow 机制说明

## 当前结论

这个原型已经从“单个测试能跑”推进到“5 个功能整链闭环通过”。

下一步如果继续扩展，建议优先考虑：
- 增加更真实的 3D 材质和实验反馈
- 增加更多器材与实验步骤
- 继续保持功能测试 + 总体验收 + flow 闭环这套机制
