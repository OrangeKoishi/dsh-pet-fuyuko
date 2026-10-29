# M3 完成报告 · 钱包

日期：2026-10-29 · 宿主：DSH 0.2.1-rc.3 · Web UI

---

## 1. 结论

**M3 完成。** 她现在知道你有多少钱，也知道自己花了你多少钱 —— 而且**两件事严格分开**：

```
✅ 真实余额：host 半边直连 api.deepseek.com，key 不出 Node 进程
✅ 本地花费估算：token 投影 × 价目表，分高峰/空闲两档
✅ 小钱包卡片：双击 / 右键菜单打开，主题色、小尾巴、自动避让边缘
✅ 没配 key 时给引导卡：密码框 + 「只保存在本机」说明 + 官方链接
✅ 余额低于阈值 → worried 表情 + 一次性提醒（30 分钟冷却）
✅ 报错有可读原因：401 / 429 / 超时 / 网络，不崩、不猜
```

验收：真实浏览器 **30/30**（含一次真实的 DeepSeek 往返）、`npm test` 六套全绿。

## 2. 核心设计：余额与花费是两件事

| | 余额 | 花费 |
|---|---|---|
| 来源 | DeepSeek 官方 `GET /user/balance` | 本地 token 记录 × `pricing.json` |
| 谁算 | 服务端算好，本插件只转发 | 浏览器自己估 |
| 准不准 | 权威 | **估算**，卡片上明说 |
| 拿不到时 | 显示原因，不显示数字 | 价格未知就只说 token |

这张表决定了实现：**余额永远不参与任何计算**，花费永远不冒充账单。

## 3. 安全模型（key 不出进程）

这是 M3 唯一有真实风险的部分，逐条说明。

### 3.1 key 存哪

`~/.dsh/pet-fuyuko/credentials.json`，`0600`，原子写（临时文件 + rename），
**不是** `~/.dsh/settings.yaml`。

理由：
- `settings.yaml` 是用户会编辑、会复制、会贴进 issue 的文档，账单 key 不该躺在那里；
- 本插件是 `file:` 挂载、没有 `node_modules`，**无法 import schemastery**，
  也就无法合规注册 settings 命名空间 —— 硬塞进去只会得到一个非法配置项。

### 3.2 key 怎么进出

| 操作 | 路由 | 返回 |
|---|---|---|
| 写 | `POST /pet-fuyuko/key` | `{ ok, configured }` —— 从不回显 |
| 查状态 | `GET /pet-fuyuko/key` | `{ ok, configured: boolean }` —— **只有布尔值** |
| 清除 | `DELETE /pet-fuyuko/key` | 重新读文件后如实报告 `configured` |
| 用 | `GET /pet-fuyuko/balance` | 金额，**从不含 key** |

写入前做格式校验（`^sk-[A-Za-z0-9_-]{8,}$`），格式错就 400，
不用等到第一次查余额才吃一个莫名其妙的 401。

### 3.3 挡掉跨站

服务器只绑 loopback，但**用户浏览器里的任何网页都能访问 `127.0.0.1:<port>`**。
所以：

- `Origin` 存在且与本机不同 → 403（余额与 key 路由都挡）；
- 写 key 必须是 `content-type: application/json` → 跨站请求会先发 CORS 预检，而本路由不应答预检，浏览器自己就拦了；
- 请求体限 8KB，超了 413。

### 3.4 日志与界面

- 日志只写 `sk-****`（`maskKey` 对任何长度都返回同一个常量，连前缀长度都不泄露）；
- 界面上 key 只在 `<input type="password">` 里存在，存完立刻清空草稿；
- 余额错误只回 `auth | rate | timeout | network | nokey`，**不回传上游原始 body**（那里面可能带 request_id 甚至片段）。

实测（浏览器里全量扫描 `document.body`）：页面文本与 HTML 里**没有任何 `sk-` 开头的串**。

## 4. 花费估算

### 4.1 价目表（`pricing.json`，可改）

