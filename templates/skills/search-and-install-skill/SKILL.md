---
name: 搜索并安装市场技能
code: search-and-install-skill
description: 自动根据用户输入的技能关键词或分类，从技能市场搜索匹配项，分析来源平台，下载并安装。
version: 1.3.0
type: SIMPLE
author: OriginOS
outputDir: data/
tags:
  - 技能管理
  - 安装
  - 搜索
reads:
  - 用户输入关键词或分类
writes:
  - data/skills 目录下的技能文件
prerequisites: []
dependencies: []
---

# 搜索并安装市场技能

该技能可让用户通过输入技能关键词或浏览分类，自动从技能市场搜索匹配技能，并在确认后下载并安装到本地 `${OUTPUT_DIR}/skills/` 目录下。

## 触发场景
- 用户希望安装某个具体技能时，输入技能名称或关键词进行搜索
- 用户希望浏览某个分类的技能时，指定分类名称（如 devops、data、security 等）

## 执行步骤

### Step 1: 引导
提示用户输入技能名称，并说明技能的使用方式。

**操作**: 输出引导信息，引导用户提供关键词。
**输出**: 用户输入的技能关键词。

### Step 2: 搜索技能

根据用户需求选择合适的查询方式：

#### 方式 A: 关键词搜索
当用户提供具体的技能名称或关键词时，使用搜索接口：
```
GET https://findskills.org/api/v1/search?q={keyword}
Headers:
  Authorization: Bearer fs-key-57491c655912283dea8c0d519d9b73e6d1e64930be3762ed
```

#### 方式 B: 分类浏览
当用户想要浏览某个分类的技能时，使用列表接口：
```
GET https://findskills.org/api/v1/skills?category={category}&sort={sort}&limit={limit}
Headers:
  Authorization: Bearer fs-key-57491c655912283dea8c0d519d9b73e6d1e64930be3762ed
```

参数说明：
- `category`: 技能分类（如 `devops`、`data`、`security` 等）
- `sort`: 排序方式（可选，如 `stars`、`updated`、`created`）
- `limit`: 返回数量限制（可选，默认 20）

**操作**: 根据用户输入选择合适的接口，获取技能列表。
**输出**: 匹配到的技能信息列表。

API 返回的 JSON 格式如下：
```json
{
  "skills": [
    {
      "id": "author-name",
      "name": "Skill Name",
      "description": "Skill description",
      "author": "author-name",
      "tags": [],
      "category": "devops",
      "source": "clawhub",
      "url": "https://clawhub.ai/skills/skill-slug",
      "stars": 0,
      "safety_label": "community"
    }
  ]
}
```

关键字段说明：
- **`category`**: 技能分类（devops、data、security 等）
- **`source`**: 技能来源平台，可能值为 `"clawhub"`、`"github"`、`"smithery"` 等
- **`url`**: 技能的页面地址，根据 `source` 不同，格式不同

**API 限流说明**：
- 搜索接口：访客 30 次/10 分钟，开发者 100 次/10 分钟
- 列表接口：访客 30 次/5 分钟，开发者 100 次/5 分钟
- 每日结果限制：访客 200 条/天，开发者 1000 条/天
- 所有响应缓存 5 分钟

### Step 3: 展示搜索结果
展示获取到的技能信息（名称、简介、作者、分类、来源平台、技能页面地址等），让用户确认自己想要安装的技能。

系统输出格式示例：
```
找到以下技能：

1️⃣ 名称：{name}
   作者：{author}
   分类：{category}
   来源：{source}
   地址：{url}
   简介：{description}
```

**操作**: 输出技能搜索结果。
**输出**: 用户选择目标技能。

### Step 4: 用户确认要安装的技能
等待用户确认需要安装的技能。

**操作**: 接收用户输入（确认安装）。
**输出**: 被选中的技能标识。

### Step 5: 下载并安装技能
根据用户选择的技能信息中的 `source` 字段判断技能来源，使用不同的下载策略。

