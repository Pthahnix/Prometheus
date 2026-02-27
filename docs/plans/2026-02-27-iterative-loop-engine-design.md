# Iterative Loop Engine Design

> Prometheus 迭代循环引擎设计文档
> 日期：2026-02-27
> 分支：feature/iterative-loop-engine

## 一、设计目标

实现 Jina DeepResearch 式的迭代循环引擎，使 Prometheus 具备自主空白发现和质量控制能力，完全移除对 Perplexity API 的依赖。

### 核心理念

**不是**："如何用其他工具替代 Perplexity"
**而是**："如何通过迭代循环让 Prometheus 自己变强"

通过 search→read→reflect→evaluate 的迭代循环，系统自己发现问题、自己修正，不再需要外部验证。

## 二、整体架构

### Git 分支策略

```bash
git checkout -b feature/iterative-loop-engine
```

- `main` 分支：保持稳定版本（带 Perplexity 依赖）
- `feature/iterative-loop-engine` 分支：实验迭代循环引擎
- 测试通过后通过 PR 合并回 `main`

### 文件变更范围

**需要修改的文件**：
- `skill/literature-survey.md` — 重写为迭代循环模式
- `skill/gap-analysis.md` — 重写为迭代循环模式
- `skill/idea-generation.md` — 重写为迭代循环模式
- `skill/experiment-design.md` — 重写为迭代循环模式
- `skill/tools.md` — 移除 Perplexity 工具描述

**需要新增的文件**：
- `prompt/reflect-gaps.md` — 空白检测 prompt
- `prompt/evaluate-answer.md` — 答案评估 prompt

**不需要修改的文件**：
- `src/` 下的所有代码（MCP 工具保持不变）
- 现有 prompt 文件（继续使用）

## 三、迭代循环机制

### 循环状态管理

```typescript
interface LoopState {
  gaps: string[]              // 未解决的子问题队列
  knowledge: Finding[]        // 已确认的发现
  diary: string[]             // 叙事记忆（每轮做了什么）
  iteration: number           // 当前迭代次数
  noProgressCount: number     // 连续无新发现的轮数
  papersRead: Set<string>     // 已读论文的 normalizedTitle 集合
}

interface Finding {
  question: string            // 回答了哪个 gap
  answer: string              // 答案内容
  sources: string[]           // 来源论文/网页
  confidence: 'high' | 'medium' | 'low'
}
```

### 四阶段循环

```
LOOP (while gaps.length > 0 AND iteration < MAX_ITERATIONS):

  1. SEARCH 阶段
     - 取当前 gap: currentGap = gaps[iteration % gaps.length]
     - 查询改写（3 个角度：核心/技术/应用）
     - 并行搜索: acd_search × 3 + web_search × 3
     - 去重：过滤 papersRead 中已有的论文
     - 记录到 diary

  2. READ 阶段
     - 读取 top 8-12 篇 markdown
     - 优先级排序（引用数、年份、venue、相关性）
     - 提取与 currentGap 相关的段落
     - 将读取的论文加入 papersRead
     - 记录到 diary: "阅读了 K 篇，累计已读 papersRead.size 篇"

  3. REFLECT 阶段
     - 调用 prompt/reflect-gaps.md
     - 输入: currentGap + knowledge + 本轮读取内容 + diary
     - 输出: newGaps[] + progressAssessment
     - 如果 newGaps 非空: gaps.push(...newGaps)
     - 如果 newGaps 为空: noProgressCount++
     - 记录到 diary

  4. EVALUATE 阶段
     - 调用 prompt/evaluate-answer.md
     - 输入: currentGap + knowledge
     - 输出: canAnswer + answer + confidence + sources
     - 如果 canAnswer == true:
         gaps.remove(currentGap)
         knowledge.push({question, answer, sources, confidence})
     - 记录到 diary

  5. 停止条件检查
     - gaps.length == 0: "所有问题已解决"
     - noProgressCount >= 3: "连续 3 轮无新发现"
     - papersRead.size >= MIN_PAPERS_TARGET: "达到阅读量目标"
     - iteration >= MAX_ITERATIONS: "达到最大迭代次数"
     - iteration++

END LOOP

输出最终报告（基于 knowledge + diary）
```