官方价格是**双档**的，这点很容易漏：

| 模型 | 时段 | 输入(未命中) | 输入(命中) | 输出 |
|---|---|---|---|---|
| deepseek-flash | 空闲 | ¥1 | ¥0.02 | ¥4 |
| deepseek-flash | 高峰 | ¥2 | ¥0.04 | ¥8 |
| deepseek-v4-pro | 空闲 | ¥4.5 | ¥0.15 | ¥13.5 |
| deepseek-v4-pro | 高峰 | ¥9 | ¥0.3 | ¥27 |

> 高峰 = 北京时间**周一至周五 09:00–12:00、14:00–18:00**（不含法定节假日）；
> 其余时段含周末全天为空闲，**空闲价正好是高峰价的一半**。
> 来源：<https://api-docs.deepseek.com/zh-cn/quick_start/pricing>（2026-10-29 抓取）

所以判定高峰**必须按北京时间的墙上时钟**，不能按浏览器本地时区 —— 用
`Intl.DateTimeFormat({ timeZone: "Asia/Shanghai" })` 读，测试里用 UTC 构造北京时间逐一验证。

### 4.2 token 从哪来

`useProjection('tokenUsage')`（宿主 token-meter 的全会话投影），四个桶：
`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`。

**缓存写入按「未命中」计价** —— 官方价目表没有第三个档位，凭空造一个就是臆造。

### 4.3 模型怎么认

`tokenUsage` 是会话级总量，**不带 provider/model**，而价格是按模型分的。
所以从最新一条 assistant 消息的 `provenance.model` 取（公开字段）。

真实会话里它长这样：`deepseek-v4.1-flash-sg` —— 而价目表里的 id 是 `deepseek-flash`。
所以有 `aliases` 表 + 大小写无关 + 前缀匹配，三层兜底。**没命中就显示「价格未知」，绝不猜。**

### 4.4 「今天花了多少」怎么算

投影只给会话累计值，没有日期边界。所以浏览器维护一个**按天的小账本**：

```json
{ "days": { "2026-10-29": { "uncachedInputTokens": 184000, ... } },
  "sessions": { "<id>": { ...该会话上次看到的累计值... } },
  "models": { "<id>": "deepseek-v4.1-flash-sg" } }
```

每次投影变化，用**差值**推进当天累计：`delta = 本次累计 − 上次累计`。

这样刷新页面（重放同一个累计值）差值就是 0，**不会重复计费**；
会话被改写导致累计值变小时按「新基线」处理，**不会算出负数**。
账本保留 40 天，超期自动裁掉。

## 5. 实测证据

### 5.1 自测（`npm test`，6 个文件全绿）

新增 `test/wallet.test.mjs`，20 组断言：

| 组 | 覆盖 |
|---|---|
| 1–2 | 出厂价目表合法；**空闲价必须是高峰价的一半**；单档模型自动复用；畸形模型被丢弃 |
| 3 | 别名 / 大小写 / 前缀匹配；未知模型返回 null（不猜） |
| 4 | 高峰判定按北京时间：09:00 含、12:00 不含、午休不算、周末全天不算 |
| 5 | 计价算术：缓存写按未命中；空闲正好是高峰一半；缺失桶算 0 不产生 NaN |
| 6 | 取整与格式化（含浮点边界的老实说明） |
| 7 | 未知模型 `known: false`，cost 恒为 0 |
| 8–9 | 账本按差值推进、重放不重复、累计变小不记负、跨天分桶、持久化与迁移 |
| 10 | 日期键按本地日历、补零 |
| 11 | 卡片布局：无数据不编零、低于阈值标红、无 key 是状态不是错误、未定价只报 token |
| 12 | 五种错误码都有可读文案 |
| 13 | **相等的桶集不触发通知**（否则每个投影帧都会重渲染） |
| 14 | 模型归属取最新消息，顺序无关，缺字段降级 |
| 15–17 | key 脱敏、上游响应映射、同源守卫 |
| 18 | 五条路由都注册；`package.json` 仍不可达；凭据路径不在 settings 里 |
| 19 | **卡片用自己的宽度夹取**（见 §6.1 的回归） |
| 20 | 双击窗口常量合理 |

