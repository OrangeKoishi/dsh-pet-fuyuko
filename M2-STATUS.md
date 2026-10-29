# M2 完成报告 · 人格

日期：2026-10-29 · 宿主：DSH 0.2.1-rc.3 · Web GUI `http://127.0.0.1:8805`

---

## 1. 结论

**M2 完成。** 她不再只是一个换表情的贴纸 —— 现在她**会说话**，而且说的每一句话都来自
`lines.zh.json`，两种人格（营业 / 本体）读起来完全不同。

```
✅ 台词库接入：130 条，双人格，点击 / 待机 / 思考 / 干活 / 报错 / 呆毛 / 节日 全部走 JSON
✅ 循环式不重样：同类台词播完一轮才会重复（不是"随机不重复"，是保证）
✅ 双人格切换：菜单里切，或单击时 10% 概率随机切
✅ 气泡：圆角 + 小尾巴 + 宿主主题 token，自动避让窗口边缘，超长文本自动限时
✅ 右键菜单：说话 / 换人格 / 静音 / 隐身 / 重置冷却（余额、喂食留 M3/M4，置灰占位）
✅ 隐身与唤回：`Ctrl+Shift+F`，窗口级
✅ `curious`（悬停）/ `talk`（说话）/ `sleepy`（深夜待机）三个新状态
✅ 报错气泡带脱敏摘要，`sk-` 开头的 key 不会出现在任何界面文本里
```

验收：真实浏览器 **29/29**（验收台）、**21/21**（线上 GUI）、`npm test` 五套全绿。

## 2. 这轮做了什么

### 2.1 台词库（`lines.zh.json`，130 条）

设计稿承诺 120 条，实际 **130 条**，全部 id 唯一、全部通过结构校验。

| kind | 营业 | 本体 | 说明 |
|---|---|---|---|
| idle | 12 | 10 | 待机闲聊，每 4 分钟最多一次 |
| click | **20** | **20** | 见 §3.1 —— 为了让「点 20 次不重样」成为事实 |
| think | 6 | 6 | 模型流式输出时 |
| work | 6 | 6 | 工具执行时 |
| panic | 4 | 4 | 报错时 |
| ahoge | 6 | 6 | 点呆毛 |
| balance | 6 | 4 | 留给 M3 填 `{余额}` |
| feed | 5 | 5 | 留给 M4 |
| festive | 4（`both`） | | 生日 12-04 / 元旦 / 圣诞 / 深夜 02:00 后 |

**改 JSON 即生效**：`lib/index.js` 把 `lines.zh.json` 作为包根白名单路由服务
（`/pet-fuyuko/lines.zh.json`），浏览器半边 `fetch` 时带 `cache: "no-cache"`。
改完刷新页面就换台词，**不用重启、不用重打包**。

### 2.2 选择算法（`pickLine`）

按顺序过滤，最后加权随机：

1. `kind` 匹配触发源；
2. `mode` 匹配当前人格，或为 `both`；
3. 日期 / 小时条件成立（`date: "12-04"`、`fromHour: 2`，`toHour < fromHour` 时按跨午夜处理）；
4. `once` 已播过的剔除（`onceSeen` 账本，持久化）；
5. **本轮循环里没播过的优先** —— 这一条把「不重样」从概率变成了保证；
6. 冷却中的台词降级（池子只剩冷却中的才用）；
7. `weight` 加权。

### 2.3 气泡

- 圆角 12px + 小尾巴，`--dsw-alias-bg-layer-2` / `--dsw-alias-border-l2` 主题 token，
  亮暗色自动适配（实测线上深色主题解析为 `rgb(44,44,46)`）。
- **固定定位 + 视口夹取**：她贴着右边缘时气泡不会跑出屏幕；头顶空间不够时自动翻到脚下。
- 停留时长按字数算（1.8s–6s），太长的台词不会一闪而过。
- **队列 + 优先级**：气泡不叠，但也不排队等死 ——
  错误（优先级 2）会打断并清空还在排队的闲聊（优先级 0）和普通反应（1）。

