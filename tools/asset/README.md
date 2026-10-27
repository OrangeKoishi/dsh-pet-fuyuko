# 素材处理脚本

把一张带背景的角色图变成桌宠可直接使用的透明 PNG。依赖 Pillow + NumPy + SciPy：

```bash
pip install pillow numpy scipy
```

## keyout_white.py —— 白底 → 透明（推荐）

大部分角色图是纯白背景，这个脚本比通用抠图干净得多：

- 从**画布边框** flood fill 认背景，所以角色身上真正的白色（衣服、高光）不会被挖掉
- 角色内部被围住的白缝（手臂与身体之间）单独判定，面积够大且颜色均匀才当背景
- 边缘按亮度估 alpha，再做**反预乘**（`color = (pixel - 255(1-a)) / a`）去掉白边

```bash
python keyout_white.py 输入.png 输出.png [画布边长=512]
```

输出：等比缩放、**脚底贴底**、**水平居中**、边缘轻微羽化的透明 PNG。

## keyout.py —— 绿幕 → 透明

给 AI 生成的纯绿幕素材用。软阈值 + 去绿边（despill），抗锯齿边缘不会留绿毛边。

```bash
python keyout.py 输入.png 输出.png [画布边长=256]
```

## 规格约定

- 成品放 `pets/fuyuko/fuyuko.png`
- 加表情就再放 `fuyuko-<state>.png`，并在 `pet.json` 的 `assets.optional` 里登记
- 画布正方形、人物占满高度、最低点贴底边、水平居中
