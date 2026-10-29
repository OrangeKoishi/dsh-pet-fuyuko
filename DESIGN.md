# 黛冬优子桌宠（dsh-pet-fuyuko）设计稿 v0.1

> 状态：v0.2 —— 已按你的评审意见定稿（2026-10-25）。**尚未动工**。
> 目标宿主：DeepSeek Harness Web GUI（当前 `http://127.0.0.1:8728`，profile `desktop`）。

## 0.1 v0.2 变更摘要（本轮评审结论）

| 议题 | 结论 |
|---|---|
| 表情/动作清单 | **不扩充**，但把「表情清单」做成数据驱动的注册表，后续加一项只改 JSON，不动代码 |
| 一键压缩 | **做**：上下文快满时气泡里带「压缩一下」按钮，点击执行 `/compact` |
| 台词 | 采用本稿设计的一套，全部外置为 `lines.zh.json`，你随时可改（见 §3.4 与 `LINES.sample.md`） |
| 美术 | **只有单张静态图**，不做帧动画；渲染层支持「单图 + CSS 微动」；后续接图集是纯增量 |
| pet 面板 | **一期不做**（双击/右键都不跳设置页） |
| 出图 | 已验证本机 ComfyUI 可调用，见 §10；它只用来**生成/迭代素材**，不进运行时 |

---

## 0. 一句话

在聊天页右下角浮一个可拖动、可隐身的 Q 版黛冬优子：她跟着会话状态换表情，
点她会说话（「营业模式」↔「本体模式」两种人格），点「钱包」能看到 DeepSeek
开放平台的真实余额和本地估算的 token 花费，还能被投喂、被养成好感度。

---

## 1. 已验证的宿主事实（决定架构的部分）

| # | 事实 | 来源 |
|---|------|------|
| F1 | 帧级浮层槽位 `shell.overlay` 存在：`kind: list`、`scope: root`、**无 owner props**，位于三栏之上、滚动容器之外，图层本身 `pointer-events: none`，子项自行恢复指针事件 | `dsh-client-ui-layout/lib/client.js`（`overlayLayer`，`z-index: 20`） |
| F2 | `conversation.input.overlay` 是 `kind: list`、`scope: session`：注册在它上面的组件能直接拿到 `sessionId`、`useSession`、`useChat`、`useSessions`、`useProjection` | 同上 + `dsh-client-ui-chat/lib/types/client/contract/slots.d.ts` |
| F3 | 拖动手柄的 `z-index: 2`，浮层 `z-index: 20`，所以浮层在拖动手柄**之上**，不会被两侧拖拽条压住 | 同上 |
| F4 | 会话「正在思考 / 正在调用工具」的状态**不必自建**：`useChat` 快照里已有 `legacy.partial.turn/step`（流式输出中）、`legacy.runningCalls`（运行中的工具）、`nodes.values()`（找最近一条 `turn-error`），`useSession` 有 `running`、`lastAgentError` | `dsh-client-ui-chat/lib/types/client/contract/snapshot.d.ts`、`dsh-api-session-controller/lib/types/client/contract/snapshot.d.ts` |
| F5 | token 用量逐条挂在 assistant 消息上（含缓存读/写、推理），且带 provider/model —— 足以做本地花费估算 | `dsh-client-ui-conversation/lib/types/client/contract/records.d.ts`（`AssistantMessageNode.usage`） |
| F6 | DeepSeek 余额有官方接口 `GET https://api.deepseek.com/user/balance`，返回 `is_available` 与 `balance_infos[]`（`currency`/`total_balance`/`granted_balance`/`topped_up_balance`），需 `Authorization: Bearer <Platform Key>` | [DeepSeek API Docs · 查询余额](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/) |
| F7 | 顶点动画不能靠插值：`stretch` / `2step` / `2saw` 是**按参数摘选顶点集**的，必须预生成帧 | Live2D SDK Cubism 的变形器实现（阶段 2 才需要） |

**结论**：一期用「`shell.overlay` 渲染 + `conversation.input.overlay` 作无 UI 的会话数据桥」的
组合。这样既拿到了帧级定位（F1/F3），又拿到了会话状态（F2），且不替换任何宿主的槽位（零侵入）。

