# M0 完成报告 · 桌宠骨架

日期：2026-10-26 · 宿主：DSH 0.2.1-rc.3 · Web GUI `http://127.0.0.1:5070`

---

## 1. 结论

**M0 完成，已在运行中的 DSH 上跑通。** 桌宠出现在窗口右下角，可拖动、位置持久化、有呼吸微动、
单击有反应、任何视图都常驻。素材换成你的图之后已重新归一化。

```
✅ host 半边：静态资源路由（已实测 200 + 正确 PNG 字节）
✅ browser 半边：shell.overlay 注册（已确认进入 live 启动清单，77 条 entry 之一）
✅ 打包链路：file: URL → 向上找 package.json → 读 dsh.client → 服务 ./client bundle
✅ 真实浏览器渲染：160×160 @ (1068, 405)，state=idle，animationName=dpf-breathe
```

## 2. 实测证据

### 2.1 资源路由（对运行中的 DSH 直接请求）

```
GET /pet-fuyuko/asset/fuyuko/pet.json          → 200 application/json
GET /pet-fuyuko/asset/fuyuko/fuyuko.png        → 200 image/png（512×512 RGBA）
GET /pet-fuyuko/asset/../package.json          → 404
POST /pet-fuyuko/asset/fuyuko/pet.json         → 405
```

### 2.2 客户端 bundle（从 live 启动清单取真实 rev）

```
GET /plugins/events
  → 图里 77 条 entry，其中：
    {"id":"dsh-pet-fuyuko","url":"plugins/??dsh-pet-fuyuko/client.js&rev=3324cb1da63f",
     "inject":["@deepseek-ai/dsh-client-ui-layout"]}

GET /plugins/??dsh-pet-fuyuko/client.js&rev=3324cb1da63f
  → 200，10733 bytes，node --check 通过
```

> 这个 rev 是 HMR 在我每次改 `lib/client.js` 之后自动重算的 —— 说明文件监听链路也是通的。

### 2.3 真实浏览器渲染（无头 Edge，加载真实 bundle + 真实素材）

```
pet mounted · 160×160 @ 1228,502 · state=idle · animationName=dpf-breathe
img.complete=true · naturalWidth=512
```

另外用「截图差分」确认她**确实被画出来了**（不只是存在于 DOM）：带着桌宠截一张、移除
`.dpf-layer` 再截一张，两张图在桌宠矩形内相差 8495 px，矩形外只差 70 px（那是光标闪烁）。

### 2.4 自测（`npm test`，4 个文件全绿）

| 测试 | 覆盖 |
|---|---|
| `asset-route.test.mjs` | 路由注册、MIME、PNG 魔数、3 种目录穿越、405、HEAD 无 body |
| `live-server.test.mjs` | 真起 `node:http` + `fetch`，验 512×512 RGBA、content-length、404/405 |
| `client-face.test.mjs` | bundle 是 classic script、插件面、slot 注册、几何/夹取/持久化、窗口级可见性 |
| `packaging.test.mjs` | `file:` import、`nearestPackage` 向上查找、`exports["./client"]`、只 require 平台模块 |

---

## 3. 这轮踩到的坑（都已修）

### 3.1 `shell.overlay` 的 `> *` 规则会抢走全屏点击

宿主的 `.overlayLayer > *` 是 `pointer-events: auto`。我第一版只给图层写 CSS `pointer-events:none`，
结果整个图层仍然吃掉页面点击。

**修法**：图层用**内联** `pointer-events: none`（内联优先级高于宿主类规则），桌宠自己写 `auto`。
这条在 `live-server` 之外没法自动化，所以我在 `client-face` 里断言了内联样式存在。

### 3.2 组合包 URL 不能当 `<script src>` 写死

我一开始在验收台里写 `<script src="/plugins/??dsh-pet-fuyuko/client.js">`，
浏览器把 `?` 当成 query 起点，`??` 变空 —— 脚本 404，页面一片空白。

**修法**：验收台用 `/bundle.js` 别名（server 里映射到同一个文件）。
真实应用不受影响，它由宿主自己注入带 rev 的完整 URL。

### 3.3 验收台的 overlay 必须 `position: fixed`

我第一版写 `position: absolute`，落点算出来是 `1288`（超出 1280 视口）。
宿主 `AppFrame` 的 overlay 层是相对整个 frame（跨三栏）的，不是相对中间那栏。