#### 5.1 source 为 "github"（Git 仓库地址）
如果 `source` 为 `"github"`，`url` 格式为 `https://github.com/user/repo`：

1. 将仓库地址转换为 ZIP 下载地址：
   - 将 `https://github.com/user/repo` 转换为 `https://github.com/user/repo/archive/refs/heads/main.zip`
   - 如果 main 分支不存在，尝试 `master.zip`
2. 使用工具下载 ZIP 文件到临时目录
3. **创建技能专属目录**：`mkdir -p ${OUTPUT_DIR}/skills/{skill-id}/`
4. 将 ZIP 解压到该目录下
5. 清理临时 ZIP 文件

**操作**:
```bash
# 转换 GitHub URL 为 ZIP URL
# 输入: https://github.com/user/repo
# 输出: https://github.com/user/repo/archive/refs/heads/main.zip

# 下载 ZIP
cd /tmp && curl -L -o skill.zip https://github.com/user/repo/archive/refs/heads/main.zip
# 创建技能目录
cd {project_root} && mkdir -p ${OUTPUT_DIR}/skills/{skill-id}
# 解压到技能目录
unzip -o /tmp/skill.zip -d ${OUTPUT_DIR}/skills/{skill-id}/
# 清理
rm /tmp/skill.zip
```

#### 5.2 source 为 "clawhub"（ClawHub 平台）
如果 `source` 为 `"clawhub"`，`url` 格式为 `https://clawhub.ai/owner/slug`：

1. **获取页面 HTML**：
   ```bash
   curl -s -L {skill_url} -o /tmp/skill_page.html
   ```

2. **让 LLM 分析 HTML 提取下载链接**：
   - 将 `/tmp/skill_page.html` 的内容读取出来
   - 分析 HTML 中所有包含 `download`、`.zip`、`api`、`href` 的链接或按钮
   - 识别出哪个是技能 ZIP 包的下载链接（通常是一个 `<a>` 标签或 `fetch` 请求的地址）
   - 如果下载链接是相对路径，拼接为完整 URL（基础域名为 `https://clawhub.ai`）
   - 确认提取到的下载链接

3. **下载并解压**：
   ```bash
   # 使用提取到的真实下载链接下载
   cd /tmp && curl -L -o skill.zip {extracted_download_url}
   # 创建技能目录
   cd {project_root} && mkdir -p ${OUTPUT_DIR}/skills/{skill-id}
   # 解压到技能目录
   unzip -o /tmp/skill.zip -d ${OUTPUT_DIR}/skills/{skill-id}/
   # 清理
   rm /tmp/skill.zip /tmp/skill_page.html
   ```

**注意**：
- 下载链接不是固定的 URL 拼接，必须通过分析页面 HTML 内容来提取
- 重点关注页面中的 `<a>` 标签、`data-href` 属性、`fetch()` 调用等
- 如果页面是 SPA（客户端渲染），HTML 中可能只有 JS 脚本，需要分析 JS 文件中的 API 调用路径

#### 5.3 source 为 "smithery"
如果 `source` 为 `"smithery"`，`url` 格式为 `https://smithery.ai/servers/author/name`：

1. 尝试从 Smithery 页面提取下载链接（类似 ClawHub 的方式）
2. 下载 ZIP 到临时目录
3. 创建技能目录并解压：`mkdir -p ${OUTPUT_DIR}/skills/{skill-id}/`
4. 清理临时文件

#### 5.4 直接 ZIP 下载链接
如果返回的技能 URL 直接以 `.zip` 结尾，则：
1. 下载 ZIP 文件到临时目录
2. **创建技能目录**：`mkdir -p ${OUTPUT_DIR}/skills/{skill-id}/`
3. 解压到技能目录下
4. 清理临时 ZIP 文件

### Step 6: 重写技能元数据为 OriginOS 规范

下载的技能 SKILL.md 的 frontmatter 格式各不相同，必须统一改写为 OriginOS 定义的规范格式，确保技能能被正确加载。

#### OriginOS 技能元数据规范

每个技能的 `SKILL.md` 文件头部必须包含标准 YAML frontmatter：