### 2.4 状态机（优先级严格按设计稿）

```
drag > talk > panic > sleep > work > think > curious > idle
```

`talk` 只对「聊天类」气泡生效：报错气泡**不会**让她看起来在闲聊（`talk: false`），
所以报错时仍然是 `panic` 表情。

`sleepy` 的判据在 `shouldSleep` 里，而不是在状态折叠里 —— 它要求
「深夜 + 会话空闲 + 10 分钟没互动」三者同时成立，所以**回合进行中永远不会睡着**。

### 2.5 菜单与隐身

| 菜单项 | 行为 |
|---|---|
| 说点什么 | 立刻说一句 `click` |
| 切换到本体 / 营业模式 | 切人格，并立刻用新人格说一句 |
| 静音 / 取消静音 | 只换表情不弹气泡；取消静音时立刻说一句 |
| 隐身（`Ctrl+Shift+F`） | 隐藏，再按一次唤回 |
| 重置台词冷却 | 清空冷却表与循环，方便验收 |
| 看余额 / 喂零食 | 置灰，标 `M3` / `M4` |

菜单自动夹在视口内，点外部或 `Esc` 关闭。

### 2.6 状态存储

`localStorage: dsh-pet-fuyuko:state` 单一 JSON，带 `schemaVersion`：

```json
{ "schemaVersion": 1, "mode": "omote|ura", "muted": false, "hidden": false,
  "cooldowns": { "<lineId>": 1690000000000 }, "onceSeen": ["festive.birthday"],
  "counters": { "clicks": 0, "talks": 0, "drags": 0 }, "lastInteractionAt": 0 }
```

读取时逐字段校验：类型不对回退默认值、负计数归零、非数字冷却丢弃、
未知字段忽略；`cooldowns` 超过 400 条时按时间裁到 300 条。
**不存任何对话内容。**

M1 的调试状态键从 `dsh-pet-fuyuko:state` 挪到了 `dsh-pet-fuyuko:debug-state` ——
否则调试通道会把人设存档整个覆盖掉。

## 3. 过程中发现的真问题

### 3.1 「点 20 次不重样」原本做不到（设计稿的验收项与台词量矛盾）

设计稿 §8 验收清单写「点 20 次台词不重样」，但 §3.4 的 click 台词每边只有 15 条。
按原数据，第 16 次必然重复 —— 验收项根本不可能通过。

**修法**：把 click 两边各补到 **20 条**（纯 JSON 改动，不动代码）。
现在「一轮 20 次全部不同」是可以断言的硬性质，测试里也是这么测的。

### 3.2 验收台的假 React 忽略 `useEffect` 依赖数组（最费时间的一个）

`test/visual-harness.html` 的手写 React 替身原来每个 effect 都在每次渲染后
**先执行上一个清理函数**。M1 时代没影响，但 M2 的气泡计时器挂在 effect 里，
结果每次重渲染都把计时器清掉 —— **一句台词会永久停在屏幕上**，
而且状态卡在 `talk` 不放。

这个 bug 只在验收台出现，真实 React 里没有，所以它很危险：
差点被我当成「组件逻辑写错了」去改组件。

**修法**：给替身补上真正的依赖数组比较（`Object.is` 逐项比），
`useCallback` 也改成按依赖记忆化 —— 现在替身的行为和 React 一致。
修完后 `talk → idle` 的衰减曲线立刻就正常了（见 §4.2）。

### 3.3 `setPointerCapture` 会抛异常，把整条点击链路带崩

线上第一次跑验收时点击毫无反应，异常栈指向 `setPointerCapture`：
指针已经抬起（或事件是合成的）时它抛 `InvalidStateError`，
而它写在 `drag.current = {...}` **前面** —— 抛了就再也不会记录拖拽状态，
后续 `pointerup` 直接 return，点击彻底失效。

**修法**：`try/catch` 包住，拖拽状态无论如何都要记录。

### 3.4 报错气泡被闲聊挡住