### 关键参数

| Skill | MAX_ITERATIONS | MIN_PAPERS_TARGET | 每轮阅读量 |
|-------|---------------|------------------|----------|
| literature-survey | 10 | 50 | 8-12 |
| gap-analysis | 6 | 30 | 8-12 |
| idea-generation | 5 | 20 | 8-12 |
| experiment-design | 4 | 15 | 8-12 |

**总阅读量预期**：115 篇（去重后约 80-100 篇独立论文）

**其他参数**：
- `noProgressCount` 阈值: 3 轮
- 查询改写数量: 每个 gap 改写为 3 个查询
- 每轮搜索次数: 6 次（3 查询 × 2 工具）

## 四、自主能力设计

### 1. 自主空白发现

**传统方式（依赖外部验证）**：
```
搜索 → 阅读 → 生成报告 → 调用 pplx_deep_research 验证 → 发现遗漏
```

**迭代循环方式（自主发现）**：
```
搜索 → 阅读 → 反思："我还不知道什么？" → 发现遗漏 → 再搜索
↑_______________________________________________|
```

**关键**：`reflect` 阶段不是"验证已有答案"，而是"发现未知的未知"。

### 2. 自主质量控制

**传统方式**：
```
生成答案 → 外部工具判断好坏
```

**迭代循环方式**：
```
尝试回答 → 自己判断"信息是否充分" → 不充分则继续搜索
```

**关键**：`evaluate` 阶段不是"打分"，而是"判断是否可以停止搜索"。

### 3. 自主深度控制

**传统方式**：
```
固定搜索 3 次，无论结果如何
```

**迭代循环方式**：
```
简单问题：2-3 轮就能解决所有 gaps，自动停止
复杂问题：持续搜索直到 gaps 清空或达到上限
```

**关键**：停止条件是"任务完成"，不是"次数用完"。

## 五、新增 Prompt 设计

### prompt/reflect-gaps.md

```markdown
# 研究空白反思

你是一个严谨的研究员。基于当前已读的论文，反思：**我还不知道什么？**

## 输入
- 当前研究问题：{currentGap}
- 已读论文摘要：{readContent}
- 已有发现：{knowledge}

## 反思维度
1. 我是否理解了这个领域的主要方法？
2. 我是否知道最新的进展（2024-2025）？
3. 我是否看到了不同流派/观点的对比？
4. 我是否理解了实际应用中的挑战？
5. 我是否发现了论文中提到但我不了解的概念/方法？

## 输出
如果发现空白，列出**具体的、可搜索的子问题**。
如果当前问题已经清楚，返回空列表。

**原则**：只提出你真正不知道、需要搜索才能回答的问题。
```

### prompt/evaluate-answer.md

```markdown
# 答案充分性评估

你是一个严格的研究员。判断：**我现在能否回答这个问题？**

## 输入
- 问题：{currentGap}
- 已读论文：{knowledge}

## 判断标准
- 我是否有足够的证据（>= 2 篇论文）？
- 我是否理解了核心概念（不只是看到了名词）？
- 我是否能给出具体的例子/数据？

## 输出
- **能回答**：给出答案 + 列出支撑来源
- **不能回答**：说明还缺什么信息

**原则**：宁可多搜索一轮，不要基于不充分的信息强行回答。
```

## 六、四个 Skill 的改造方案

### Literature Survey

**新结构（迭代循环）**：
```
初始化:
  gaps = [
    "该领域的主要方法有哪些？",
    "最新进展（2024-2025）是什么？",
    "主要研究组和代表性工作？"
  ]
  knowledge = []
  papersRead = Set()
  iteration = 0

LOOP (max 10 轮):
  currentGap = gaps[iteration % gaps.length]

  SEARCH: 查询改写 → acd_search × 3 + web_search × 3 → 去重
  READ: 读取 8-12 篇 → 评级 → 三遍/两遍/一遍阅读 → papersRead.add()
  REFLECT: 发现新空白 → gaps.push()
  EVALUATE: 判断是否可回答 → gaps.remove()

  停止检查: gaps.length == 0 OR noProgressCount >= 3 OR papersRead.size >= 50 OR iteration >= 10

输出: 领域全景 + 论文列表 + 关键主题 + 研究日志
```