`live-server.test.mjs` 新增 10 条真实 HTTP 断言，其中两条专门盯崩溃（见 §6.2）。

### 5.2 真实浏览器（30/30）

`test/harness-server.mjs` 现在**挂的是真的 host 半边** —— 它把 `lib/index.js`
按 DSH 的方式 import，用同样的 `{kind, path, handler}` 契约挂到真实 `node:http` 上。
所以钱包连的是真的 `/pet-fuyuko/balance` 与 `/pet-fuyuko/key`，不是桩。

```
PASS price table loaded
PASS wallet starts closed
PASS usage ledger advanced · days=1
PASS double click opens the wallet
PASS wallet stays on screen
PASS wallet is a floating card
PASS wallet uses a themed surface · rgb(255, 255, 255)
PASS wallet lists a balance row / today's estimate / session estimate / token count
PASS wallet carries the estimate caveat
PASS today's estimate is priced, not zero · 今日估算=¥0.16
PASS today's estimate is in a plausible range
PASS no-key path offers an input · buttons=[{再查一次:disabled},{保存:disabled}]
PASS key input is masked
PASS no-key path explains local-only storage
PASS no-key path links to the platform
PASS no-key balance is not a fake number · 未配置 Key
PASS refresh is disabled without a key
PASS a malformed key is refused
PASS a well-formed key is stored
PASS the API rejects the fake key · balance={"ok":false,"code":"auth"}
PASS auth failure shows a readable reason · Key 被拒绝了（401）。是不是填错了，或者已经吊销？
PASS auth failure does not show a fake balance
PASS no key material on screen
PASS no key material in the probe
PASS the key can be cleared
PASS Escape closes the wallet
PASS no uncaught exceptions
```

**其中 `the API rejects the fake key` 是真的打到了 `api.deepseek.com`**：
浏览器 → host 半边 → DeepSeek → 401 → 回到卡片。整条链路是通的。

### 5.3 视觉（像素差分）

`docs/preview-m3.png`：把卡片 `visibility:hidden` 前后各截一张，
298×519 区域内相差 **23,684 px（15.3%）** —— 证明卡片真的画出来了。

### 5.4 计价正确性手算复核

预置 `184k 未命中 + 1.52M 命中 + 26k 输出`（flash，空闲档）：

```
184000/1e6 × 1  = 0.184
1520000/1e6 × 0.02 = 0.0304
26000/1e6 × 4   = 0.104
合计 = 0.3184 → ¥0.32
```

卡片显示 `¥0.32`，与手算一致。

## 6. 过程中发现的真问题

### 6.1 卡片比气泡宽，却用气泡的宽度夹取（右边缘溢出 4px）

钱包内容 238px + 左右 padding 12px + 0.5px 边框 = **264px**，
但定位沿用了气泡的 240px。她默认坐在右下角时，卡片**右边会被切掉约 4px**。

浏览器实测抓到的证据：`right: 1260 > viewport 1256`。

**修法**：`placeBubble` 增加 `halfWidth` 参数，卡片传自己的 `WALLET_HALF = 132`。
测试里同时断言「用气泡宽度会溢出」和「用卡片宽度不溢出」—— 把这条差异钉死。

### 6.2 写 key 失败会把整个宿主进程干掉（最严重）

第一次跑浏览器验收时，harness 服务器**直接死了**，日志是：

```
Error: EPERM: operation not permitted, mkdir 'C:\Users\13789\.dsh\pet-fuyuko'
    at async writeKey (lib/index.js:136)
```

根因：`writeKey` 抛异常 → 路由的 `async` handler 变成未处理的 rejection →
Node 进程退出。**用户点一次「保存」就能让 DSH 崩掉**，只因为 `~/.dsh` 恰好不可写
（沙箱、只读盘、磁盘满都会触发）。

