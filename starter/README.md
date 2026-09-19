# 光影志 · 摄影师作品集 + 离线选片台

React + TypeScript + Vite。包含两部分：

1. **作品集站点**：首页 `/`、作品集 `/work`、系列详情 `/work/:seriesId`、关于 `/about`、联系 `/contact`，以及全局共享灯箱组件。
2. **离线选片与成套留痕台**：选片台 `/review`（校样墙 + 逐张复核 + 锁定成套 + 版本留痕）、跨系列比较 `/compare`。全部数据存于浏览器 localStorage，离线可用。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览生产构建
npm test           # 状态规则层单元测试（vitest）
node e2e-verify.mjs  # 浏览器端到端验证（需 dev server 已启动）
```

## 选片台架构：规则 / 存储 / 界面三层分离

```
src/selection/
├── types.ts     # 领域模型：MarkRecord / SetVersion / SelectionState
├── rules.ts     # 状态规则（纯函数，不依赖 React / localStorage / 数据源）
├── storage.ts   # 记录存储（localStorage 读写 + 读回校验，不依赖 React）
└── SelectionContext.tsx  # 界面桥接：把 rules 的纯函数与 storage 的落盘接进 React
```

### 状态规则（rules.ts）

- **唯一标记**：每张照片至多一条 `MarkRecord`（入选 / 待复核 / 排除）。
- **重复提交沿用首次结果**：提交与当前相同的标记是空操作，状态原样返回，`markedAt` 不变。
- **锁定门槛**：`lockReadiness` 要求系列内全部照片已标记且无「待复核」，否则 `lockSet` 不产生任何记录。
- **失效即留痕**：锁定后任何标记改动（含清除）让该系列当前有效版本立即变为 `invalidated` 并记录时间与原因；历史版本（含快照）只增不删，旧版永远可查。
- **比较只读当前标记**：`compareSeries` / `liveTally` 只统计 `state.marks`（当前有效标记），版本快照在任何分支都不进入统计。

### 记录存储（storage.ts）

- `photolog.selection.v1`：标记 + 成套版本，任何变更立即落盘。
- `photolog.ui.v1`：/work 分类筛选、选片台的系列 / 标记筛选 / 片序 / 复核模式。
- 读回一律经 `rules.normalizeSelection` 校验，损坏数据回退为空状态。
- 刷新后筛选、片序与锁定状态与刷新前一致。

### 界面（pages / components）

- `/review`：校样墙（默认按 photos.json 的 `order` 片序展示，可切换分组优先序）、标记筛选、锁定按钮（附缺口提示）、成套状态横幅、版本留痕（可展开快照）。
- `/review` 逐张复核模式：单张照片 + 大标记按钮 + 打标后自动前进；窄屏首次访问默认进入该模式，移动端可逐张过片。
- `/compare`：三系列当前标记计数、进度与成套状态对照。

## 验证

- `src/selection/rules.test.ts`：20 条单元测试覆盖上述全部规则。
- `e2e-verify.mjs`：60+ 项浏览器断言，覆盖作品集 7 条耦合约束与选片台全部新需求（含刷新持久化、移动端逐张复核）。
- `../tests/`：任务包自带的标准化验收套件（Playwright），当前 12/12 通过。
