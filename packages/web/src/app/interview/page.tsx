import { ProjectInterview } from '@/components/interview/ProjectInterview';

/**
 * 项目访谈页面
 *
 * 这是 Epic 1 的入口页面，由 OS 主页面的"创建项目"按钮导航到此处。
 * 包含完整的访谈流程：欢迎屏幕 → 问题收集 → 本体生成 → 预览编辑 → 完成
 */
export default function InterviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <ProjectInterview />
    </div>
  );
}