```yaml
---
name: {skill-id}
code: {skill-id}
description: {从 API 返回的技能描述，若无则从 SKILL.md 正文第一段提取}
version: 1.0.0
type: SIMPLE
author: {API 返回的 author 字段}
tags: [{从 API 返回的 tags 提取，若无则为空}]
reads: []
writes: []
prerequisites: []
dependencies: []
---
```

字段说明：
- **`name`**: 技能显示名称，使用 API 返回的 `name` 字段
- **`code`**: 技能唯一标识，使用 API 返回的 `id` 字段（如 `clawhub-naif`）
- **`description`**: 一句话描述（必填），优先使用 API 返回的描述；若为空，从原 SKILL.md 正文第一段提取核心内容
- **`version`**: 初始版本固定为 `1.0.0`
- **`type`**: 固定为 `SIMPLE`（市场安装的技能均为简单技能）
- **`author`**: 原作者标识，使用 API 返回的 `author` 字段
- **`tags`**: 标签列表，从 API 返回的 `tags` 和 `category` 合并
- **`reads`/`writes`**: 读写声明，初始为空数组，用户后续可手动补充
- **`prerequisites`/`dependencies`**: 依赖声明，初始为空数组

#### 执行步骤

1. **完整读取**解压后目录下的 `SKILL.md` 文件全文
2. 提取原文件 `---` frontmatter 结束行之后的**全部正文内容**，存入一个变量中
3. 使用 `write_file` 工具重写整个文件：**新的 frontmatter + 步骤 2 中保存的完整正文**

⚠️ **关键**：步骤 2 提取的正文内容必须**原封不动**保留，包括所有的标题、步骤、代码块、列表、段落等。**绝不能用任何占位文字**（如 `(正文保持不变)`、`{原文}` 等）**替换实际内容**。

**操作示例**:

假设技能信息为：
- id: `clawhub-naif`
- name: `Naif - PDF 分析`
- description: `Analyze PDF documents for risks and issues`
- author: `naif-team`
- tags: `["security", "pdf"]`
- category: `devops`

假设原 SKILL.md 内容为：
```markdown
---
original_key: value
---

# Naif Skill

## Step 1: Analyze
Read the PDF and...

## Step 2: Report
Generate a report...
```

则重写后的 SKILL.md 应为：

```markdown
---
name: Naif - PDF 分析
code: clawhub-naif
description: Analyze PDF documents for risks and issues
version: 1.0.0
type: SIMPLE
author: naif-team
tags:
  - security
  - pdf
  - devops
reads: []
writes: []
prerequisites: []
dependencies: []
---

# Naif Skill

## Step 1: Analyze
Read the PDF and...

## Step 2: Report
Generate a report...
```

注意：`# Naif Skill` 及其后的**所有内容必须完整保留**，不能省略、不能替换为占位符。

**注意事项**：
- 必须使用 `write_file` 完整重写文件，不要用 `sed` 插入单行
- 原正文内容（第一个 `---` 结束行之后的部分）必须完整保留，**逐字复制，不得修改或省略任何段落**
- 如果原 SKILL.md 没有 frontmatter（即没有 `---` 分隔），则直接在文件头部插入新的 frontmatter，原有全文作为正文
- 如果原描述为空或过于简短，从正文第一段提取一句话作为补充
- 写文件之前务必确认正文变量中包含了原文件的所有内容，而非占位文字

### Step 7: 创建 Memory.md、Patterns.md 和 evolution.json

安装的技能必须包含 OriginOS 认知系统文件，确保技能在执行过程中能积累记忆和经验，并支持 Eval 自进化。

在 `${OUTPUT_DIR}/skills/{skill-id}/` 目录下创建以下文件：

#### Memory.md