**关键改变**：
- 移除固定的"Tier 1-2-3 增强"步骤
- 移除 `pplx_pro_research` 和 `pplx_deep_research` 调用
- 引用扩展（dfs_search）在 READ 阶段按需触发

### Gap Analysis

**新结构（迭代循环）**：
```
初始化:
  gaps = [
    "现有方法的主要局限性是什么？",
    "哪些应用场景尚未被充分研究？",
    "理论与实践之间的差距在哪里？"
  ]
  knowledge = [] (继承 survey)
  papersRead = Set() (继承 survey)
  iteration = 0

LOOP (max 6 轮):
  SEARCH: 聚焦"问题/挑战/局限性"的查询
  READ: 重点关注 Limitations / Future Work 章节
  REFLECT: 发现新的研究空白
  EVALUATE: 判断空白是否被充分论证

  停止检查: gaps.length == 0 OR noProgressCount >= 3 OR papersRead.size >= 30 OR iteration >= 6

输出: 研究空白列表 + 论证 + 优先级排序
```

**关键改变**：
- 移除"双源验证"步骤（web_search + pplx_ask）
- Gap 识别本身就是迭代过程

### Idea Generation

**新结构（迭代循环）**：
```
初始化:
  gaps = ["如何解决 gap1？", "如何解决 gap2？", ...] (从 gap-analysis 继承)
  knowledge = [] (继承前两阶段)
  ideas = []
  iteration = 0

LOOP (max 5 轮):
  SEARCH: 搜索解决方案、类似问题的解决思路
  READ: 重点关注方法创新、跨领域借鉴
  REFLECT: 生成 idea 候选 + 检查新颖性
  EVALUATE: 判断 idea 是否可行

  停止检查: ideas.length >= 3 OR gaps.length == 0 OR noProgressCount >= 3 OR iteration >= 5

输出: 候选 idea 列表 + 新颖性论证 + 可行性分析
```

**关键改变**：
- 移除独立的"新颖性检查"步骤（pplx_search）
- 新颖性检查内嵌在 REFLECT 阶段

### Experiment Design

**新结构（迭代循环）**：
```
初始化:
  gaps = [
    "如何评估该 idea 的效果？",
    "需要哪些 baseline 对比？",
    "需要哪些数据集？",
    "实验设置的关键参数是什么？"
  ]
  knowledge = [] (继承前三阶段)
  experimentPlan = {}
  iteration = 0

LOOP (max 4 轮):
  SEARCH: 搜索类似工作的实验设置
  READ: 重点关注 Experiments / Evaluation 章节
  REFLECT: 识别实验设计中的遗漏
  EVALUATE: 判断实验设计是否完整

  停止检查: gaps.length == 0 OR experimentPlan 完整 OR iteration >= 4

输出: 完整实验设计 + 数据集/Baseline/指标选择 + 理由
```

**关键改变**：
- 移除 `pplx_deep_research` 验证
- 实验设计的完整性通过迭代循环自然达成

## 七、实施细节

### 查询改写策略

每轮搜索时，将单一 gap 改写为 3 个不同角度的查询：

```
原始 gap: "LLM 量化方法有哪些？"

改写为 3 个查询：
1. 核心查询（直接）: "LLM quantization methods"
2. 技术查询（具体）: "post-training quantization weight quantization activation quantization"
3. 应用查询（场景）: "LLM quantization deployment inference optimization edge devices"
```

每轮实际执行 **6 次搜索**（3 查询 × 2 工具）。

### 论文去重与优先级排序

**去重机制**：
```
papersRead = Set<normalizedTitle>
每轮搜索后：过滤已读论文
每轮阅读后：papersRead.add(normalizedTitle)
```

**优先级排序**：
```
评分 = 0.3 × log(citationCount + 1)
      + 0.4 × (year >= 2024 ? 2 : year >= 2023 ? 1 : 0)
      + 0.2 × (顶会 ? 1 : 0)
      + 0.1 × 相关性
```

### 停止条件的精确定义

1. **gaps 清空**：所有研究问题已解决
2. **连续无新发现**：noProgressCount >= 3
3. **达到阅读量目标**：papersRead.size >= MIN_PAPERS_TARGET
4. **达到迭代上限**：iteration >= MAX_ITERATIONS（兜底）