---

## 2. 架构

```
┌─ Node 半边（host）──────────────────────────────────────────┐
│ index.js     插件入口（apply）                              │
│   ├─ Config schema（settings 命名空间 pet-fuyuko）           │
│   ├─ 注册工具 pet_say（让模型主动让她说话）                  │
│   └─ ctx.inject(['apiGateway']??) 注册 RPC petFuyuko/balance │
│        └─ 读 key → 拉 /user/balance → 脱敏缓存 60s           │
├─ Browser 半边（client）──────────────────────────────────────┤
│ client.js                                                     │
│   ├─ register(shell.overlay, id='pet-fuyuko') → <PetLayer/>  │
│   │     └─ store: 位置/心情/模式/台词队列/设置               │
│   └─ register(conversation.input.overlay, id='pet-fuyuko-bridge')│
│         └─ 无 UI：把 { sessionId, running, call, partial,    │
│              error, usage } 发布进 store                     │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 为什么拆成两半

- `shell.overlay` 的 scope 是 `root`，拿不到当前会话；`conversation.input.overlay` 的 scope 是
  `session`，能拿到一切会话事实。桥接组件渲染 `null`，只做数据发布 —— 宿主没暴露「跨 scope 读会话」
  的公开 API，这是最合规的接法（不碰宿主源码、不偷 DOM）。
- 备选方案 B（把整套东西挂进 `conversation.input.overlay`，纯 CSS 偏移定位到右下角）：
  代码更少，但会跟着输入框一起移动，且输入框展开时会被覆盖。**不采用**，但作为 Fallback 保留，
  如果 `shell.overlay` 在某个版本被改掉，可以一天内切过去。

### 2.2 一期用的宿主 API（全部是公开契约）

- 槽位：`ctx.slots.register({ name: 'shell.overlay', id, order })`
- Hooks：`useSessions`（当前会话 id）、`useSession`（running / lastAgentError）、
  `useChat`（partial / runningCalls / nodes）、`useProjection('tokenUsage' | 'contextPressure')`
- 命令：`session.command('/compact')`（§3.9）
- 主题：`--dsw-alias-*` 系列 token（自动适配亮暗色），发丝线用 `.5px`
- 设置：settings 命名空间 `pet-fuyuko`

### 2.3 余额请求怎么从浏览器走到 Node（已核对宿主契约）

两条路，按可用性择一，都在 Node 半边执行、key 不出浏览器：

1. **首选：`ctx.webServer.register({ kind: 'exact', path: '/pet-fuyuko/balance' })`**
   —— 宿主 web 服务器本来就是给插件认领路由用的（`dsh-host-webserver` 明确写了「让功能插件认领各自的路由」）。
   前端 `fetch('/pet-fuyuko/balance')` 同源、无 CORS、无需 RPC 生成器。
2. **备选：Typert Remote（`ctx.typertGateway`）** —— 若日后要在 Electron IPC 载体下也统一走网关，
   再换成带类型描述符的 Remote 方法；接口签名保持一致，前端只换一行调用。

**安全**：路由只接受本机来源；返回体固定为
`{ ok, isAvailable, infos: [{ currency, total, granted, toppedUp }], fetchedAt }`，
任何情况下都不回显 key；错误只回 `{ ok: false, code: 'auth'|'rate'|'timeout'|'network' }`。

### 2.4 明确的「不做」

- 不读取、不解析 session 日志文件（一切状态走公开 hook）
- 不调 SDK / 不消费 `body` 之类的提示内容
- 不抓取页面 DOM、不注入全局 keydown
- 不改宿主包（`~/.dsh/profiles/node_modules` 只读使用）

---

## 3. 功能规格

### 3.1 摆放与显隐

- 默认锚定在聊天区**右下角**，距右 24px、距底 96px（避开输入框）。
- 拖动用 `pointerdown/move/up` + `setPointerCapture`，松手落点按 8px 网格吸附；
  位置存 `localStorage: dsh-pet-fuyuko:position`（= `left/bottom` 百分比 + 视口尺寸，窗口缩放时按比例复用）。
- 窗口级常驻：落地页、设置页也在（M0 定稿 —— 桌宠属于窗口，不属于某个会话；
  原设计的「无会话隐藏」在实测中让她整个消失，已废弃，见 M0-STATUS §3.5）。
- 隐身：右键菜单「隐身」或快捷键 `Ctrl+Shift+F`；`Ctrl+Shift+F` 再按一次唤回（全局监听挂在
  overlay 组件里，只在本窗口内生效）。
- 拖动时到边缘的 24px 内会放慢（避免甩飞），并在左右边缘播放「探头」表情。

#### 3.1.1 缩放（M0.1 已实现）

| 项 | 决定 |
|---|---|
| 手势 | 鼠标悬停在立绘上时 **Alt + 滚轮**；上滚放大、下滚缩小 |
| 范围 | 0.5×–2.5×，超出即夹住（再滚也不动，不会"卡死"在无响应） |
| 锚点 | **脚底中心**：放大时向上、向两侧对称生长，脚不离开地面 |
| 持久化 | `localStorage: dsh-pet-fuyuko:scale`，刷新后保持 |
| 边缘 | 缩放后重新夹回可视区，不会因放大而跑出屏幕 |
| 干扰 | 只认 `altKey`；普通滚轮照常滚动页面（不 `preventDefault`） |
| 反馈 | 右下角短暂显示百分比徽标（约 0.9s 后淡出） |
| 实现要点 | 原生 `addEventListener("wheel", …, { passive: false })`；React 的 `onWheel` 在根上是 passive，`preventDefault()` 会被忽略 |

### 3.2 状态机（表情驱动器）

```
                 ┌───────── reset(5s 无变化) ─────────┐
                 ▼                                    │
  idle ──(partial 出现)──▶ thinking ──(runningCalls 增加)──▶ working
   │                           │                              │
   │                           └──────(turn/end)──────────────┘
   ├──(mouseenter)──▶ curious ──(leave)──▶ idle
   ├──(click)──────▶ talk（台词持续 N 秒）
   ├──(drag)───────▶ dragged
   ├──(turn-error / lastAgentError)──▶ panic（最多停留 8s）
   ├──(余额 < 阈值 且 未查过)──▶ worried（一次性，冷却 30 分钟）
   └──(23:00-06:00 且 10 分钟无交互)──▶ sleep（被点醒：半眯眼 + 「……谁啊」）