**修法**（三层）：
1. `writeKey` 改成**返回结果而不是抛异常**：`{ok:true} | {ok:false, code:'storage'}`；
2. 所有异步路由统一套 `guard()`，任何异常都变成 `500 {ok:false,code:'internal'}`，且**不回显错误文本**（可能引用请求数据）；
3. 写失败如实回 500，前端显示原因 —— 而不是假装存好了。

回归测试：把 `DSH_HOME` 指向一个「是文件不是目录」的路径，断言 **500 + 服务器仍然活着 + 什么都没存**。

### 6.3 `DELETE` 差点说谎

修完 6.2 后，`DELETE /key` 在不可写环境下也失败。我第一版改成「写失败也返回 `configured:false`」——
这是**错的**：文件没写成，旧 key 还在，告诉用户「已清除」是让他放心地把 key 留在盘上。

**修法**：写完**重新读一遍文件**，用真实状态回答。

### 6.4 `PointerEvent.detail` 恒为 0，双击检测是死代码

第一版用 `event.detail >= 2` 判断双击。但 **`PointerEvent` 规范把 `detail` 固定为 0**
（只有 `MouseEvent` 才计数），所以这段代码永远不会触发 —— 而它看起来完全正确。

**修法**：自己记上一次点击的时间与坐标（400ms / 12px 阈值）。

### 6.5 验收台的 React 替身又把 `onChange` 接错了

替身把 `onChange` 映射成原生 `change` 事件，但**原生 `change` 只在失焦时触发**，
而 React 对文本输入实际监听的是 `input`。结果：受控输入框在验收台里"打字打不进去"，
key 保存路径测不到 —— 更糟的是，之前那条「畸形 key 被拒绝」是**假通过**
（因为输入框一直是空的，保存按钮一直 disabled，什么都没发生）。

**修法**：替身在 `change` 之外同时挂 `input`。

> 这是本项目第二次栽在同一个替身上（M2 是 `useEffect` 依赖）。
> 教训：替身越像真的，测试才越有意义；替身省下的时间，最后会以假通过的形式还回来。

## 7. 与设计稿的偏差

| 设计稿 | M3 实际 | 原因 |
|---|---|---|
| key 存 `settings.yaml` 的 `pet-fuyuko.apiKey` | 存 `~/.dsh/pet-fuyuko/credentials.json`（0600） | `file:` 插件无法注册 settings 命名空间；且 key 不该在用户会分享的文档里 |
| 三档口径「今日 / 本次会话 / 本月」 | 今日 + 本次会话 | 月度需要跨会话汇总历史日志，属 M4 的统计范围；硬做只会得到一个不准的数字 |
| 连续失败 3 次后 30 分钟不自动请求 | 60s 缓存 + `?force=1` 手动重试 | 卡片是**用户主动打开**才查，没有后台轮询，退避策略意义不大 |
| `pricing.json` 单档 | 双档（高峰/空闲） | 官方就是双档，单档会算错一半时间 |

## 8. 已知限制

- **host 半边改动需要重启 DSH 进程**：`file:` 插件的 Node 模块只 import 一次。
  client bundle 走 HMR 会热更，但新增的 `/pet-fuyuko/balance` 等路由要重启才生效。
  （本轮已在验收台上用真实 host 半边完整验证，重启后即可在真实 GUI 上生效。）
- **月度花费未做**，见 §7。
- **跨会话汇总**只到「今天」这一层，单会话明细按会话 id 记账。
- **余额只在卡片打开时查**，不后台轮询 —— 省额度，也避免"偷偷联网"。
- 若模型不在价目表里，**只报 token 不报钱**，且卡片会点名是哪个模型没价。

## 9. 下一步（M4）

1. mood / affinity、喂食、长按看详情
2. 长任务 / 上下文占用 / 余额三类提醒
3. 一键 `/compact`（loading / 成功 / 失败三态，30 秒防连点）
4. 静音模式统一闸门