```markdown
# Memory

## human
{description: 用户画像、偏好、历史习惯}
{limit: 2000}
{readOnly: false}

（初始为空，技能执行时由 Agent 自动写入）

## persona
{description: 技能角色认知、工作风格}
{limit: 2000}
{readOnly: false}

（初始为空，技能执行时由 Agent 自动写入）

## project
{description: 当前项目状态、活跃任务、关键决策}
{limit: 2000}
{readOnly: false}

（初始为空，技能执行时由 Agent 自动写入）

## scratchpad
{description: 临时笔记、待办、注意项}
{limit: 1000}
{readOnly: false}

（初始为空，技能执行时由 Agent 自动写入）

## temporal
{description: 关键事件时间线}
{limit: 3000}
{readOnly: true}

（初始为空，技能执行时由 Agent 自动追加）
```

#### Patterns.md

```markdown
# Patterns

## 最佳实践

（初始为空，技能多次执行后由 Agent 分析提炼）

## 反模式

（初始为空，技能执行失败时由 Agent 记录）

## 反思记录

（初始为空，每次执行后由 Agent 追加反思）
```

#### evolution.json

```json
{
  "runs": [],
  "version": 1
}
```

evolution.json 是 Eval 自进化机制的数据文件。系统会在每次技能执行后自动记录执行信号，当累积到阈值（≥10 次、成功率 < 80%）时，自动启动临时 Pi Agent 分析执行历史并改进 SKILL.md。

**操作**:
1. 检查 `${OUTPUT_DIR}/skills/{skill-id}/Memory.md` 是否已存在，不存在则创建
2. 检查 `${OUTPUT_DIR}/skills/{skill-id}/Patterns.md` 是否已存在，不存在则创建
3. 检查 `${OUTPUT_DIR}/skills/{skill-id}/evolution.json` 是否已存在，不存在则创建
4. 使用 `write_file` 工具写入文件

**输出**: 确认认知系统和自进化文件已创建

### Step 8: 提示安装成功

安装完成后，展示提示信息，包括技能名称、简介、版本等信息。

**操作**: 输出安装结果，列出 `${OUTPUT_DIR}/skills/{skill-id}/` 目录下新增的文件（SKILL.md、Memory.md、Patterns.md、evolution.json）。
**输出**: 对话回复，提示安装成功。

## 输入格式
用户输入关键词（文字描述）。

## 输出格式
在对话中展示搜索结果及安装完成提示。

## 示例

**输入示例 1（关键词搜索）:**
> 安装"文档风险分析"技能

**输出示例 1:**
> 找到技能「文档风险分析」，作者 OriginOS，分类: security，来源: clawhub。是否安装？
> ✓ 技能『文档风险分析』已成功安装至 ${OUTPUT_DIR}/skills/！

**输入示例 2（分类浏览）:**
> 浏览 devops 分类的技能

**输出示例 2:**
> 找到 devops 分类下的技能：
> 1️⃣ CI/CD Pipeline Builder - 自动化构建和部署流水线
> 2️⃣ Docker Container Manager - 容器管理和编排
> 3️⃣ Kubernetes Deployer - K8s 应用部署工具
> 请选择要安装的技能编号。

## 注意事项
- 需要有效的技能市场访问 Key。
- 搜索结果取决于关键词匹配精度。
- 安装后可立即调用技能执行。
- 所有技能均下载到 `${OUTPUT_DIR}/skills/{skill-id}/` 目录下，每个技能有独立的子目录。
- **必须先创建技能专属目录**：`mkdir -p ${OUTPUT_DIR}/skills/{skill-id}/`，再将 ZIP 解压到该目录，禁止直接解压到 `${OUTPUT_DIR}/skills/` 根目录。
- `{skill-id}` 使用 API 返回的技能 `id` 字段（如 `clawhub-naif`）。
- 下载 ZIP 文件时使用 `curl -L` 跟随重定向。
- 解压时注意保留目录结构，避免文件散落。
- **ClawHub 下载链接提取是关键步骤**：必须先获取页面 HTML，将内容交由 LLM 分析提取真实下载链接，不要假设固定的 URL 格式或硬编码拼接。
- 如果页面是客户端渲染（SPA），HTML 中可能不包含直接下载链接，需要尝试加载相关的 JS 文件，分析其中的 API 调用路径。
