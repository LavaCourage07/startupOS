/**
 * 窗口系统测试页面
 * Story OS.9: 应用窗口系统测试
 */

'use client';

import React from 'react';
import { useAppWindowManager } from '@/hooks/useAppWindowManager';
import { AppWindowContainer } from '@/components/os/window/AppWindowContainer';

// 测试组件 1: 简单内容
const TestContent: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-6">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    <p className="text-gray-600 mb-4">
      这是一个测试窗口的内容区域。你可以拖动标题栏移动窗口，
      拖动边缘调整大小，点击控制按钮操作窗口。
    </p>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-green-500"></span>
        <span>拖拽移动: 点击标题栏拖动</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
        <span>调整大小: 拖动窗口边缘或角落</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
        <span>窗口控制: 关闭/最小化/最大化</span>
      </div>
    </div>
  </div>
);

// 测试组件 2: 表单内容
const FormContent: React.FC = () => (
  <div className="p-6">
    <h2 className="text-xl font-bold mb-4">表单示例</h2>
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">名称</label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入名称..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">邮箱</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入邮箱..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">描述</label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="输入描述..."
        />
      </div>
      <button
        type="button"
        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        提交
      </button>
    </form>
  </div>
);

// 测试组件 3: 列表内容
const ListContent: React.FC = () => {
  const items = [
    { id: 1, name: '文档 1', type: 'doc', size: '12 KB' },
    { id: 2, name: '图片 2', type: 'img', size: '256 KB' },
    { id: 3, name: '视频 3', type: 'vid', size: '15 MB' },
    { id: 4, name: '音频 4', type: 'aud', size: '3 MB' },
    { id: 5, name: '代码 5', type: 'code', size: '45 KB' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">文件列表</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {item.type === 'doc' && '📄'}
                {item.type === 'img' && '🖼️'}
                {item.type === 'vid' && '🎬'}
                {item.type === 'aud' && '🎵'}
                {item.type === 'code' && '💻'}
              </span>
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-500">{item.size}</div>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              ⋮
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function TestWindowPage() {
  const { openWindow, closeAllWindows, getOpenWindows, focusWindow } = useAppWindowManager();
  const [windowCount, setWindowCount] = React.useState(0);

  // 打开简单窗口
  const openSimpleWindow = () => {
    const count = windowCount + 1;
    setWindowCount(count);

    openWindow({
      type: 'app',
      title: `测试窗口 ${count}`,
      icon: '🪟',
      position: {
        x: 100 + (count * 30) % 200,
        y: 100 + (count * 30) % 150,
        width: 500,
        height: 400,
      },
      content: {
        type: 'component',
        component: TestContent,
        props: { title: `窗口 #${count}` },
      },
    });
  };

  // 打开表单窗口
  const openFormWindow = () => {
    openWindow({
      type: 'app',
      title: '表单窗口',
      icon: '📝',
      position: { x: 200, y: 150, width: 450, height: 500 },
      content: {
        type: 'component',
        component: FormContent,
      },
    });
  };

  // 打开列表窗口
  const openListWindow = () => {
    openWindow({
      type: 'app',
      title: '文件列表',
      icon: '📁',
      position: { x: 250, y: 200, width: 500, height: 450 },
      content: {
        type: 'component',
        component: ListContent,
      },
    });
  };

  // 打开 iframe 窗口
  const openIframeWindow = () => {
    openWindow({
      type: 'app',
      title: '外部页面',
      icon: '🌐',
      position: { x: 150, y: 100, width: 800, height: 600 },
      content: {
        type: 'iframe',
        url: 'https://example.com',
      },
    });
  };

  // 打开设置窗口
  const openSettingsWindow = () => {
    openWindow({
      id: 'settings-window',
      type: 'settings',
      title: '系统设置',
      icon: '⚙️',
      position: { x: 300, y: 150, width: 600, height: 450 },
      content: {
        type: 'component',
        component: () => (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">系统设置</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">深色模式</div>
                  <div className="text-sm text-gray-500">启用深色主题</div>
                </div>
                <button className="w-12 h-6 bg-blue-500 rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">通知</div>
                  <div className="text-sm text-gray-500">显示桌面通知</div>
                </div>
                <button className="w-12 h-6 bg-gray-300 rounded-full relative">
                  <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">声音</div>
                  <div className="text-sm text-gray-500">播放系统声音</div>
                </div>
                <button className="w-12 h-6 bg-blue-500 rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
            </div>
          </div>
        ),
      },
    });
  };

  const openWindows = getOpenWindows();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Story OS.9 窗口系统测试
          </h1>
          <p className="text-gray-300">
            测试应用窗口的打开、关闭、拖拽、调整大小等功能
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">打开窗口</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openSimpleWindow}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              🪟 打开简单窗口
            </button>
            <button
              onClick={openFormWindow}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              📝 打开表单窗口
            </button>
            <button
              onClick={openListWindow}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              📁 打开列表窗口
            </button>
            <button
              onClick={openSettingsWindow}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              ⚙️ 打开设置窗口
            </button>
            <button
              onClick={openIframeWindow}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              🌐 打开 iframe 窗口
            </button>
          </div>
        </div>

        {/* 窗口操作 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">窗口操作</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={closeAllWindows}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              ✖️ 关闭所有窗口
            </button>
          </div>
        </div>

        {/* 状态信息 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">状态信息</h2>
          <div className="text-gray-300 space-y-2">
            <p>已打开窗口数: <span className="text-white font-semibold">{openWindows.length}</span></p>
            <p>已打开窗口总数: <span className="text-white font-semibold">{windowCount}</span></p>
            {openWindows.length > 0 && (
              <div>
                <p className="mb-2">窗口列表:</p>
                <ul className="list-disc list-inside space-y-1">
                  {openWindows.map((win) => (
                    <li key={win.id} className="flex items-center gap-2">
                      <span>{win.icon}</span>
                      <span>{win.title}</span>
                      <span className="text-gray-500 text-sm">
                        ({win.position.width}x{win.position.height})
                      </span>
                      <button
                        onClick={() => focusWindow(win.id)}
                        className="text-xs px-2 py-1 bg-blue-500/50 hover:bg-blue-500/70 rounded transition-colors"
                      >
                        聚焦
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 text-gray-400 text-sm">
          <h3 className="font-semibold mb-2">使用说明:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>点击上方按钮打开不同类型的窗口</li>
            <li>拖动窗口标题栏可以移动窗口位置</li>
            <li>拖动窗口边缘或角落可以调整窗口大小</li>
            <li>点击窗口控制按钮可以关闭/最小化/最大化窗口</li>
            <li>点击窗口可以使其获得焦点（置于最前）</li>
          </ul>
        </div>
      </div>

      {/* 窗口容器 - 渲染所有打开的窗口 */}
      <AppWindowContainer />
    </div>
  );
}
