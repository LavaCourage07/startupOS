/**
 * Culture Detection Service
 * Analyzes dialogue and extracts user taste signals using LLM
 *
 * Aligned with docs/specs/epic-C/story-C.1/api-design.md
 */

import {
  CultureDetectionMessage,
  DialogueTurn,
  UserTasteProfile,
  CultureLayerDetection,
  CultureDetectionError,
  ERROR_CODES,
  LLMPromptBuilder,
  createUserTasteProfile,
} from '../types';
import { CultureSessionService, getSessionService } from './CultureSessionService';
import { promises as fs } from 'fs';
import path from 'path';
import { getDataRoot } from '../../../paths';

// ============================================================================
// LLM Prompt Builder
// ============================================================================

export const _DEFAULT_PROMPT_BUILDER: LLMPromptBuilder = {
  /**
   * Build prompt for taste extraction from dialogue
   */
  buildExtractionPrompt(dialogueHistory: DialogueTurn[] | CultureDetectionMessage[]): string {
    // Handle both old and new message formats
    let dialogueText: string;

    if (dialogueHistory.length === 0) {
      dialogueText = 'No dialogue available.';
    } else if ('question' in dialogueHistory[0]!) {
      // Old format (DialogueTurn[])
      dialogueText = (dialogueHistory as DialogueTurn[])
        .map((turn) => `Q: ${turn.question}\nA: ${turn.userResponse}`)
        .join('\n\n');
    } else {
      // New format (CultureDetectionMessage[])
      dialogueText = (dialogueHistory as CultureDetectionMessage[])
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');
    }

    return `你是系统品味分析助手。分析用户的对话，从以下维度提取品味信号：

1. **经验拓扑 (Experience Topology)** - 具身感知领域
   - 识别：用户提到的项目类型、技术栈、工作领域
   - 示例："React"、"企业级系统"、"前端开发"

2. **品味标准 (Taste Standards)** - 对/扭曲感觉描述
   - 识别：用户的偏好和反对倾向
   - 示例："可维护性"（正）、"过度设计"（负）

3. **张力位置 (Tension Position)** - 初步控制/信任倾向
   - 识别：从用词判断倾向
   - 如果不明显：control_level: 0.5, trust_level: 0.5

4. **共生边界 (Symbiosis Boundary)** - 初步委托/保留倾向
   - 识别：用户特别在意或保留的领域
   - 如果不明显：空列表

输出格式：
\`\`\`json
{
  "experience_topology": ["项目类型1", "技术栈1"],
  "taste_standards": {
    "开发": {
      "positive_vibes": ["偏好1"],
      "negative_vibes": ["倾向1"]
    }
  },
  "tension_position": {
    "control_level": 0.5,
    "trust_level": 0.5,
    "intervention_threshold": 0.7
  },
  "symbiosis_boundary": {
    "delegated_domains": [],
    "reserved_domains": [],
    "contextual_triggers": []
  },
  "confidence": 0.7,
  "evidence_quotes": ["用户的具体话语片段"]
}
\`\`\`

对话内容：
${dialogueText}

现在分析并输出 JSON 格式的结果。只输出 JSON，不要其他解释。`;
  },

  /**
   * Build prompt for taste profile summary
   */
  buildSummaryPrompt(tasteProfile: UserTasteProfile): string {
    return `生成用户品味档案的总结：
${JSON.stringify(tasteProfile, null, 2)}

请用简洁的中文总结用户的品味特点。`;
  },
};

// ============================================================================
// Taste Draft Builder
// ============================================================================

/**
 * Taste Draft Builder
 * Constructs TASTE profile from LLM analysis
 */
class TasteDraftBuilder {
  /**
   * Build UserTasteProfile from analysis result
   */
  buildFromAnalysis(
    analysis: Record<string, unknown>,
    userId: string,
    sessionId: string,
    projectId?: string
  ): UserTasteProfile {
    return createUserTasteProfile({
      userId,
      projectId,
      sessionId,
      experience_topology: (analysis['experience_topology'] as string[]) ?? [],
      taste_standards: (analysis['taste_standards'] as Record<string, { positive_vibes: string[]; negative_vibes: string[] }>) ?? {},
      tension_position: {
        control_level: (analysis['tension_position'] as Record<string, number>)?.['control_level'] ?? 0.5,
        trust_level: (analysis['tension_position'] as Record<string, number>)?.['trust_level'] ?? 0.5,
        intervention_threshold: (analysis['tension_position'] as Record<string, number>)?.['intervention_threshold'] ?? 0.7,
      },
      symbiosis_boundary: {
        delegated_domains: (analysis['symbiosis_boundary'] as Record<string, string[]>)?.['delegated_domains'] ?? [],
        reserved_domains: (analysis['symbiosis_boundary'] as Record<string, string[]>)?.['reserved_domains'] ?? [],
        contextual_triggers: (analysis['symbiosis_boundary'] as Record<string, string[]>)?.['contextual_triggers'] ?? [],
      },
      confidence: (analysis['confidence'] as number) ?? 0.5,
    });
  }

