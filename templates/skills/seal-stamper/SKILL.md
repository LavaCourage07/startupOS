---
name: 印章盖章
code: seal-stamper
description: 根据用户上传的公司印章图片和 Word 文档，自动去除印章背景生成透明底图，并将印章图片以"浮于文字上方"的布局嵌入到 Word 文档的指定盖章位置。当用户提到盖章、印章、公司章、公章、签章、印章透明、去印章背景、Word盖章、合同盖章等场景时，请使用此技能。
originos-system: true
version: 1.1.0
type: SIMPLE
author: OriginOS
tags:
  - 印章
  - 盖章
  - Word
  - 图片处理
  - OOXML
reads:
  - 图片文件
  - Word文档
writes:
  - Word文档
prerequisites:
  - python-docx
  - Pillow
  - lxml
  - rembg
dependencies: []
---

# 印章盖章

将公司印章图片去除背景后，以"浮于文字上方"的布局嵌入到 Word 文档的指定盖章位置。

## 触发场景

- 用户上传了印章图片和 Word 文件，要求将印章盖到文档上
- 用户提到"盖章"、"公司章"、"公章"、"合同盖章"等需求
- 用户需要对印章图片去背景并放入 Word 文档
- 用户要求印章图片浮在文字上面，而不是内联在文字流中

## 技术原理

本技能通过直接操作 OOXML（Office Open XML）实现浮动图片嵌入：

- **去背景（两步法）**：
  1. 使用 `rembg` 库（基于 U2-Net 深度学习模型）去除印章图片外围背景，生成透明 PNG
  2. 对印章内部白色残留进行二次清理——rembg 会将印章圆形区域整体识别为前景，导致印章内部的白色底色也被保留，需要通过像素颜色分析将白色/灰色像素设为透明
- **浮动图片**：`python-docx` 默认只支持内联图片（`<wp:inline>`），本技能通过 `lxml` 直接操作 OOXML XML，使用 `<wp:anchor>` 元素替代，设置 `behindDocument="0"` 实现浮于文字上方
- **定位**：通过 `<wp:positionH>` 和 `<wp:positionV>` 精确控制印章在页面上的位置
- **Z-order**：通过 `relativeHeight` 属性控制图片的层叠顺序

## 执行步骤

### Step 1: 确认用户输入

确认用户提供了以下文件：
- **印章图片**：公司印章的图片文件（支持 JPG/PNG/BMP 等格式）
- **Word 文档**：需要盖章的 .docx 文件

**操作**: 检查用户是否已上传印章图片和 Word 文档，如果没有，提示用户上传
**输出**: 确认两个文件路径可用

### Step 2: 去除印章背景（两步法）

读取印章图片，使用两步法去除背景，生成干净的透明底 PNG 图片。

**操作**: 调用 `scripts/remove_bg.py` 脚本处理印章图片
**输出**: 去背景后的透明 PNG 图片文件

#### Step 2.1: rembg 深度学习去除外围背景

使用 rembg 的 U2-Net 模型自动识别并去除印章图片的外围背景。此步骤能准确分离印章与背景，但对印章圆形区域内部的白色底色会作为前景保留。

```python
from rembg import remove
from PIL import Image

input_image = Image.open(input_path)
output_image = remove(input_image)
```

#### Step 2.2: 清除印章内部白色残留

rembg 会把整个印章（包括内部白底）识别为前景，导致印章圆形区域内的白色底色未被去除。此步骤对前景中偏白/偏灰的像素做二次清理：

```python
def clean_inner_white(img, white_threshold=200, gray_threshold=160):
    """清除印章内部白色/灰色残留"""
    datas = img.getdata()
    new_data = []
    for r, g, b, a in datas:
        if a > 0:
            # 纯白/近白：RGB 均高于阈值
            is_white = r > white_threshold and g > white_threshold and b > white_threshold
            # 偏灰色：RGB 三通道值较高且接近（色差小）
            is_gray = (r > gray_threshold and g > gray_threshold and b > gray_threshold
                       and abs(r - g) < 40 and abs(g - b) < 40)
            if is_white or is_gray:
                new_data.append((255, 255, 255, 0))  # 设为透明
            else:
                new_data.append((r, g, b, a))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    return img
```

> **阈值调整**：如果白底清理不够干净，可降低 `--white-threshold`（如 180）使清理更激进；如果误删了印章有效内容，可提高阈值（如 220）使清理更保守。`--gray-threshold` 同理。

> **回退方案**：如果 `rembg` 不可用，回退到 Pillow 阈值分割方案（一步完成，仅适用于白底印章）：将接近白色的像素设置为透明。