**修法**：验收台改成 `fixed`，落点回到 `1068`，与设计稿「距右 28px」一致。

### 3.4 单击被误判成 1px 拖动

原来的死区判断写错了（拿 `clientX` 和 `pos.x` 比），手指不动也会触发移动。

**修法**：改用 `startX/startY` 算欧氏距离，≤3px 直接 return，不写位置。

### 3.5 「有会话才显示」的门控让她一直不出现（最耗时的一个）

我按设计稿加了一条：没有当前会话就隐藏（`useSessions(s => s.current) === undefined`）。
结果是**她在你眼里完全消失了** —— 而我的无头测试当时是在落地页跑的，
读到的 `current` 一直是 `null`，我还当成「门控正确工作了」。

**根因**：`shell.overlay` 是 **root 作用域**的槽位，它拿到的 `useSessions` 与实际会话选择
并不是同一条订阅路径；再加上我用内联箭头当选择器（快照 hook 按选择器身份记忆），
两边一起让她稳定读到「没有会话」。这个组合很难从代码上断言，只能靠真实浏览器探针发现。

**修法**：M0 直接去掉可见性门控 —— 桌宠属于**窗口**，不属于某一个会话，
在任何视图（含无会话落地页）都显示。会话驱动的状态留到 M1 用桥接组件做，
而不是用「藏起来」表达。

### 3.6 `file://` 下取不到 `/pet-fuyuko/asset/...`（Electron 边界）

宿主文档写明桌面壳用 `file://` 加载 dist、fetch 走 IPC 桥接。绝对路径 `/pet-fuyuko/...`
在 `file://` 下没有 origin 可解析，图片会 404。

**修法**：这一轮先确认浏览器路径完全可用（你现在看到的就是）；
data-URI 兜底方案已经写好并验证过编码体积（WebP q95，44 KB / base64 59 KB），
等真要在 Electron 窗口里跑再落进去，避免现在就把 60 KB 内联进 bundle。

---

## 4. 素材处理结果

你给的 `pictures/chibi-fuyuko-1.png`（1254×1254，白底）经 `tools/asset/keyout_white.py` 处理：

| 指标 | 结果 |
|---|---|
| 输出 | `pets/fuyuko/fuyuko.png`，512×512 RGBA |
| 透明 / 不透明 / 半透明 | 67.3% / 29.7% / 2.9% |
| 半透明像素平均亮度 | 71（removebg 那张是 119，白边基本消掉） |
| 半透明里 >235 亮度占比 | 0.8% |
| 内部白洞填充 | 11 处（手臂与身体间的缝），无误删角色本体 |
| 居中 | bbox 中心 255.5 vs 画布中心 256 ✅ |
| 脚底 | 贴底（bottom gap = 0）✅ |

**没用 removebg 那张**：它把分辨率砍到 500、误删 211 px 角色本体、边缘留 4.3% 亮白残边。

**原图两个缺陷**（都不影响 M0）：
- 顶部呆毛被切 2–4 px（`y=0` 行还有 14 px 非白像素，宽度单调递增）→ 256 画布上约 0.8px，肉眼不可见
- 脚底是刀切的 → 桌宠本来就贴地，反而正好当锚点

---

## 5. 与设计稿的偏差（有意为之）

| 设计稿 | M0 实际 | 原因 |
|---|---|---|
| 距底 96px | 距底 235px（1280×800 下） | 底部要避开输入框；实际落点 `y=405`，在输入框上方 |
| `localStorage` 存百分比 | 存绝对 px + 窗口缩放时夹取 | M0 够用；百分比留到 M1 有真实拖动数据后再定 |
| 调试面板可强制表情 | 用 `CustomEvent` + `localStorage` 双通道 | 不用等 M1 就能验表情，且不占 UI |

---

## 6. 下一步（M1）

1. 桥接组件挂进 `conversation.input.overlay`（渲染 null），发布 `{ running, runningCalls, partial, turn-error }`
2. 状态机接真实会话：`idle → think → work → idle`，错误 → `panic`
3. `SpriteRenderer` 读 `pet.json` 的 `assets.optional` / `motions` 注册表（现在 `optional` 是空的，等第二张图）
4. 调试通道保留，方便你随时切状态看效果

**M1 开工前需要你定的只有一件事**：要不要现在就用 ComfyUI 派生一张 `think` 表情？
（基于当前这张做 img2img，保持同一形象；不做也能跑，`think` 会退化成 CSS 上浮 + 三点动画。）