```

优先级：`drag > talk > panic > sleep > working > thinking > curious > idle`。
表情一律被打断后**回到基线 idle**，不叠 buff。

### 3.3 点击互动

| 手势 | 行为 |
|------|------|
| 单击身体 | 随机台词；10% 几率切换「营业/本体」；「本体模式」下单击会先「哼」一声 |
| 单击呆毛 | 呆毛弹一下（`wiggle` 序列帧），台词偏傲娇 |
| 双击 | 打开「小钱包」气泡：余额 + 今日花费 + 今日 token |
| 右键 | 菜单：看余额 / 喂零食 / 换装 / 隐身 / 静音 / 设置 / 去 Straylight？ |
| 拖到屏幕边并停手 | 「探头」表情 + 「喂喂，出口在这边哦」 |
| 长按 1.2s（跨过拖动阈值，或从设定里关掉） | 「好感度」详情 |

### 3.4 人格：双模式与台词资产

- 默认**营业模式**（温柔、敬语、可爱、爱撒娇）。
- 「本体模式」：黑腹、吐槽、傲娇、嘴硬心软，短句。
- 台词资产 = **`lines.zh.json`（已按本稿写好 120 条，可直接改）**，结构：
  ```json
  { "id": "idle.omote.01", "kind": "idle", "mode": "omote|ura|both", "emotion": "smile",
    "text": "欢迎回来～今天也一起加油吧！",
    "weight": 1, "cooldown": 600, "once": false }
  ```
- 变量替换：`{称呼}` `{余额}` `{今日花费}` `{时长}` `{模型}`。
- 每行独立冷却（`cooldown` 秒，默认 600），同类「不重复上一条」。
- 节日行支持 `date: "12-04"` / `fromHour: 2` 这类条件，命中时优先。

沿用人设要点（官方简介：常保温柔笑容、看似清纯、喜欢可爱东西、擅长察言观色地讨人喜欢）：
数据取自 [闪耀色彩官方角色页](https://shinycolors.idolmaster-official.jp/idol/straylight/fuyuko/)。
**台词全部原创，不抄游戏/动画台词。**

**已交付的台词规模（`lines.zh.json`，120 条，已校验 id 唯一）：**

| kind | 营业 | 本体 |
|---|---|---|
| idle | 12 | 10 |
| think | 6 | 6 |
| work | 6 | 6 |
| panic | 4 | 4 |
| click | 15 | 15 |
| ahoge（呆毛） | 6 | 6 |
| balance | 6 | 4 |
| feed | 5 | 5 |
| festive | 4（生日 12/4、元旦、圣诞、深夜） | 同左（`both`） |

### 3.5 余额 & 花费（核心功能）

**A. 真实余额（DeepSeek 开放平台）**
- 用户第一次点「看余额」→ 如果没配 key，气泡变成引导卡：「把 Platform API Key 借我看看？」
  + 输入框（`type=password`）+「只保存在本机」说明 + 直达 platform.deepseek.com 的链接。
- Key 存于 `~/.dsh/settings.yaml` 的 `pet-fuyuko.apiKey`（0600，不写进会话日志、不回传模型）。
- 请求走 **Node 半边**，前端永远拿不到明文 key（只回 `{ ok, isAvailable, infos[] }`）。
- 缓存 60s；连续失败 3 次 → 30 分钟内不再自动请求，只显示「上次同步时间」。
- 脱敏：日志与错误信息里 key 一律 `sk-****`。

**B. 本地花费估算**
- 数据源（优先级从高到低）：
  1. `useProjection('tokenUsage')` —— 宿主 token-meter 的全会话投影，含 `uncachedInputTokens` /
     `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`，**不受分页与压缩影响**（已核对宿主类型）；
  2. 回退到 `useChat().nodes.values()` 里逐条 `assistant.usage` 的窗口口径求和。
- 价目表 `pricing.json`：按 `provider/model` 索引，字段 `input`、`inputCacheHit`、`output`（元/百万 token），
  未命中价格表的模型标红「价格未知」，不臆造数字。
- 今日 / 本次会话 / 本月三个口径，四舍五入到 0.01 元。
- 口径声明写进气泡的脚注：「按本地记录的 token × 价目表估算，和账单可能有出入」。

**C. 预算与提醒**
- 设置项 `lowBalanceThreshold`（默认 ¥10）：余额低于阈值时，她在气泡里提醒一次（冷却 30 分钟），
  并切「worried」表情。

### 3.6 养成：投喂 / 心情 / 好感

- `mood` 0–100，衰减每天 −3（离线超过 7 天只按 7 天计），上限 100。
- 喂食 +8，摸头 +2，每天首次点开算 +1。
- `affinity` 0–10 级，按「累计互动次数 + 连续在线天数」计算；每级解锁 1 条特殊台词
  + 1 套微动作（如 Lv5 开始会主动过来「戳」你一下）。
- 状态存 `localStorage: dsh-pet-fuyuko:state`（单一 JSON，带 `schemaVersion`，便于迁移）。
- 可「清零」：右键 → 设置 → 重置。

### 3.7 提醒

| 触发 | 表现 |
|------|------|
| `running` 且 > 90s 没有任何新 token / 工具事件 | 歪头 +「要不要我去看看？」（冷却 5 分钟） |
| `running` 且 > 10 分钟 | 「……这单好像有点久，我守着。」（冷却 30 分钟） |
| 上下文占用 > 80%（`useProjection`/token 统计可得时） | 「记忆快塞满了，要不要我帮你压缩一下？」+ **「压缩一下」按钮 → 执行 `/compact`**（见 §3.8） |
| 余额低于阈值 | 见 3.5-C |
| `turn-error` / `lastAgentError` | 慌张表情 + 可展开错误摘要（脱敏后前 120 字） |

**所有提醒遵循一个总闸**：单条提醒 30 分钟内不重复；同类同时只显示一条；静音模式下只换表情不弹气泡。

### 3.8 一键压缩（本轮新增）

- **入口**：上下文占用提醒气泡里的主按钮，以及右键菜单里的「压缩记忆」。
- **实现**：走宿主已有的公开通道 —— `ISession.command('/compact')`
  （`dsh-api-session-controller` 的 `command(line)` 是给 UI 用的正式入口，命令执行结果由宿主
  自己写进对话流，不需要我伪造任何事件）。
- **交互**：
  1. 点按钮 → 按钮进入 loading（`disabled` + 转圈），她切到 `work` 表情；
  2. 成功 → 气泡换成「好啦，清爽多了～」，2.5s 自动收起；
  3. 失败（命令未匹配 / 宿主拒绝）→ 气泡显示原因摘要 + 「重试」；
  4. **同一会话 30 秒内只允许触发一次**，防连点。
- **安全**：只在有活跃会话时可用；不读取压缩摘要内容，只关心成败。
- **不做**：不自动执行、不静默触发 —— 压缩会改变模型可见历史，必须由你亲手点。

### 3.9 截图分享（二期，暂缓）

右键菜单「拍一张」→ 用 `html-to-image`/`foreignObject` 把角色+气泡渲染成 PNG 并走宿主「交付物」下载
（`session-log-export` 已提供下载对话框实现，可参考其交互）。不伪造聊天界面。

---

## 4. 视觉与美术规格

### 4.1 形象要点（Q 版）

- 深色短发（及肩、可可黑/深棕），发梢内扣；**呆毛**是可点击的彩蛋热点。
- 大眼 + 高光；营业模式眼神柔和，本体模式眼角下压（不换发型，保持识别度）。
- 服装：简约的 Straylight 配色（深灰 + 青蓝点缀）日常便服即可，避免复刻任何官方立绘。
- 表情基线：`idle / smile / talking / think / work / panic / sleepy / worried / pout / blush`
  外加 `拖拽 / 探头 / 呆毛wiggle` 三组动作。

### 4.2 一期美术：**单张静态图 + CSS 微动**（本轮定稿）

现实约束：你只能提供单张图。所以一期**不依赖任何帧序列**，用「一图多态」把它做活：

| 状态 | 实现方式（全部 CSS，无帧） |
|------|--------------------------|
| idle | `translateY` 呼吸 4s + 极轻微 `rotate`（0.6°），`steps` 关掉用 `ease-in-out` |
| think | 呼吸变慢（6s）+ 整体上浮 2px + 头顶三颗「…」气泡依次淡入 |
| work | 呼吸更快（2.4s）+ 轻微左右摇摆；气泡显示转圈 |
| panic | 3 次 0.18s 的左右抖动（`keyframes shake`）+ 略微放大 |
| sleepy | 整体下沉 4px + 降饱和（`filter: saturate(.7) brightness(.95)`）+ 慢速呼吸 |
| pout | 向一侧歪 3° + 气泡 |
| 拖拽 | 跟随指针，`scale(1.04)` + 轻微倾斜（按水平速度） |
| 探头 | 贴边时只露半身（`clip-path` 或负 `translateX`） |

**关键设计：表情是一张注册表，不是硬编码。** `pet.json` 里：

```json
{
  "id": "fuyuko",
  "name": "黛冬优子",
  "anchor": "bottom-center",
  "scale": 1,
  "assets": {
    "base": "fuyuko.png",          // 一期只有这一张
    "optional": {                   // 有就覆盖，没有就用 base
      "think": "fuyuko-think.png",
      "sleepy": "fuyuko-sleepy.png"
    }
  },
  "motions": {                      // 后续加帧动画：在这里声明帧序列即可，代码不用改
    "idle": { "kind": "css", "preset": "breathe" },
    "think": { "kind": "css", "preset": "float" }
  }
}
```

渲染层规则（`SpriteRenderer`）：
1. 若 `motions[state].kind === 'frames'` → 播放图集帧（二期能力，先留空实现）；
2. 否则若 `motions[state].kind === 'css'` → 套预设 CSS 类；
3. 否则若 `assets.optional[state]` 存在 → 交叉淡入该静态图 + `idle` 微动；
4. 否则 → 只换微动，不换图。

所以「后续升级接口」就是：**加一张 PNG / 加一段帧配置，不用动一行逻辑**。
表情的枚举也来自注册表，代码里不写死 `if (state === 'think')`。

### 4.3 技术规格（你按这个交图最省事）

- 格式：PNG，RGBA，透明底。
- 画布：**512×512**，人物占满高度，**脚底（或最低点）贴画布底边**，水平居中。
- 一张就够；若以后补表情，同名规则：`fuyuko-<state>.png`（如 `fuyuko-think.png`）。
- 你给的图我会自动做一遍：裁边 → 等比缩放 → 脚底锚点归一化 → 边缘羽化
  （`tools/asset/keyout_white.py` 已实现并验证，随仓库分发）。
- 若你给的是绿幕图，`tools/asset/keyout.py` 自动抠图；边缘残留会做去绿边（despill）。

### 4.4 渲染与性能

- 静止时只有一条 CSS `animation`（`transform` 合成层），**不跑 rAF**。
- 拖动用 `transform: translate3d`，不触发重排；拖动期间才临时提升 `will-change`。
- `visibilitychange` 隐藏时暂停 CSS 动画（`animation-play-state: paused`）。
- `prefers-reduced-motion: reduce` → 只保留透明度变化，去掉呼吸/抖动/摇摆。

---

## 5. 数据与存储

| 位置 | 内容 | 说明 |
|------|------|------|
| `~/.dsh/settings.yaml` → `pet-fuyuko` | `apiKey`、`enabled`、`muted`、`scale`、`mode`、`lowBalanceThreshold` | 可被宿主设置页看到 |
| `localStorage: dsh-pet-fuyuko:state` | 位置、mood、affinity、计数、冷却表 | 只在本浏览器 |
| `localStorage: dsh-pet-fuyuko:cache` | 余额缓存 `{ at, payload }` | 60s 有效 |
| 包内 `pets/fuyuko/` | 图集、台词、价目表 | 可替换 |

**隐私红线**：key 只在 Node 半边使用；任何经过模型上下文的内容（工具返回、日志）都不得包含 key；
`pet_show_balance` 工具只返回「已获取/未配置」与金额，不返回 key。

---

## 6. 插件工程形态

```
dsh-pet-fuyuko/
  package.json        # type:module; exports: ".", "./client"; dsh: { client: { platform:"web" } }
  lib/index.js        # Node 半边：静态资源路由（M0 已实现）；余额路由 / pet_say 工具留到 M3
  lib/client.js       # Browser 半边：shell.overlay 注册 + PetLayer
  pets/fuyuko/        # ✅ 已建：pet.json + fuyuko.png（单张静态图）
  lines.zh.json       # ✅ 已建：120 条台词
  pricing.json        # 待建：价目表
  test/               # 4 个自测 + 可视化验收台
