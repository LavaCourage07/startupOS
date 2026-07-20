#!/usr/bin/env python3
"""
印章图片去背景脚本

两步去背景流程：
Step 1: rembg 深度学习去除外围背景
Step 2: 清除印章内部白色残留（rembg 会把印章圆形白底也保留为前景）

如 rembg 不可用，回退到 Pillow 阈值分割方案（一步完成）
"""

import argparse
import sys
from pathlib import Path


def _is_whiteish(r: int, g: int, b: int, white_threshold: int = 200, gray_threshold: int = 160) -> bool:
    """判断像素是否为白色或偏灰色（非印章有效颜色）"""
    # 纯白/近白：RGB 均高于阈值
    if r > white_threshold and g > white_threshold and b > white_threshold:
        return True
    # 偏灰色：RGB 三通道值较高且接近（色差小）
    if r > gray_threshold and g > gray_threshold and b > gray_threshold:
        if abs(r - g) < 40 and abs(g - b) < 40:
            return True
    return False


def clean_inner_white(img, white_threshold: int = 200, gray_threshold: int = 160) -> "PIL.Image":
    """
    清除印章内部的白色/灰色残留区域
    
    rembg 会把整个印章（包括内部白底）识别为前景，
    此函数对前景中偏白/偏灰的像素做二次清理，使其变透明。
    
    参数:
        img: RGBA 模式的 PIL Image
        white_threshold: 白色判定阈值 (0-255)，高于此值视为白色
        gray_threshold: 灰色判定阈值 (0-255)，高于此值且三通道接近视为灰色
    """
    datas = img.getdata()
    new_data = []
    cleaned = 0

    for item in datas:
        r, g, b, a = item
        if a > 0:
            if _is_whiteish(r, g, b, white_threshold, gray_threshold):
                new_data.append((255, 255, 255, 0))
                cleaned += 1
            else:
                new_data.append(item)
        else:
            new_data.append(item)

    img.putdata(new_data)
    print(f"  清理了 {cleaned} 个印章内部白色残留像素")
    return img


def remove_bg_rembg(input_path: str, output_path: str,
                    white_threshold: int = 200, gray_threshold: int = 160) -> bool:
    """
    使用 rembg 去背景（推荐方案，两步处理）
    
    Step 1: rembg 去除外围背景
    Step 2: 清除印章内部白色残留
    """
    try:
        from rembg import remove
        from PIL import Image

        # Step 1: rembg 去背景
        print("Step 1: rembg 深度学习去背景...")
        input_image = Image.open(input_path)
        output_image = remove(input_image)

        # Step 2: 清除印章内部白色残留
        print("Step 2: 清除印章内部白色残留...")
        output_image = output_image.convert("RGBA")
        output_image = clean_inner_white(output_image, white_threshold, gray_threshold)

        output_image.save(output_path)
        return True
    except ImportError:
        print("rembg 未安装，尝试 Pillow 方案...")
        return False
    except Exception as e:
        print(f"rembg 处理失败: {e}，尝试 Pillow 方案...")
        return False


def remove_bg_pillow(input_path: str, output_path: str, threshold: int = 220) -> None:
    """使用 Pillow 阈值分割去背景（回退方案，适用于白底印章）"""
    from PIL import Image

    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    new_data = []
    for item in datas:
        # 将接近白色的像素设为透明
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img.save(output_path)
    print(f"Pillow 方案处理完成（阈值: {threshold}）")


def main():
    parser = argparse.ArgumentParser(description="印章图片去背景")
    parser.add_argument("input", help="输入图片路径")
    parser.add_argument("output", help="输出透明 PNG 路径")
    parser.add_argument("--threshold", type=int, default=220,
                        help="Pillow 方案的白色阈值 (0-255)，默认 220")
    parser.add_argument("--white-threshold", type=int, default=200,
                        help="rembg 方案内部白色清理阈值 (0-255)，默认 200")
    parser.add_argument("--gray-threshold", type=int, default=160,
                        help="rembg 方案内部灰色清理阈值 (0-255)，默认 160")
    parser.add_argument("--method", choices=["rembg", "pillow", "auto"],
                        default="auto", help="去背景方法，默认 auto")
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"错误: 输入文件不存在: {args.input}")
        sys.exit(1)

    if args.method == "rembg":
        if not remove_bg_rembg(args.input, args.output, args.white_threshold, args.gray_threshold):
            print("rembg 方案失败，退出")
            sys.exit(1)
    elif args.method == "pillow":
        remove_bg_pillow(args.input, args.output, args.threshold)
    else:  # auto
        if not remove_bg_rembg(args.input, args.output, args.white_threshold, args.gray_threshold):
            remove_bg_pillow(args.input, args.output, args.threshold)

    print(f"去背景完成: {args.output}")


if __name__ == "__main__":
    main()
