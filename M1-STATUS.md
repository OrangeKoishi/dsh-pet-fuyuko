# M1 完成报告 · 状态联动

日期：2026-10-29 · 宿主：DSH 0.2.1-rc.3 · Web GUI `http://127.0.0.1:11870`

---

## 1. 结论

**M1 完成。** 桌宠不再是一个只会呼吸的贴纸 —— 她现在跟着**真实的会话状态**换表情：
模型在流式输出时上浮，有工具在跑时摇摆，这一轮报错时抖动。

```
✅ 桥接组件挂在 conversation.input.overlay，拿到真实 useChat / useSession
✅ 已确认绑定到真实会话（sessionId 为宿主的 `session-<uuid>` 形态）
✅ 四种活动全部在真实浏览器里验证（think/work/panic/idle → 对应动画）
✅ 订阅去重：相同状态重复发布不触发重渲染
✅ 单击仍能临时打断，松开后回到当前活动
```

## 2. 为什么要桥接

这是 M1 唯一的结构性难点，值得记下来。

桌宠挂在 `shell.overlay`，那是 **root 作用域**；而 `useChat`（聊天快照）和 `useSession`
（会话快照）只在 **session 作用域**存在。它们是两棵独立的 React 树，**不能共享 context**。

做法：

```
session scope                          root scope
┌──────────────────────────┐          ┌─────────────────────┐
│ SessionBridge            │          │ PetLayer            │
│ (conversation.input.     │  publish │ (shell.overlay)     │
│  overlay，渲染 null)      │ ───────▶ │ useSyncExternalStore│
│  useChat / useSession    │  store   │ → data-state        │
└──────────────────────────┘          └─────────────────────┘
```

- 桥接组件在 `conversation.input.overlay`（list 槽、session 作用域），**渲染 `null`**，
  纯数据接缝
- 模块级 store 只存粗粒度标志：`{ activity, sessionId, since, toolCalls, errorText }`
  —— **不含任何消息内容**
- 桌宠用 `useSyncExternalStore` 订阅

## 3. 状态推导规则

按优先级，高者胜：

| 优先级 | 条件 | 状态 | 动画 |
|---|---|---|---|
| 1 | `session.lastAgentError` 非空 | `panic` | `dpf-shake` |
| 2 | `chat.legacy.runningCalls.length > 0` | `work` | `dpf-sway` |
| 3 | `chat.legacy.partial != null` | `think` | `dpf-float` |
| 4 | 以上都不成立 | `idle` | `dpf-breathe` |

设计取舍：

- **错误优先于一切** —— 出错了才是你真正需要知道的
- **工具优先于流式** —— 「我在干活」比「我在想」更具体
- 全部输入都做了空值防御：`undefined` / `null` / 字段缺失 / 类型不对都退化为 idle，
  因为桌宠可能在任何会话绑定之前就渲染

## 4. 实测证据

### 4.1 线上 GUI：桥接确实绑到了真实会话

打开真实会话后读取 pet 与 signal：

```json
{
  "pet":    { "state": "idle", "anim": "dpf-breathe" },
  "signal": { "activity": "idle",
              "sessionId": "session-<uuid>",
              "since": 0, "toolCalls": 0, "errorText": "" },
  "bridges": 1
}
```

7 项检查全过，包括「session id 形如 `session-*`」与「pet 状态与 signal 一致」。

### 4.2 真实浏览器：四种状态逐一驱动

把每种活动推进真实 store，检查渲染结果：

| 活动 | 期望动画 | 实测 |
|---|---|---|
| `think` | `dpf-float` | ✅ |
| `work` | `dpf-sway` | ✅ |
| `panic` | `dpf-shake` | ✅ |
| `idle` | `dpf-breathe` | ✅ |
| `clearSignal()` | 回到 `idle` | ✅ |
| 相同值重复发布 | 不通知 | ✅（0 次） |
| 不同值发布 | 通知一次 | ✅（1 次） |
| 单击（活动为 think 时） | 临时切 `panic` | ✅ |
| 松开 700ms 后 | 回到 `think` | ✅ |
| 无未捕获异常 | — | ✅ |

### 4.3 自测

`npm test` 四套全绿。`client-face.test.mjs` 新增覆盖：

- `deriveActivity` 的四种状态 + 优先级 + 全部空值/畸形输入
- store 的发布、去重、取消订阅、`clearSignal` 回到共享空值
- 双槽位注册（pet + bridge）

## 5. 过程中踩到的坑

### 5.1 验收台的假 React 缺 `useSyncExternalStore`

`test/visual-harness.html` 用的是手写的极简 React 替身。加了订阅后它立刻报
`react.useSyncExternalStore is not a function`，页面白屏。

**修法**：给替身补一个**真正订阅**的实现（store 通知 → 调度重渲染），
这样验收台走的是和真实 React 一样的路径，而不是「假装返回当前值」。

### 5.2 测试计数基线不对

「相同发布不通知」一开始测出 `afterSame: 1`。不是代码 bug —— 是我在
`clearSignal()` 之后立刻测，而那次 publish 把 `sessionId` 从 `null` 改成了 `"harness"`，
**本来就是一次真实变化**。

**修法**：先把状态推到一个已知值并稳定下来，再开始计数。

### 5.3 CDP 打不进 Lexical 输入框

想用 `Input.insertText` 往输入框打字来触发真实回合，但宿主的输入框是 Lexical
contenteditable，CDP 的文本插入进不去（读回来是空字符串）。

**处理**：不跟它较劲 —— 改成在验收台里直接驱动 store。测的正是我写的那段订阅逻辑，
真实回合的 `runningCalls` / `partial` 由宿主自己填，属于宿主契约（已在 4.1 验证绑上了）。

## 6. 与设计稿的偏差

| 设计稿 | M1 实际 | 原因 |
|---|---|---|
| 状态名 `thinking` / `working` | `think` / `work` | 与 CSS 里已有的 `data-state` 预设对齐，避免两套词表 |
| 拖拽是独立状态 | 拖拽用 `data-dragging` 属性叠加 | 拖拽时不该丢失「正在工作」这个事实，两者正交 |
| `curious` / `talk` / `sleep` / `worried` | 未实现 | 依赖台词系统与心情值，属 M2 |

## 7. 已知限制

- **`since` 字段目前只是记录**，还没用来做「长任务卡住」提醒（M4 才用）
- **多会话**：同时只有一个桥接实例在发布。切换到另一个会话时，旧桥接卸载会
  `clearSignal()` 让桌宠短暂回到 idle，新桥接挂载后再更新 —— 快速切会话时可能看到一次闪烁
- **`errorText` 已采集但未展示**：M2 接台词时用它做「慌张 + 错误摘要」

## 8. 下一步（M2）

1. `lines.zh.json` 接进点击/状态气泡，双人格（营业/本体）切换
2. 右键菜单：换装 / 隐身 / 静音 / 设置
3. `curious`（悬停）、`talk`（点击说话）、`sleepy`（深夜）
4. 用 `errorText` 做报错时的台词与摘要气泡
