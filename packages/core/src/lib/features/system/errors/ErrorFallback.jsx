/**
 * OS.8: Error Fallback
 */
import React from 'react';
export function ErrorFallback({ error, reset }) {
    return (<div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-2">出错了</h2>
      <p className="text-gray-600 mb-6 max-w-md text-center">{error.message}</p>
      <div className="flex gap-4">
        <button onClick={reset} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          重试
        </button>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
          刷新页面
        </button>
      </div>
    </div>);
}