```

挂载方式（不动宿主，只动本机 profile 的 patch 层）：
```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml 末尾追加，路径换成你的克隆位置
- insert:
    - id: pet-fuyuko
      name: 'file:///path/to/dsh-pet-fuyuko/lib/index.js'
      config:
        enabled: true
        scale: 1
```
开发期用 `--patch` 覆盖层 + 客户端 HMR 接收器（需要同时跑 `pnpm run dev:web` 才能热更客户端 bundle；
不跑则改完要刷新页面）。**发布形态**另有：打成 npm 包走 `dsh plugin add`。

---

## 7. 里程碑

| 阶段 | 产出 | 验收 |
|------|------|------|
| **M0 · 骨架**（0.5 天） | 空壳插件：右下角一张静态图，可拖动、位置持久化、`shell.overlay` 注册跑通 | 刷新后位置不丢；不遮挡输入框 |
| **M1 · 状态机**（1 天） | 桥接组件发布会话事实；`SpriteRenderer` + 注册表驱动状态；调试面板可强制状态 | 发一条长任务能看到 think→work→idle；**换一张图/加一条 motion 配置不用改代码** |
| **M2 · 人格**（1 天） | `lines.zh.json` + 冷却 + 双模式切换 + 气泡排版（圆角、小尾巴、`--dsw` 主题 token） | 点 20 次台词不重样、两种模式明显不同；你改 JSON 后刷新即生效 |
| **M3 · 钱包**（1.5 天） | RPC + key 配置 + 余额缓存 + 花费估算（`tokenUsage` 投影）+ 气泡卡片 + 预算提醒 | 真机配 key 后 3 秒内出余额；key 不出现在任何日志 |
| **M4 · 养成 & 提醒 & 压缩**（1.5 天） | mood/affinity、喂食、长任务/上下文/余额提醒、**一键 `/compact`**、静音 | 提醒不刷屏；压缩按钮有 loading/成功/失败三态且防连点 |
| **M5 · 美术接入 & 打磨**（0.5 天） | 换成你的单张图、边缘探头、reduced-motion、性能回归 | 空闲 CPU 占用可忽略；拖动 60fps |
| **Phase 2**（可选） | 图集帧动画 / Live2D Cubism（呼吸、眨眼、视线跟随、物理呆呆毛） | 见 §9 风险 |

**注意**：M5 从 1 天缩到 0.5 天，因为一期没有帧动画；素材归一化脚本已经写好并验证过。

---

## 8. 验收清单（一期）

- [x] **M0** 窗口级常驻：`shell.overlay` 注册、拖动、位置持久化、单图渲染、呼吸微动
- [ ] 隐身与唤回（右键菜单，M2）
- [ ] 状态优先级正确；打断后回到 idle
- [ ] 营业/本体台词明显不同，且同一句不连续重复
- [ ] **只给一张 PNG 也能跑**；补第二张 `fuyuko-think.png` 自动被识别，无需改代码
- [ ] 余额获取失败时给出可读原因（401 / 429 / 超时），不崩溃
- [ ] key 不出现在：会话记录、工具结果、浏览器 console、错误气泡
- [ ] 一键压缩：loading → 成功/失败提示，30 秒内不可重复触发
- [ ] `prefers-reduced-motion` 与静音模式生效
- [ ] 卸载插件后无残留（槽位、计时器、localStorage 可选清理）

---

## 9. 风险与应对

| 风险 | 应对 |
|------|------|
| `shell.overlay` 是「刻意通用」的列表槽，宿主升级若改动定位策略，桌宠可能位置漂移 | 把「绝对定位层」抽象成 `PetSurface`，换成 `conversation.input.overlay` + 固定偏移只需改一个文件 |
| 跨 scope 读会话依赖桥接组件 | 桥接组件只读公开 hook；若日后宿主提供 root 级会话观察器，直接删掉桥接 |
| 单张静态图容易「死板」 | 用 CSS 微动 + 表情图可选覆盖 + 气泡节奏补足；真觉得不够再上 Phase 2 |
| `/compact` 会改变模型可见历史 | 只由用户点击触发，绝不自动；失败有明确反馈 |
| **版权**：角色形象属于 Bandai Namco Entertainment | 素材仅本地个人使用；**不分发含官方形象的包**。公开发布只发代码 + 占位形象 |
| Live2D 的 warp / rotation deform 必须预计算 | 阶段 2 用 Cubism SDK 烘焙，或换 Spine；一期不碰 |
| key 误落进会话上下文 | Node 侧工具返回值只含金额；日志统一 `redact()`；发布前加一条 grep 检查 |
| 余额接口有调用频率限制 | 60s 缓存 + 退避；只在她「被问」时拉取，不做后台轮询 |

---

## 10. ComfyUI 出图链路（本机实测记录，2026-10-25）

**结论：能调用，已跑通端到端。** 但它只用于**离线生成/迭代素材**，运行时插件**不依赖它**。
下面这节是当时那台机器的实测数据，**不随仓库分发任何脚本**（只留结论和坑位供参考）。

### 10.1 环境实测结果

| 项 | 值 |
|---|---|
| 安装 | 秋葉整合包（ComfyUI-aki）v3.2，自带 Python |
| 版本 | ComfyUI 0.30.2，前端 1.47.12 |
| Python | 3.13.11（整合包自带的，**不要用系统的**） |
| Torch | 2.13.0+cu130，`torch.cuda.is_available() = True` |
| GPU | RTX 4070 Laptop，8188 MB VRAM（实际可用 ~7.4 GB） |
| 启动方式 | `python.exe ComfyUI\main.py --port 8188`（**必须先 `--disable-all-custom-nodes`**，见 10.3） |
| 出图耗时 | 768×1024 / 18 步 ≈ **50 秒/张**；1024×1024 / 20 步 ≈ 60 秒 |
| 可用底模 | `NewBie-Image-Exp0.1-bf16`（动漫向）+ `ae.safetensors` VAE + Gemma3/Jina CLIP（`type: newbie`） |

### 10.2 已验证的调用脚本（本地出图流水线，未随本仓库分发）

| 脚本 | 作用 | 实测 |
|---|---|---|
| `test_comfy.py` | 最小文生图，打印耗时与产物名 | ✅ 58.6s 出图 |
| `batch.py` | 读 `jobs-*.json` 批量出图 | ✅ 2 张连续跑通 |
| `keyout.py` | 绿幕 → 透明 → 脚底锚点 256 画布 | ✅ 半透明边缘无绿边（绿偏差 max 12） |
| `cutout_all.py` | 批量抠图 + 棋盘预览拼图 | ✅ |
| `split_sheet.py` | **2×2 表情拼图自动切 4 张**（按连通域） | ✅ 4 张，全部居中贴底 |

**这条链路解决了你的「只有单张图」问题的一半**：你可以让我一次生成一张 2×2 表情拼图，
`split_sheet.py` 自动切成 4 张独立透明 PNG，直接落进 `pets/fuyuko/` 的命名规则。

### 10.3 踩过的坑（都已在脚本/文档里规避）

1. **`raw.githubusercontent.com` 不通** → ComfyUI-Manager 启动时会去拉注册表，卡住十几分钟甚至启动失败。
   **对策：加 `--disable-all-custom-nodes` 启动**（出图不需要任何自定义节点；本机 RMBG/Impact 等节点
   在没有模型文件时也用不上）。若确实需要 Manager，可挂 `HTTP_PROXY=http://127.0.0.1:7890`（已实测代理可用）。
