# dsh-pet-fuyuko

黛冬优子桌宠 —— DeepSeek Harness Web GUI 的客户端浮层插件。

![preview](docs/preview.png)

> 当前状态：**M1（状态联动）已完成** —— 她会跟着真实会话换表情。
> 报告：[M1-STATUS.md](M1-STATUS.md) · [M0-STATUS.md](M0-STATUS.md)
> 设计稿：[DESIGN.md](DESIGN.md) · 素材验收：[ASSET-REVIEW.md](ASSET-REVIEW.md)

## 它现在能做什么

- 在窗口右下角显示一张静态 Q 版冬优子（`shell.overlay` 帧级浮层）
- 可拖动，位置记在 `localStorage`，刷新后还在；窗口缩放自动夹回可视区
- **Alt + 滚轮缩放**（0.5×–2.5×），以脚底中心为锚点，缩放比例也会记住
- **跟着会话状态换表情**：模型思考时上浮、工具运行时摇摆、报错时抖动
- 待机呼吸微动（CSS `transform`，不跑 rAF）；`prefers-reduced-motion` 自动关掉
- 单击弹一下「慌张」反应；`think` 状态显示三点动画
- 窗口级常驻：落地页、设置页也在（桌宠属于窗口，不属于某个会话）
- 素材改完刷新即生效（`pets/` 目录由 host 半边实时服务，不走打包）

### 操作

| 操作 | 效果 |
|---|---|
| 拖动 | 移动，松手后记住位置 |
| **Alt + 滚轮** | 缩放立绘（上滚放大、下滚缩小），右下角短暂显示百分比 |
| 单击 | 弹一下反应（M2 接台词） |

缩放以**脚底中心**为锚点，所以她不会在放大时"飘起来"；碰到窗口边缘时会自动夹回可视区。
直接滚轮不受影响，仍然是滚动页面/对话。

### 状态联动

她读的是宿主的真实会话状态，不是计时器：

| 她在做什么 | 什么时候 |
|---|---|
| 呼吸（idle） | 没有进行中的回合 |
| 上浮 + 三点（think） | 模型正在流式输出 |
| 左右摇摆（work） | 有工具正在执行 |
| 抖动（panic） | 这一轮报错了 |

桥接方式：桌宠在 root 作用域的浮层里，`useChat` / `useSession` 只存在于会话作用域，
两者是不同的 React 树。所以有一个渲染 `null` 的桥接组件挂在 `conversation.input.overlay`，
把粗粒度活动状态（只有标志位，不含任何消息内容）发布到模块级 store，桌宠订阅它。

## 目录

```
lib/index.js     host 半边：只读静态资源路由 /pet-fuyuko/asset/**
lib/client.js    browser 半边：shell.overlay（PetLayer）+ 会话桥接（SessionBridge）
pets/fuyuko/     素材：pet.json + fuyuko.png（512×512 透明，脚底锚点）
lines.zh.json    台词库（120 条，M2 接）
test/            4 个自测 + 1 个可视化验收台
```

## 安装

插件通过 `file:` URL 挂载，仓库可以放在任意位置 —— 把下面的路径换成你的实际路径即可。

在 profile 的 `cordis.patch.yml` 末尾追加：

```yaml
- insert:
    - id: pet-fuyuko
      name: 'file:///path/to/dsh-pet-fuyuko/lib/index.js'
```

Windows 上路径形如 `file:///D:/projects/dsh-pet-fuyuko/lib/index.js`。
或者直接叠加仓库里的 [patch.overlay.yml](patch.overlay.yml)：

```bash
dsh web --patch /path/to/dsh-pet-fuyuko/patch.overlay.yml
```

patch 层是**热加载**的（自定义 profile 默认 `patchReload: live`），
不需要重启进程，但**浏览器要刷新一次**才会拿到新的启动清单。

## 测试

```bash
npm test
```

四个文件，全部无外部依赖（不需要装 React，不需要起浏览器）：

| 测试 | 验什么 |
|---|---|
| `asset-route.test.mjs` | 路由注册、MIME、PNG 魔数、目录穿越、405、HEAD |
| `live-server.test.mjs` | 真的起一个 `node:http`，用 `fetch` 走网络请求，验 512×512 RGBA |
| `client-face.test.mjs` | bundle 是合法 classic script、插件面、双槽位注册、几何/持久化、缩放数学、状态推导与订阅去重 |
| `packaging.test.mjs` | `file:` URL 能 import、`package.json` 可被向上查找、`exports["./client"]` 有效、bundle 只 require 平台模块 |

可视化验收台（真实浏览器渲染真实 bundle，不需要 DSH 在跑）：

```bash
node test/harness-server.mjs 4599
# 打开 http://127.0.0.1:4599/
```

## 素材替换

- 换形象：直接覆盖 `pets/fuyuko/fuyuko.png`（512×512、透明、脚底贴底、水平居中），刷新即可
- 加表情：放 `pets/fuyuko/fuyuko-<state>.png`，在 `pet.json` 的 `assets.optional` 里加一行
- 换台词：改 `lines.zh.json`

## 版权

- **代码**：MIT，见 [LICENSE](LICENSE)。
- **角色形象**：黛冬优子属于 Bandai Namco Entertainment。`pets/fuyuko/fuyuko.png` 是本机使用的
  同人素材，**不在 MIT 授权范围内**；如果要分发或商用，请自行替换成你有权使用的形象
  （覆盖 `pets/fuyuko/fuyuko.png` 即可，代码不用改）。
