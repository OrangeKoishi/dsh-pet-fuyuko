# 白底 → 透明：边框 flood fill + 内部纯白洞 + 边缘反预乘
# 用法: python keyout_white.py <in.png> <out.png> [canvas]
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

WHITE = 255.0
BG_TOL = 10          # 与纯白差异 <= 10 视为背景候选
ENCLOSED_MIN = 300   # 内部空洞最小面积
ENCLOSED_STD = 3.5   # 内部空洞要求足够均匀（标准差）


def border_connected(mask):
    lab, n = ndimage.label(mask)
    if n == 0:
        return np.zeros_like(mask)
    keep = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    keep.discard(0)
    return np.isin(lab, list(keep))


def keyout(rgb: np.ndarray):
    """返回 (rgba float, stats)。"""
    H, W, _ = rgb.shape
    near_white = np.abs(rgb - WHITE).max(axis=2) <= BG_TOL
    bg = border_connected(near_white)

    # 内部纯白空洞：面积够大且颜色均匀 → 也是背景（手臂与身体之间的缝）
    enclosed = near_white & ~bg
    lab, n = ndimage.label(enclosed)
    filled = 0
    if n:
        for i in range(1, n + 1):
            m = lab == i
            if m.sum() < ENCLOSED_MIN:
                continue
            px = rgb[m]
            if px.std(axis=0).max() <= ENCLOSED_STD:
                bg |= m
                filled += 1

    # 边缘带：距背景 <=2px 的前景
    dist = ndimage.distance_transform_edt(~bg)
    fringe = (~bg) & (dist <= 2.0)
    core = (~bg) & (dist > 2.0)

    lum = rgb.mean(axis=2)
    alpha = np.ones((H, W), dtype=np.float64)
    # 只在边缘带用亮度估 alpha；越白越透明
    a_fringe = np.clip((WHITE - lum) / 70.0, 0.0, 1.0)
    alpha[fringe] = a_fringe[fringe]
    alpha[bg] = 0.0

    # 反预乘：pixel = color*a + 255*(1-a)  =>  color = (pixel - 255*(1-a)) / a
    out = rgb.astype(np.float64).copy()
    a3 = np.repeat(alpha[..., None], 3, axis=2)
    with np.errstate(divide="ignore", invalid="ignore"):
        unmixed = (out - WHITE * (1 - a3)) / np.where(a3 > 0.02, a3, 1.0)
    out = np.where(a3 > 0.02, unmixed, 0.0)
    out = np.clip(out, 0, 255)
    out[bg] = 0

    rgba = np.dstack([out, alpha * 255.0])
    stats = {
        "bg_frac": float(bg.mean()),
        "fringe_px": int(fringe.sum()),
        "enclosed_filled": filled,
        "enclosed_left": int((enclosed & ~bg).sum()),
    }
    return rgba.astype(np.uint8), stats


def trim_and_fit(rgba_img, canvas):
    a = np.array(rgba_img)
    al = a[..., 3]
    bbox = Image.fromarray(al).point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        raise SystemExit("抠完是空的")
    cropped = rgba_img.crop(bbox)
    w, h = cropped.size
    k = min(canvas / w, canvas / h)
    resized = cropped.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - resized.width) // 2, canvas - resized.height), resized)
    return out, bbox


def main():
    src, dst = sys.argv[1], sys.argv[2]
    canvas = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    rgb = np.array(Image.open(src).convert("RGB"))
    rgba, stats = keyout(rgb)
    img = Image.fromarray(rgba, "RGBA")
    final, bbox = trim_and_fit(img, canvas)
    final.putalpha(final.getchannel("A").filter(ImageFilter.GaussianBlur(0.35)))
    final.save(dst)
    print(f"ok {dst} {final.size} bbox={bbox} stats={stats}")


if __name__ == "__main__":
    main()