  /**
   * Validate taste profile structure
   */
  validate(profile: Record<string, unknown>): boolean {
    try {
      // Basic validation
      if (!profile['userId'] || !profile['createdAt']) {
        return false;
      }

      // Validate required dimensions
      const hasRequired = [
        Array.isArray(profile['experience_topology']),
        profile['taste_standards'] && typeof profile['taste_standards'] === 'object',
        profile['tension_position'] && typeof profile['tension_position'] === 'object',
        profile['symbiosis_boundary'] && typeof profile['symbiosis_boundary'] === 'object',
      ].every(Boolean);

      return hasRequired;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Culture Detection Service
// ============================================================================

/**
 * Culture Detection Service
 */
export class CultureDetectionService {
  private tasteBuilder: TasteDraftBuilder;
  private sessionService: CultureSessionService;
  private tasteDir: string;

  constructor(_promptBuilder?: LLMPromptBuilder, sessionService?: CultureSessionService) {
    this.tasteBuilder = new TasteDraftBuilder();
    this.sessionService = sessionService ?? getSessionService();
    this.tasteDir = path.join(getDataRoot(), 'taste', 'users');
  }

  /**
   * Analyze dialogue and extract taste profile
   */
  async analyzeDialogue(sessionId: string): Promise<{
    tasteProfile: UserTasteProfile;
    cultureLayer: CultureLayerDetection;
    confidence: number;
    evidenceQuotes: string[];
    tasteDraftId: string;
  }> {
    // Mark session as analyzing
    await this.sessionService.markAsAnalyzing(sessionId);

    // Get dialogue history
    const sessionData = await this.sessionService.getSessionForAnalysis(sessionId);

    // Use messages if available, otherwise fall back to dialogueHistory
    const dialogueData = sessionData.messages.length > 0
      ? sessionData.messages
      : sessionData.dialogueHistory;

    // Phase 1: Use simulated LLM analysis (Phase 1.5: integrate pi-agent LLM)
    const { analysis, confidence, evidenceQuotes } = await this.simulateLLMAnalysis(
      dialogueData as DialogueTurn[]
    );

    // Build taste profile
    const tasteProfile = this.tasteBuilder.buildFromAnalysis(
      analysis,
      sessionData.userId,
      sessionId,
      sessionData.projectId
    );

    // Build culture layer detection result
    const cultureLayer: CultureLayerDetection = {
      result: {
        experience_topology: analysis['experience_topology'] as string[] ?? [],
        taste_standards: analysis['taste_standards'] as Record<string, { positive_vibes: string[]; negative_vibes: string[] }> ?? {},
        tension_position: analysis['tension_position'] as CultureLayerDetection['result']['tension_position'],
        symbiosis_boundary: analysis['symbiosis_boundary'] as CultureLayerDetection['result']['symbiosis_boundary'],
      },
      confidence,
      sample_size: Array.isArray(dialogueData) ? dialogueData.length : 0,
      evidence_quotes: evidenceQuotes,
    };

    // Store result
    const tasteDraftId = await this.sessionService.storeAnalysisResult(
      sessionId,
      tasteProfile,
      confidence,
      evidenceQuotes,
      cultureLayer
    );

    // Save taste profile to file
    await this.saveTasteProfile(tasteProfile);

    return {
      tasteProfile,
      cultureLayer,
      confidence,
      evidenceQuotes,
      tasteDraftId,
    };
  }

  /**
   * Get taste draft for session
   */
  async getTasteDraft(sessionId: string): Promise<{
    tasteProfile: UserTasteProfile;
    confidence: number;
    evidenceQuotes: string[];
    analysisCompletedAt: string;
  }> {
    const session = await this.sessionService.getSession(sessionId);

    if (session.status !== 'completed' || !session.analysisResult) {
      throw new CultureDetectionError(
        ERROR_CODES.ANALYSIS_NOT_COMPLETE,
        `Analysis not completed for session: ${sessionId}`,
        { sessionId, status: session.status }
      );
    }

    return {
      tasteProfile: session.analysisResult.tasteProfile!,
      confidence: session.analysisResult.confidence!,
      evidenceQuotes: session.analysisResult.evidenceQuotes!,
      analysisCompletedAt: session.completedAt ?? session.updatedAt,
    };
  }

  /**
   * Save taste profile to file
   */
  private async saveTasteProfile(profile: UserTasteProfile): Promise<void> {
    await fs.mkdir(this.tasteDir, { recursive: true });

    const profilePath = path.join(this.tasteDir, profile.userId, 'profile.json');
    await fs.mkdir(path.dirname(profilePath), { recursive: true });

    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf-8');

    // Also save to history
    const historyDir = path.join(this.tasteDir, profile.userId, 'history');
    await fs.mkdir(historyDir, { recursive: true });

    const historyPath = path.join(historyDir, `${Date.now()}.json`);
    await fs.writeFile(historyPath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  /**
   * Simulate LLM analysis
   * Phase 1: Simplified implementation using keyword matching
   * Phase 1.5: Integrate pi-agent LLM API
   */
  private async simulateLLMAnalysis(
    dialogueHistory: DialogueTurn[] | CultureDetectionMessage[]
  ): Promise<{
    analysis: Record<string, unknown>;
    confidence: number;
    evidenceQuotes: string[];
  }> {
    // Extract text from dialogue
    const allText = this.extractDialogueText(dialogueHistory);

    // Extract keywords and patterns
    const extractedKeywords = this.extractKeywords(allText);
    const analysis = this.buildAnalysisFromKeywords(extractedKeywords);
    const confidence = this.calculateConfidence(dialogueHistory, analysis);
    const evidenceQuotes = this.extractEvidenceQuotes(dialogueHistory);

    return {
      analysis,
      confidence,
      evidenceQuotes,
    };
  }

  /**
   * Extract text from dialogue history
   */
  private extractDialogueText(dialogueHistory: DialogueTurn[] | CultureDetectionMessage[]): string {
    if (dialogueHistory.length === 0) {
      return '';
    }

    if ('question' in dialogueHistory[0]!) {
      // Old format
      return (dialogueHistory as DialogueTurn[])
        .map(d => d.question + ' ' + d.userResponse)
        .join('\n');
    } else {
      // New format
      return (dialogueHistory as CultureDetectionMessage[])
        .map(m => m.content)
        .join('\n');
    }
  }

  /**
   * Extract keywords from dialogue text
   */
  private extractKeywords(text: string): Record<string, unknown> {
    const experienceKeywords = this.extractExperienceKeywords(text);
    const tasteKeywords = this.extractTasteKeywords(text);
    const tensionKeywords = this.extractTensionKeywords(text);

    return {
      experience: experienceKeywords,
      taste: tasteKeywords,
      tension: tensionKeywords,
    };
  }

  /**
   * Extract experience topology keywords
   */
  private extractExperienceKeywords(text: string): string[] {
    const experiencePatterns: Record<string, RegExp[]> = {
      'web-development': [/web/i, /frontend/i, /网页/i, /前端/i, /react/i, /vue/i, /angular/i],
      'mobile-development': [/mobile/i, /app/i, /ios/i, /android/i, /flutter/i, /react native/i],
      'enterprise-systems': [/enterprise/i, /企业/i, /management/i, /管理/i, /erp/i, /crm/i],
      'data-platform': [/data/i, /analytics/i, /数据/i, /分析/i, /pipeline/i],
      'testing': [/test/i, /quality/i, /质量/i, /qa/i, /testing/i],
      'backend': [/backend/i, /后端/i, /api/i, /server/i, /服务/i],
      'fullstack': [/fullstack/i, /全栈/i, /full stack/i],
    };

    const found: string[] = [];

    Object.entries(experiencePatterns).forEach(([domain, patterns]) => {
      if (patterns.some(pattern => pattern.test(text))) {
        found.push(domain);
      }
    });

    return found;
  }

  /**
   * Extract taste standard keywords
   */
  private extractTasteKeywords(text: string): { positive: string[]; negative: string[] } {
    const positivePatterns: Record<string, RegExp> = {
      '可维护性': /maintainable|可维护|maintain/i,
      '简洁': /clean|clean code|简洁|simplicity|simple/i,
      '性能': /fast|performance|性能|speed|efficient/i,
      '简单': /simple|简单|simplicity/i,
      '可扩展': /scalable|扩展|scale|extensible/i,
      '可读性': /readable|可读|readability/i,
      '测试覆盖': /test coverage|测试覆盖|unit test/i,
    };

    const negativePatterns: Record<string, RegExp> = {
      '过度设计': /complex|复杂|over-engineered|过度设计|over engineer/i,
      '面条代码': /spaghetti|面条|messy/i,
      '紧耦合': /tightly coupled|紧耦合|tight coupling/i,
      '硬编码': /hardcoded|硬编码|magic number/i,
      '重复代码': /duplicate|重复|redundant/i,
    };

    const positive: string[] = [];
    const negative: string[] = [];

    Object.entries(positivePatterns).forEach(([taste, pattern]) => {
      if (pattern.test(text)) {
        positive.push(taste);
      }
    });

    Object.entries(negativePatterns).forEach(([taste, pattern]) => {
      if (pattern.test(text)) {
        negative.push(taste);
      }
    });

    return { positive, negative };
  }

  /**
   * Extract tension position keywords
   */
  private extractTensionKeywords(text: string): { controlLevel: number; trustLevel: number } {
    const controlKeywords = [
      /control|控制|verify|验证|check|检查|确认/i,
    ];

    const trustKeywords = [
      /trust|信任|let|delegate|委托|放手/i,
    ];

    let controlScore = 0;
    let trustScore = 0;

    controlKeywords.forEach(pattern => {
      if (pattern.test(text)) controlScore++;
    });

    trustKeywords.forEach(pattern => {
      if (pattern.test(text)) trustScore++;
    });

    const total = controlScore + trustScore;
    const controlLevel = total > 0 ? controlScore / total : 0.5;

    return {
      controlLevel,
      trustLevel: Math.max(0.3, 1 - controlLevel - 0.1),
    };
  }

  /**
   * Build analysis from extracted keywords
   */
  private buildAnalysisFromKeywords(keywords: Record<string, unknown>): Record<string, unknown> {
    const tasteKeywords = keywords['taste'] as { positive: string[]; negative: string[] };
    const tensionKeywords = keywords['tension'] as { controlLevel: number; trustLevel: number };

    return {
      experience_topology: keywords['experience'] as string[] ?? [],
      taste_standards: {
        development: {
          positive_vibes: tasteKeywords?.positive ?? [],
          negative_vibes: tasteKeywords?.negative ?? [],
        },
      },
      tension_position: {
        control_level: tensionKeywords?.controlLevel ?? 0.5,
        trust_level: tensionKeywords?.trustLevel ?? 0.5,
        intervention_threshold: 0.7,
      },
      symbiosis_boundary: {
        delegated_domains: [],
        reserved_domains: [],
        contextual_triggers: [],
      },
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    dialogueHistory: DialogueTurn[] | CultureDetectionMessage[],
    analysis: Record<string, unknown>
  ): number {
    const turnCount = Array.isArray(dialogueHistory) ? dialogueHistory.length : 0;
    const extractedCount =
      ((analysis['experience_topology'] as string[])?.length ?? 0) +
      ((analysis['taste_standards'] as Record<string, { positive_vibes: string[]; negative_vibes: string[] }>)?.['development']?.positive_vibes?.length ?? 0) +
      ((analysis['taste_standards'] as Record<string, { positive_vibes: string[]; negative_vibes: string[] }>)?.['development']?.negative_vibes?.length ?? 0);

    const turnScore = Math.min(turnCount / 4, 1); // 4 turns = full score
    const contentScore = Math.min(extractedCount / 5, 1); // 5 keywords = full score

    return Math.round((turnScore * 0.6 + contentScore * 0.4) * 100) / 100;
  }

  /**
   * Extract evidence quotes from dialogue
   */
  private extractEvidenceQuotes(dialogueHistory: DialogueTurn[] | CultureDetectionMessage[]): string[] {
    if (dialogueHistory.length === 0) {
      return [];
    }

    if ('question' in dialogueHistory[0]!) {
      return (dialogueHistory as DialogueTurn[])
        .map(turn => turn.userResponse.slice(0, 100) + (turn.userResponse.length > 100 ? '...' : ''));
    } else {
      return (dialogueHistory as CultureDetectionMessage[])
        .filter(m => m.role === 'user')
        .map(m => m.content.slice(0, 100) + (m.content.length > 100 ? '...' : ''));
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let detectionServiceInstance: CultureDetectionService | null = null;

export function getDetectionService(): CultureDetectionService {
  if (!detectionServiceInstance) {
    detectionServiceInstance = new CultureDetectionService();
  }
  return detectionServiceInstance;
}