### Step 3: 分析 Word 文档内容

读取 Word 文档，分析需要盖章的位置。

**操作**: 遍历 Word 文档段落和表格，识别盖章位置标记
**输出**: 盖章位置列表（段落索引 + 偏移量）

常见的盖章位置标记：
- 包含"（盖章）"、"(盖章)"、"盖章处"、"公司盖章"等文字的段落
- 包含"甲方："、"乙方："等签约方标识后的位置
- 文档末尾签名区域
- 用户明确指定的盖章位置

### Step 4: 计算印章位置和尺寸

根据盖章位置，计算印章在页面上的精确坐标和合适尺寸。

**操作**: 获取目标段落的页面坐标，计算印章的水平和垂直位置
**输出**: 印章的定位参数（水平位置、垂直位置、宽度、高度）

印章尺寸建议：
- 标准公章直径约 42mm，对应 EMU 单位约为 1,524,000
- 可根据文档排版适当缩放（通常为 40-50mm）
- 使用 EMU（English Metric Units）作为 OOXML 的单位：1mm = 36000 EMU

### Step 5: 将印章嵌入 Word 文档

使用 OOXML 的 `<wp:anchor>` 元素将透明印章图片以浮动方式嵌入文档。

**操作**: 调用 `scripts/stamp_docx.py` 脚本，在指定位置插入浮动印章图片
**输出**: 带印章的 Word 文档

核心 OOXML 结构：

```xml
<wp:anchor distT="0" distB="0" distL="0" distR="0"
           simplePos="0" relativeHeight="25"
           behindDocument="0" locked="0"
           layoutInCell="1" allowOverlap="1">
  <wp:simplePos x="0" y="0"/>
  <wp:positionH relativeFrom="page">
    <wp:posOffset>7200000</wp:posOffset>
  </wp:positionH>
  <wp:positionV relativeFrom="paragraph">
    <wp:posOffset>457200</wp:posOffset>
  </wp:positionV>
  <wp:extent cx="1524000" cy="1524000"/>
  <wp:wrapNone/>
  <wp:docPr id="1" name="印章"/>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic>
        <pic:nvPicPr>
          <pic:cNvPr id="0" name="seal.png"/>
          <pic:cNvPicPr/>
        </pic:nvPicPr>
        <pic:blipFill>
          <a:blip r:embed="rIdSeal"/>
          <a:stretch><a:fillRect/></a:stretch>
        </pic:blipFill>
        <pic:spLn>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="1524000" cy="1524000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </pic:spLn>
      </pic:pic>
    </a:graphicData>
  </a:graphic>
</wp:anchor>
```

关键属性说明：
- `behindDocument="0"` → 印章浮于文字上方（0=前方，1=后方）
- `relativeHeight="25"` → Z-order 层级
- `allowOverlap="1"` → 允许与文字重叠
- `<wp:wrapNone/>` → 文字不环绕（印章覆盖在文字上）
- `<wp:positionH relativeFrom="page">` → 水平定位相对于页面
- `<wp:positionV relativeFrom="paragraph">` → 垂直定位相对于段落

### Step 6: 输出结果

保存盖章后的 Word 文档，向用户展示结果。

**操作**: 保存文档并生成访问链接
**输出**: 盖章后的 Word 文档文件

## CLI 用法参考

> **重要**：所有参数类型必须严格遵守，`--paragraph` 必须是整数（数字），`--size`/`--pos-x`/`--pos-y` 必须是浮点数（数字）。禁止传入文字作为数字参数。

### 去背景脚本 `scripts/remove_bg.py`

```bash
# 基本用法：自动两步去背景（rembg + 内部白色清理）
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png

# 指定方法
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png --method rembg
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png --method pillow

# 指定白色阈值（pillow 方法生效）
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png --method pillow --threshold 220

# 调整 rembg 内部白色清理阈值（白底清理不干净时降低阈值）
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png --white-threshold 180 --gray-threshold 140

# 保守清理（避免误删印章有效内容）
python3 skills/seal-stamper/scripts/remove_bg.py 输入图片.png 输出透明.png --white-threshold 230 --gray-threshold 200
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | 字符串（文件路径） | 是 | 输入图片路径 |
| `output` | 字符串（文件路径） | 是 | 输出透明 PNG 路径 |
| `--method` | 字符串枚举 | 否 | `rembg` / `pillow` / `auto`（默认 auto） |
| `--threshold` | 整数 | 否 | Pillow 方案白色阈值 0-255（默认 220，仅 pillow 方法） |
| `--white-threshold` | 整数 | 否 | rembg 方案内部白色清理阈值 0-255（默认 200，值越低清理越激进） |
| `--gray-threshold` | 整数 | 否 | rembg 方案内部灰色清理阈值 0-255（默认 160，值越低清理越激进） |

### 盖章脚本 `scripts/stamp_docx.py`

```bash
# 基本用法：自动检测盖章位置
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx

# 指定第 3 段落盖章（--paragraph 必须是整数）
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --paragraph 3

# 指定印章尺寸（毫米，浮点数）
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --size 42.0

# 指定精确坐标（毫米，浮点数）
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --pos-x 120.5 --pos-y 50.0

# 组合使用：第 5 段落 + 自定义尺寸
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --paragraph 5 --size 42.0

# 印章衬于文字下方
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --behind

# 禁用自动检测（仅在指定 --paragraph 或 --pos-x/--pos-y 时使用）
python3 skills/seal-stamper/scripts/stamp_docx.py 合同.docx 印章.png 输出.docx --paragraph 5 --no-auto-detect
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `docx` | 字符串（文件路径） | 是 | Word 文档路径 |
| `seal` | 字符串（文件路径） | 是 | 去背景后的印章图片路径 |
| `output` | 字符串（文件路径） | 是 | 输出文件路径 |
| `--paragraph` | **整数** | 否 | 目标段落索引（从 0 开始） |
| `--size` | **浮点数** | 否 | 印章直径，单位毫米（默认 42.0） |
| `--pos-x` | **浮点数** | 否 | 水平位置，单位毫米 |
| `--pos-y` | **浮点数** | 否 | 垂直位置，单位毫米 |
| `--behind` | 标志位 | 否 | 衬于文字下方（默认浮于上方） |
| `--no-auto-detect` | 标志位 | 否 | 禁用自动检测盖章位置 |

## 输入格式

| 输入项 | 格式 | 说明 |
|--------|------|------|
| 印章图片 | JPG/PNG/BMP | 公司印章的扫描件或照片 |
| Word 文档 | .docx | 需要盖章的合同或文件 |

用户也可以通过自然语言指定盖章位置，例如：
- "在甲方盖章处盖上公司章"
- "在文档最后一页的签名处盖章"
- "在所有写有（盖章）的地方都盖上章"

## 输出格式

盖章后的 Word 文档（.docx），印章图片以"浮于文字上方"布局显示。

## 示例

**输入示例**:
用户上传了 `公司公章.png` 和 `合同文件.docx`，说："帮我把公司章盖到这份合同的甲方盖章处"

**输出示例**:
1. 识别印章图片 → rembg 去除外围背景 → 清除印章内部白色残留 → 生成干净透明印章
2. 扫描合同 → 找到"甲方（盖章）"位置
3. 在该位置以浮动方式嵌入透明印章图片
4. 输出盖章后的 `合同文件_已盖章.docx`

## 注意事项

1. **去背景必须两步处理**：rembg 只能去除图片外围背景，但会把印章圆形区域内部的白底也保留为前景。必须执行第二步"清除印章内部白色残留"，否则印章中间会出现白底。脚本 `remove_bg.py` 默认自动执行两步处理。
2. **白色残留清理阈值调整**：如果印章内部白底未清理干净，降低 `--white-threshold`（如 180）和 `--gray-threshold`（如 140）；如果误删了印章有效内容（如浅色印章文字），提高阈值（如 `--white-threshold 230`）。
3. **印章尺寸**：标准公章直径约 42mm，不同类型印章尺寸不同（财务章约 22×22mm，法人章约 20×20mm），插入前需确认印章类型
4. **多页盖章**：如果文档有多页多处需要盖章，需要逐一定位和插入
5. **坐标计算**：OOXML 使用 EMU 单位（1 inch = 914400 EMU，1 mm = 36000 EMU），定位时注意单位转换
6. **文件保护**：盖章后的文档建议设置文档保护，防止印章被随意移动或删除
7. **rembg 首次运行**：首次使用 `rembg` 会自动下载 U2-Net 模型（约 176MB），需要网络连接
8. **备用去背景方案**：如果 `rembg` 不可用，使用 Pillow 白色阈值分割作为回退（仅一步，适用于白底印章）：
   ```python
   from PIL import Image
   img = Image.open(input_path).convert("RGBA")
   datas = img.getdata()
   new_data = []
   for item in datas:
       if item[0] > 220 and item[1] > 220 and item[2] > 220:
           new_data.append((255, 255, 255, 0))
       else:
           new_data.append(item)
   img.putdata(new_data)
   img.save(output_path)
   ```