## 八、风险控制

### 风险 1：无限循环
- **控制**：MAX_ITERATIONS 硬性上限 + noProgressCount 检测
- **检测**：新 gap 与已有 gap 高度相似（编辑距离 < 3）视为重复

### 风险 2：搜索结果质量差
- **控制**：连续 2 轮搜索结果 < 5 篇，标记为"低优先级"
- **降级策略**：低优先级 gap 只在 `iteration % 3 == 0` 时处理

### 风险 3：阅读量不足
- **控制**：触发"扩展模式"
  - 放宽搜索范围
  - 降低论文筛选阈值
  - 触发 dfs_search 扩展引用图

### 风险 4：diary 过长
- **控制**：只保留最近 5 轮详细记录，早期轮次压缩为摘要

## 九、测试与验证

### 阶段 1：单 skill 测试
- 测试用例: "3D Gaussian Splatting for real-time rendering"
- 验证指标: 阅读量、覆盖面、时效性、迭代轮数、停止条件

### 阶段 2：完整流程测试
- 测试用例: 同一研究主题，跑完整 pipeline
- 验证指标: 总阅读量、空白识别、idea 生成、实验设计、总耗时

### 阶段 3：边界情况测试
- 非常新的主题（论文很少）
- 非常成熟的主题（论文很多）
- 模糊的研究问题

### 性能对比

| 维度 | main 分支 | 新分支 | 预期 |
|------|----------|--------|------|
| 论文阅读量 | ~30-40 | >= 80 | 新分支更多 |
| 搜索覆盖面 | 固定角度 | 动态多角度 | 新分支更广 |
| 空白发现 | 依赖 pplx | 自主 reflect | 新分支更强 |
| 成本 | ~$1.80 | $0 | 新分支更低 |
| 耗时 | ~30-45 分钟 | ~60-90 分钟 | 新分支更长 |

## 十、迁移决策

### 何时合并到 main
1. 单 skill 测试通过
2. 完整流程测试通过
3. 边界情况测试通过
4. 至少 2 个真实研究主题验证
5. 用户认可输出质量

### 何时保留两个分支
- 新分支质量更高但耗时显著增加
- 保留两个分支供用户选择：
  - `main`: 快速模式（30 分钟，依赖 pplx）
  - `feature/iterative-loop-engine`: 深度模式（90 分钟，自主循环）

### 回滚策略
```bash
git checkout main  # 切换回稳定版本
git branch -D feature/iterative-loop-engine  # 删除新分支（可选）
```

## 十一、输出格式

每个 skill 的最终输出包含：

### 1. 执行摘要
```markdown
## 执行摘要
- 总迭代轮数: X
- 总阅读论文数: Y
- 初始问题数: A
- 最终解决问题数: B
- 未解决问题: [列表]
- 停止原因: [gaps 清空 / 无新发现 / 达到阅读量 / 达到上限]
```

### 2. 研究发现
```markdown
## 研究发现
### 主要发现 1
- 问题: ...
- 答案: ...
- 支撑来源: [论文1, 论文2, ...]
- 置信度: high/medium/low
```

### 3. 论文列表
```markdown
## 已读论文 (按评级分组)
### High Priority (X 篇)
- [Title] (Year, Citations, Venue)
  - 关键贡献: ...
```

### 4. 研究日志
```markdown
## 研究日志
第 1 轮: 搜索了"..."，找到 X 篇论文，发现 Y 个新空白
第 2 轮: 搜索了"..."，读了 Z 篇，成功回答了问题"..."
...
```

## 十二、总结

本设计通过引入 Jina DeepResearch 式的迭代循环引擎，使 Prometheus 具备：

1. **自主空白发现能力**：通过 reflect 阶段动态识别"未知的未知"
2. **自主质量控制能力**：通过 evaluate 阶段判断信息充分性
3. **自主深度控制能力**：根据任务复杂度自适应调整搜索深度
4. **完全独立性**：不再依赖 Perplexity API，成本降为 $0

核心哲学：**不是替代 Perplexity，而是让 Prometheus 自己变强**。