2. **`user` 目录写权限** → 整合包的 `ComfyUI\user` 在沙箱下不可写，Manager 缓存写失败会反复重试。
   **对策：`--user-directory <工作区内目录> --temp-directory <工作区内目录>`**。
3. **`transparent-background` 包**（InSPyReNet 抠图）：
   - 默认把模型缓存写到 `C:\Users\<你>\.transparent-background`，沙箱下 `PermissionError`
     → 设 `TRANSPARENT_BACKGROUND_FILE_PATH` 到工作区；
   - numba 缓存也会炸 → 设 `NUMBA_CACHE_DIR`；
   - 首次要联网下 367 MB 权重 → 需要代理。
   **结论：能用，但太重。一期用绿幕 + 自写 chroma key（快、零依赖、效果已达标）。**

### 10.4 素材生产 SOP（推荐工作流）

```
1. 我写 prompt（含角色一致性锚点：发色/呆毛/服装/画风）
2. batch.py 出 2×2 表情拼图（1024×1024，纯绿幕，无阴影）
3. split_sheet.py 自动切 4 张 → 256×256 透明、脚底锚点
4. 你肉眼验收（看 contact-sheet.png）
5. 不满意 → 改 prompt 重跑；满意 → 落进 dsh-pet-fuyuko/pets/fuyuko/
```

**角色一致性**：目前是「同一段外观 tag 描述 + 同一 seed 族」，跨批次会有漂移。
若你要求高度一致，二期可加 IPAdapter（本机已有 `ComfyUI_IPAdapter_plus` 节点，但缺模型文件）。

---

## 11. 本轮已定稿（原待确认项）

1. ~~表情/动作清单还要不要加~~ → **不加**；改为数据驱动注册表，后续加一项只改 JSON。
2. ~~上下文提醒要不要带一键压缩~~ → **要**，见 §3.8。
3. 本体模式吐槽力度 → **先按「嘴毒但不人身攻击」实现**，台词在 `lines.zh.json` 里，你随时可调重口程度。
4. 图集规格 → **改成单张 512×512 透明 PNG、脚底锚点**；多表情按 `fuyuko-<state>.png` 命名即可。
5. ~~双击打开 pet 面板~~ → **一期不做**。


