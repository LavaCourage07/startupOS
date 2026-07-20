'use client';

import { useState } from 'react';
import { InterviewWindow } from '@/components/interview';

/**
 * Test page for InterviewWindow component
 */
export default function TestInterviewPage() {
  const [showInterview, setShowInterview] = useState(true);

  const handleComplete = (result: any) => {
    console.log('Interview completed:', result);
    alert('访谈完成！查看控制台获取结果。');
  };

  const handleClose = () => {
    setShowInterview(false);
    alert('访谈已关闭');
  };

  return (
    <div className="h-screen w-screen bg-background">
      {showInterview ? (
        <InterviewWindow
          projectId="test-project-001"
          onClose={handleClose}
          onComplete={handleComplete}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-text-primary">访谈已关闭</h1>
            <button
              onClick={() => setShowInterview(true)}
              className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90"
            >
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
