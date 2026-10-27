# 绿幕 → 透明 PNG → 脚底锚点 256 画布（桌宠一期素材的最后一公里）
# 用法: python keyout.py in.png out.png [canvas=256]
import sys
import numpy as np
from PIL import Image, ImageFilter


def chroma_key(im: Image.Image, g_thresh=40, despill=0.6):
    """把纯绿背景抠掉：软阈值 + 去绿边（despill），保留半透明抗锯齿边缘。"""
    a = np.array(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 绿色主导度：越接近 1 越像背景
    dominance = (g - np.maximum(r, b)) / 255.0
    alpha = np.clip((g_thresh / 255.0 - dominance) / 0.12, 0.0, 1.0)
    # 去绿边：把 G 压到 R/B 的均值附近
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    a[..., 1] = g * (1 - despill) + g2 * despill
    out = np.dstack([a, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(im: Image.Image, pad=4):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        raise SystemExit("抠完是空的：检查背景是不是纯绿")
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def to_canvas(im: Image.Image, canvas=256, scale=1.0):
    """等比缩放到 canvas 内，脚底贴底、水平居中（桌宠锚点约定）。"""
    w, h = im.size
    k = min(canvas * scale / w, canvas * scale / h)
    im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(im, ((canvas - im.width) // 2, canvas - im.height), im)
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    canvas = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    im = Image.open(src)
    keyed = chroma_key(im)
    body = trim(keyed)
    final = to_canvas(body, canvas)
    # 边缘轻微羽化，避免缩放后硬锯齿
    alpha = final.getchannel("A").filter(ImageFilter.GaussianBlur(0.4))
    final.putalpha(alpha)
    final.save(dst)
    print(f"ok {dst} {final.size} 主体 {body.size}")


if __name__ == "__main__":
    main()