原本报错 = 一条 panic 台词 + 一条摘要，两条排队。结果摘要要等台词的 4.2 秒
才能出现 —— 而摘要才是用户真正需要看的东西。

**修法**：合成**一个**气泡（台词当标题、摘要当附注），并给气泡加优先级：
错误会立刻打断正在显示的闲聊。

### 3.5 线上"点不到"其实是测试脚手架的问题（值得记）

用 CDP 在真实 GUI 上点击时，`elementFromPoint` 只看得到 `BODY`。
排查了很久，最后发现：**欢迎弹窗开着的时候，宿主给 `#root` 加了 `inert`**。
这是正确的模态语义（弹窗后面的东西本来就不该能点），
而我的测试是**直接把弹窗 DOM 删掉**，宿主没机会移除 `inert`，于是整个应用（含桌宠）
对指针完全失效。

**修法**：测试改成点弹窗里的「继续」，让宿主自己收尾。
`verify-m2-live.mjs` 现在会断言 `inert === 0` 且 `elementFromPoint` 确实命中桌宠，
先确认"可点"再测行为 —— 否则后面每一条失败都是假失败。

> 结论：桌宠代码没问题，是验收方法有问题。这条记下来，免得下次重踩。

## 4. 实测证据

### 4.1 自测（`npm test`，5 个文件全绿）

新增 `test/lines.test.mjs`，17 组、上百条断言，全部是纯函数：

| 组 | 覆盖 |
|---|---|
| 1–2 | 出厂库结构完整、130 条全部可用、id 唯一、每类都有双人格；畸形输入降级 |
| 3–4 | 两种人格台词**无交集**；选择结果不会串人格 |
| 5 | **一轮循环覆盖整个池子**；连续 20 次 click 全部不同 |
| 6 | 冷却中的台词降级而不是返回空；冷却过期后重新可用 |
| 7–8 | `once` 只播一次；`12-04` / `01-01` / `fromHour:2` / 跨午夜窗口 |
| 9–10 | `{变量}` 替换（未知占位符保留，方便发现 JSON 拼错）；气泡时长上下限 |
| 11–12 | 状态优先级全排列；深夜判据（含"干活时永不睡着"） |
| 13 | 热点命中（呆毛在身体之前）；真实 `pet.json` 的呆毛顺序 |
| 14 | 气泡/菜单的视口夹取（贴右边、贴顶部翻转） |
| 15 | 存档迁移：垃圾输入降级、逐字段校验、损坏 JSON 回默认 |
| 16–17 | 菜单文案跟随人格；循环按 kind × mode 隔离 |

`client-face.test.mjs` 增加：M2 的 18 个纯函数都挂在测试面上、调试键与人设键已分离。

### 4.2 真实浏览器（验收台 29/29）

```
PASS greeting bubble drains
PASS line library loaded · lines=130
PASS starts in 营业模式 · mode=omote
PASS click produces a speech bubble · "太频繁了啦！……不过也没关系。"
PASS bubble has a tail and a side · side=above
PASS bubble is a rounded floating card · {"radius":"12px","position":"fixed","tail":true,"zIndex":"30"}
PASS bubble draws a tail
PASS hover → curious · state=curious
PASS 20 omote picks, all distinct · unique=20
PASS omote and ura read differently
   omote: 要不要我数三下，你就休息一下？一、二……
   ura  : ……知道了。别一直摸。
PASS right-click opens the menu · 7 items
PASS menu stays inside the viewport
PASS menu offers 隐身 / 静音
PASS M3/M4 rows are present but disabled
PASS menu switches to 本体模式 · clicked "切换到本体模式" → mode=ura
PASS 本体模式 speaks a ura line
PASS menu mutes her
PASS muted click says nothing
PASS muted state is on the sprite
PASS Ctrl+Shift+F hides her / brings her back
PASS error → panic state · state=panic
PASS error shows a redacted summary · 401 Unauthorized for sk-****
PASS key never appears in the bubble
PASS error bubble is styled as an error
PASS no uncaught exceptions
```

