# InfluxDB 3 UI - 跨平台 InfluxDB 3.x 查询工具

## 一、项目概述

打造一款类似 Navicat 的 **跨平台 InfluxDB 3.x 桌面客户端**，本地单人使用，帮助开发者通过图形化界面连接 InfluxDB 3.x、浏览数据结构、编写 SQL 并查看结果。

- **产品定位**：InfluxDB 3.x 专用桌面 GUI 客户端（**不兼容 1.x / 2.x**）
- **目标用户**：使用 InfluxDB 3.x 的开发者、运维、数据分析师
- **使用模式**：**纯本地单机**，无登录、无云端同步

## 二、目标平台

| 平台 | 支持情况 |
| --- | --- |
| macOS | ✅ 一级支持（Intel + Apple Silicon） |
| Windows | ✅ 一级支持（x64） |
| Linux | ⏳ 后续考虑 |

## 三、技术栈

### 3.1 选型总览

采用 **Tauri 2 + Rust + React** 方案。Tauri 打出的产物是离线原生桌面应用（`.dmg` / `.app` / `.msi` / `.exe`），Web 前端仅作为界面渲染层，所有逻辑在本机运行，与云服务无关。

Rust 生态对 **Arrow Flight / FlightSQL（InfluxDB 3.x 的查询协议）** 支持最完善，因此后端选 Rust 而非 Go。

### 3.2 选型明细

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 桌面壳 | **Tauri 2** | Rust 实现，调用系统 WebView，包体小（~5MB 起）、内存占用低 |
| 业务层 | **Rust (stable)** | 查询调度、Keychain 读写、配置持久化 |
| InfluxDB 客户端 | **`influxdb3-client`** (官方 Rust crate) | 负责写入与管理 API |
| 查询协议 | **Apache Arrow Flight / FlightSQL** via `arrow-flight` crate | InfluxDB 3.x SQL 查询走 gRPC + Arrow |
| 前端框架 | **React 18 + TypeScript + Vite** | UI 渲染层 |
| UI 组件 | **shadcn/ui + Tailwind CSS + Radix UI** | 桌面紧凑风格，样式完全可控 |
| 代码编辑器 | **Monaco Editor** | VS Code 同款，SQL 高亮/补全开箱即用 |
| 结果表格 | **AG Grid Community** | 百万行虚拟滚动 |
| 图表 | **ECharts** 或 **uPlot** | 时序数据折线图 |
| 状态管理 | **Zustand** + React Query | 轻量、桌面应用够用 |
| 构建 / 打包 | **Tauri CLI** | 产出 `.dmg` / `.app` / `.msi` / `.exe` |

## 四、连接管理

### 4.1 连接配置字段（InfluxDB 3.x）

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 连接名称 | 是 | 用户自定义，便于识别 |
| Host | 是 | InfluxDB 3.x 服务地址，如 `localhost` 或 `https://xxx.cloud` |
| Port | 是 | 默认 `8181`（InfluxDB 3 Core/Enterprise 默认），Cloud 走 443 |
| Token | 是 | InfluxDB 3.x API Token |
| Database | 否 | 默认数据库，可在使用时切换 |
| 启用 TLS | 否 | 自动根据 scheme 推断，也可手动开关 |

> InfluxDB 3.x **没有 Org 概念**，资源模型是 `Database → Table → Column`。

### 4.2 连接管理能力

- 新增 / 编辑 / 删除 / 复制连接
- 测试连接（点击按钮即时校验 token 与可达性）
- 连接列表持久化：
  - 非敏感字段存 `~/.influxdb3-ui/connections.json`
  - Token 存系统 Keychain（macOS Keychain / Windows Credential Manager），通过 `keyring` crate 统一访问
- 多连接同时打开，每个连接独立 Tab

## 五、核心功能

### 5.1 资源浏览（左侧树）

```
Connection
└── Database
    └── Table
        ├── Columns (name + type + tag/field 标识)
        └── 索引/分区信息（若可得）
```

右键菜单：刷新、复制表名、在查询编辑器中生成 `SELECT *` 模板。

### 5.2 查询编辑器

- **SQL**（主，InfluxDB 3.x 推荐）
- **InfluxQL**（次，InfluxDB 3.x 仍保留兼容）
- 功能：
  - Monaco 语法高亮、关键字补全、表名/列名补全（从元数据拉取）
  - 多 Tab，多查询并行执行
  - 查询历史（本地 SQLite 保存）
  - 快捷键执行 `Cmd/Ctrl + Enter`
  - 执行耗时、返回行数显示

### 5.3 结果展示

- **表格视图**（默认，AG Grid 虚拟滚动）
- **JSON 视图**
- **图表视图**（折线图，自动识别 `time` + 数值列）
- 导出 CSV / JSON / Parquet（Parquet 直接利用 Arrow）

### 5.4 其他

- 连接配置导入 / 导出（JSON，token 不导出，需重新输入）
- 浅色 / 深色主题切换（跟随系统）
- 应用内更新提示（可选，基于 Tauri Updater）

## 六、非功能需求

| 维度 | 目标 |
| --- | --- |
| 性能 | 百万行结果集虚拟滚动流畅；查询流式读取 Arrow Stream，不一次性加载全量 |
| 安全 | Token 仅存系统 Keychain；日志不打印 token |
| 包体积 | 单平台安装包 < 20MB |
| 启动时间 | 冷启动 < 2s |
| 离线 | 除查询 InfluxDB 本身外，应用 100% 离线可用 |

## 七、里程碑

| 阶段 | 目标 | 预估 |
| --- | --- | --- |
| M1 - 脚手架 | `npm create tauri-app` + React + TS + Tailwind + shadcn/ui；跑通 mac/win 构建 | 0.5 周 |
| M2 - 连接管理 | Rust 端实现 FlightSQL 连接 + Keychain 存 token；前端连接列表 + 测试连接 | 1 周 |
| M3 - 资源浏览 | Database / Table / Column 列表（查询 `information_schema`） | 1 周 |
| M4 - 查询执行 | Monaco SQL 编辑器 + AG Grid 结果表；Arrow Stream 分批渲染 | 1.5 周 |
| M5 - 体验优化 | 多 Tab、查询历史、主题、导出 CSV/JSON/Parquet、图表视图 | 1 周 |
| M6 - 打包发布 | mac 签名公证（Apple Developer ID）、Windows 签名、Tauri Updater | 0.5 周 |

合计约 **5.5 周**。

## 八、关键技术风险与预案

| 风险 | 影响 | 预案 |
| --- | --- | --- |
| `influxdb3-client` crate 尚处早期，功能不全 | 部分管理 API 不可用 | 查询走 `arrow-flight` 直连 FlightSQL；管理 API 直接 HTTP 调用 |
| macOS 签名公证流程较繁琐 | 发布延期 | M1 阶段就把公证跑通（哪怕是空壳应用） |
| Arrow JS 包体积偏大 | 影响前端加载 | 按需引入；表格层避免反复拷贝，直接消费 Arrow RecordBatch |

## 九、已确认事项

- ✅ 仅支持 **InfluxDB 3.x**，不兼容 1.x / 2.x
- ✅ 前端框架：**React + shadcn/ui**（由开发方决定）
- ✅ **本地单人使用**，无登录、无云端同步
- ✅ 连接方式：**Host + Port + Token**（3.x 无需 Org）