另有一组独立的衰减追踪（点击后逐 500ms 采样）：

| 时刻 | 状态 | 气泡 |
|---|---|---|
| quiet | `idle` | — |
| t+500 → t+2000 | `talk` | 「……看够了没有。手放下来。」 |
| t+2500 起 | `curious` | — |

即：说完自动回落到「被鼠标看着」的 `curious`，鼠标移开再回 `idle`。

### 4.3 线上 GUI（21/21）

```
welcome dialog: {"wasOpen":true,"clicked":true,"label":"继续"}
PASS no inert ancestor left after dismissing · inert=0
PASS pet is hit-testable · topmost=DIV
PASS pet mounted in the real app
PASS line library loaded from the host · lines=130
PASS defaults to 营业模式 · mode=omote
PASS bridge bound to a real session · session-eccc47bd-…
PASS click speaks in the real app · 被你碰到的地方，好像会记得很久。
PASS bubble uses rounded corners · 12px
PASS bubble is viewport-anchored / has a tail / stays on screen
PASS bubble paints a themed background · rgb(44, 44, 46)
PASS right-click menu opens in the real app · 7 items
PASS menu stays on screen / uses themed surface
PASS menu switches persona in the real app
PASS Ctrl+Shift+F hides her / restores her
PASS overlay does not swallow page clicks · topmost=P
PASS no uncaught exceptions
```

外加 `check-live-m2.mjs`（24/24，纯 HTTP 侧）：线上 graph 里插件在册
（`rev=3e53dc2c1604`）、**served bundle 与本地逐字节相同（61,969 bytes）**、
`/pet-fuyuko/lines.zh.json` 返回 200 + 130 条合法 JSON、
`/pet-fuyuko/package.json` 与 `lines.zh.json/../package.json` 仍然 404。

### 4.4 视觉（像素差分，不靠肉眼）

`docs/preview-m2.png` 是线上 GUI 的截图。因为截图本身没法断言，我用了和 M0 相同的
**差分法**：带气泡截一张、把气泡 `visibility:hidden` 再截一张，两张在
220×268 的区域内相差 **6,039 px（10.2%）** —— 证明气泡是真的画出来了，
不只是存在于 DOM 里。

## 5. 与设计稿的偏差

| 设计稿 | M2 实际 | 原因 |
|---|---|---|
| 单击 10% 切人格 | 照做；但**本体模式下单击会先说「哼。」** | 设计稿 §3.3 有这条，实现时补上 |
| 长按 1.2s 看好感度 | 未做 | 好感度是 M4 的数据，M2 没有可展示的内容 |
| 双击看小钱包 | 未做 | 余额是 M3 |
| `feed` / `balance` 台词 | 已写好但**暂时点不到** | 等 M3/M4 接上入口；菜单里置灰占位 |
| 气泡"小尾巴" | 用伪元素画三角形 | 纯 CSS，无图片依赖 |

## 6. 已知限制

- **多会话**：沿用 M1 的单桥接，快速切会话时可能看到一次 idle 闪烁。
- **台词库加载失败是静默的**：她照样动，只是不说话 —— 我选择不让桌宠因为一个坏 JSON 消失。
- **`{余额}` / `{今日花费}` 目前原样显示**（如 `余额 {余额}。别乱花。`），
  因为这些变量要等 M3 才有值；`applyVars` 保留未知占位符是**故意**的，
  方便一眼看出"这里还没接数据"。
- **静音只静音气泡**，不静音表情与动作（符合设计稿 §3.7「只换表情不弹气泡」）。
- **深夜判据用本地时间**，跨时区旅行时会跟着系统时区走。

## 7. 下一步（M3）

1. Node 半边 `GET /pet-fuyuko/balance`（key 不出浏览器，脱敏 + 60s 缓存）
2. `pricing.json` + `useProjection('tokenUsage')` 本地花费估算
3. 双击 → 小钱包气泡卡片；`balance` 台词接上 `{余额}` / `{今日花费}`
4. 余额低于阈值 → `worried` 表情 + 一次性提醒
