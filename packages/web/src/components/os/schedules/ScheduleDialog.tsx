'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Pencil, Play, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import type { CreateScheduledTaskInput, ScheduledAction, ScheduledTask, ScheduleTrigger, UpdateScheduledTaskInput } from '@originos/core/modules/scheduler';
import { showSystemNotification } from '@originos/core/lib/integrations/electron/services/misc';
import type { SystemNotificationActivationTarget } from '@originos/core/lib/integrations/electron/services/misc';

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
}

type ActionMode = 'agent' | 'skill' | 'notify' | 'system-tool';
type TriggerMode = 'once' | 'interval' | 'cron';
type IntervalUnit = 'minutes' | 'hours' | 'days';
type NotificationActivationMode = 'none' | 'project' | 'agent' | 'skill';

interface UserAgentOption {
  id: string;
  name: string;
  description?: string;
  agentType?: string;
}

interface SkillOption {
  name: string;
  description?: string;
  source?: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface SchedulesResponse {
  success: boolean;
  data?: { tasks: ScheduledTask[] };
  error?: { message: string };
}

interface AgentsResponse {
  success: boolean;
  data?: { agents: UserAgentOption[] };
}

interface SkillsResponse {
  success: boolean;
  data?: { skills: SkillOption[] };
}

interface ProjectsResponse {
  success: boolean;
  data?: ProjectOption[];
}

interface CreateScheduleResponse {
  success: boolean;
  data?: { task: ScheduledTask };
  error?: { message: string };
}

interface DeleteScheduleResponse {
  success: boolean;
  data?: { deleted: true };
  error?: { message: string };
}

export function ScheduleDialog({ open, onClose }: ScheduleDialogProps) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [agents, setAgents] = React.useState<UserAgentOption[]>([]);
  const [skills, setSkills] = React.useState<SkillOption[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [triggerMode, setTriggerMode] = React.useState<TriggerMode>('once');
  const [runAt, setRunAt] = React.useState('');
  const [intervalValue, setIntervalValue] = React.useState('1');
  const [intervalUnit, setIntervalUnit] = React.useState<IntervalUnit>('hours');
  const [intervalStartAt, setIntervalStartAt] = React.useState('');
  const [cronExpression, setCronExpression] = React.useState('0 9 * * *');
  const [actionMode, setActionMode] = React.useState<ActionMode>('agent');
  const [selectedAgent, setSelectedAgent] = React.useState('');
  const [selectedSkill, setSelectedSkill] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [systemToolName, setSystemToolName] = React.useState('get_current_time');
  const [notificationActivationMode, setNotificationActivationMode] = React.useState<NotificationActivationMode>('none');
  const [selectedNotificationProject, setSelectedNotificationProject] = React.useState('');
  const [selectedNotificationAgent, setSelectedNotificationAgent] = React.useState('');
  const [selectedNotificationSkill, setSelectedNotificationSkill] = React.useState('');
  const [notificationInitialMessage, setNotificationInitialMessage] = React.useState('');

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/schedules', { cache: 'no-store' });
      const json = (await response.json()) as SchedulesResponse;
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Failed to load schedules');
      }
      setTasks(json.data.tasks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCapabilities = React.useCallback(async () => {
    try {
      const [agentsResponse, skillsResponse, projectsResponse] = await Promise.all([
        fetch('/api/user-agents', { cache: 'no-store' }),
        fetch('/api/skills?includeInvisible=true', { cache: 'no-store' }),
        fetch('/api/projects?limit=100', { cache: 'no-store' }),
      ]);
      const agentsJson = (await agentsResponse.json()) as AgentsResponse;
      const skillsJson = (await skillsResponse.json()) as SkillsResponse;
      const projectsJson = (await projectsResponse.json()) as ProjectsResponse;
      const nextAgents = agentsJson.success ? agentsJson.data?.agents ?? [] : [];
      const nextSkills = skillsJson.success ? skillsJson.data?.skills ?? [] : [];
      const nextProjects = projectsJson.success ? projectsJson.data ?? [] : [];
      setAgents(nextAgents);
      setSkills(nextSkills);
      setProjects(nextProjects);
      setSelectedAgent((current) => current || nextAgents[0]?.id || '');
      setSelectedSkill((current) => current || nextSkills[0]?.name || '');
      setSelectedNotificationAgent((current) => current || nextAgents[0]?.id || '');
      setSelectedNotificationSkill((current) => current || nextSkills[0]?.name || '');
      setSelectedNotificationProject((current) => current || nextProjects[0]?.id || '');
    } catch {
      setAgents([]);
      setSkills([]);
      setProjects([]);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadTasks();
      void loadCapabilities();
      setShowCreate(false);
      setEditingTaskId(null);
      setNotice(null);
      setError(null);
    }
  }, [open, loadTasks, loadCapabilities]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  React.useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 8000);
    return () => window.clearTimeout(timer);
  }, [error]);

  if (!open) return null;

  function buildAction(): ScheduledAction | null {
    if (actionMode === 'agent') {
      if (!selectedAgent) {
        setError('请选择要启动的角色');
        return null;
      }
      return {
        type: 'agent',
        agentName: selectedAgent,
        prompt: prompt.trim() || title.trim(),
      };
    }
    if (actionMode === 'skill') {
      if (!selectedSkill) {
        setError('请选择要启动的技能');
        return null;
      }
      return {
        type: 'skill',
        skillName: selectedSkill,
        prompt: prompt.trim() || title.trim(),
      };
    }
    if (actionMode === 'notify') {
      const activationTarget = buildNotificationActivationTarget({
        mode: notificationActivationMode,
        selectedProject: selectedNotificationProject,
        selectedAgent: selectedNotificationAgent,
        selectedSkill: selectedNotificationSkill,
        initialMessage: notificationInitialMessage,
        projects,
        agents,
        skills,
        setError,
      });
      if (activationTarget === false) return null;
      return {
        type: 'system',
        command: 'notify',
        payload: {
          message: message.trim() || title.trim(),
          ...(activationTarget ? { activationTarget } : {}),
        },
      };
    }
    return {
      type: 'system-tool',
      toolName: systemToolName,
      input: {},
    };
  }

  function buildTrigger(): ScheduleTrigger | null {
    if (triggerMode === 'once') {
      const scheduledAt = new Date(runAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        setError('请选择有效的运行时间');
        return null;
      }
      return { type: 'once', runAt: scheduledAt.toISOString() };
    }

    if (triggerMode === 'interval') {
      const parsedValue = Number(intervalValue);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        setError('请输入有效的间隔数值');
        return null;
      }
      const unitMs = intervalUnit === 'minutes'
        ? 60 * 1000
        : intervalUnit === 'hours'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
      const start = intervalStartAt ? new Date(intervalStartAt) : null;
      if (start && Number.isNaN(start.getTime())) {
        setError('请选择有效的开始时间');
        return null;
      }
      return {
        type: 'interval',
        everyMs: parsedValue * unitMs,
        ...(start ? { startAt: start.toISOString() } : {}),
      };
    }

    const expression = cronExpression.trim();
    if (!expression) {
      setError('请输入 Cron 表达式');
      return null;
    }
    return { type: 'cron', expression };
  }

  function resetForm() {
    setTitle('');
    setTriggerMode('once');
    setRunAt('');
    setIntervalValue('1');
    setIntervalUnit('hours');
    setIntervalStartAt('');
    setCronExpression('0 9 * * *');
    setActionMode('agent');
    setSelectedAgent(agents[0]?.id ?? '');
    setSelectedSkill(skills[0]?.name ?? '');
    setPrompt('');
    setMessage('');
    setSystemToolName('get_current_time');
    setNotificationActivationMode('none');
    setSelectedNotificationProject(projects[0]?.id ?? '');
    setSelectedNotificationAgent(agents[0]?.id ?? '');
    setSelectedNotificationSkill(skills[0]?.name ?? '');
    setNotificationInitialMessage('');
  }

  function beginCreate() {
    if (showCreate && !editingTaskId) {
      setShowCreate(false);
      return;
    }
    resetForm();
    setEditingTaskId(null);
    setError(null);
    setNotice(null);
    setShowCreate(true);
  }

  function beginEdit(task: ScheduledTask) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    applyTriggerToForm(task.trigger);
    applyActionToForm(task.action);
    setError(null);
    setNotice(null);
    setShowCreate(true);
  }

  async function saveTask() {
    setError(null);
    setNotice(null);
    if (!title.trim()) {
      setError('请输入任务标题');
      return;
    }
    const trigger = buildTrigger();
    if (!trigger) return;
    const action = buildAction();
    if (!action) return;

    const input: CreateScheduledTaskInput | UpdateScheduledTaskInput = {
      title: title.trim(),
      trigger,
      action,
    };

    setLoading(true);
    try {
      const isEditing = Boolean(editingTaskId);
      const response = await fetch(isEditing ? `/api/schedules/${encodeURIComponent(editingTaskId ?? '')}` : '/api/schedules', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = (await response.json()) as CreateScheduleResponse;
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? (isEditing ? 'Failed to update schedule' : 'Failed to create schedule'));
      }
      setNotice(isEditing ? '定时任务已更新。' : '定时任务已创建。');
      resetForm();
      setEditingTaskId(null);
      setShowCreate(false);
      await loadTasks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm('删除这个定时任务？')) return;
    setDeletingTaskId(taskId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/schedules/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      const json = (await response.json()) as DeleteScheduleResponse;
      if (!json.success || !json.data?.deleted) {
        throw new Error(json.error?.message ?? 'Failed to delete schedule');
      }
      if (editingTaskId === taskId) {
        resetForm();
        setEditingTaskId(null);
        setShowCreate(false);
      }
      setNotice('定时任务已删除。');
      await loadTasks();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingTaskId(null);
    }
  }

  function applyTriggerToForm(trigger: ScheduledTask['trigger']) {
    if (trigger.type === 'once') {
      setTriggerMode('once');
      setRunAt(toDatetimeLocal(trigger.runAt));
      return;
    }
    if (trigger.type === 'interval') {
      const normalized = normalizeInterval(trigger.everyMs);
      setTriggerMode('interval');
      setIntervalValue(String(normalized.value));
      setIntervalUnit(normalized.unit);
      setIntervalStartAt(trigger.startAt ? toDatetimeLocal(trigger.startAt) : '');
      return;
    }
    setTriggerMode('cron');
    setCronExpression(trigger.expression);
  }

  function applyActionToForm(action: ScheduledTask['action']) {
    setPrompt('');
    setMessage('');
    setNotificationActivationMode('none');
    setNotificationInitialMessage('');
    if (action.type === 'agent') {
      setActionMode('agent');
      setSelectedAgent(action.agentName);
      setPrompt(action.prompt);
      return;
    }
    if (action.type === 'skill') {
      setActionMode('skill');
      setSelectedSkill(action.skillName);
      setPrompt(action.prompt ?? '');
      return;
    }
    if (action.type === 'system-tool') {
      setActionMode('system-tool');
      setSystemToolName(action.toolName);
      return;
    }

    setActionMode('notify');
    const messageValue = action.payload?.["message"];
    setMessage(typeof messageValue === 'string' ? messageValue : '');
    const target = action.payload?.["activationTarget"];
    if (!isActivationTarget(target)) return;
    setNotificationInitialMessage(target.initialMessage ?? '');
    if (target.entryType === 'project') {
      setNotificationActivationMode('project');
      setSelectedNotificationProject(target.entryId);
      return;
    }
    if (target.entryType === 'skill') {
      setNotificationActivationMode('skill');
      setSelectedNotificationSkill(target.entryId);
      return;
    }
    setNotificationActivationMode('agent');
    setSelectedNotificationAgent(target.entryId);
  }

  async function runTask(taskId: string) {
    setBusyTaskId(taskId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/schedules/${encodeURIComponent(taskId)}/run`, {
        method: 'POST',
      });
      const json = (await response.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) {
        throw new Error(json.error?.message ?? 'Failed to run schedule');
      }
      const task = tasks.find((item) => item.id === taskId);
      const notificationResult = await showSystemNotification({
        title: '定时任务已运行',
        body: task ? getSystemNotificationBody(task) : '任务结果已写入运行记录',
        activationTarget: task ? getActivationTarget(task, agents, skills) : undefined,
      });
      const notificationData = notificationResult.data;
      if (notificationResult.success && notificationData?.shown) {
        setNotice(`定时任务已运行，结果已写入运行记录；桌面版已触发系统通知${notificationData.delivery ? `（${notificationData.delivery}）` : ''}。`);
      } else {
        setNotice(`定时任务已运行，结果已写入运行记录；系统通知未显示${formatNotificationFailure(notificationData)}。`);
      }
      await loadTasks();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-end bg-black/30 px-4 pt-12 backdrop-blur-sm">
      <div className="flex max-h-[78vh] w-[520px] flex-col rounded-xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-sky-100" />
            <span className="text-sm font-semibold text-white/90">定时任务</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={beginCreate}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
            <button type="button" onClick={onClose} className="text-white/45 transition-colors hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/75">任务列表</span>
              <button type="button" onClick={() => void loadTasks()} className="text-white/45 transition-colors hover:text-white">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-8 text-center text-xs text-white/35">
                暂无定时任务
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="truncate text-xs font-medium text-white/80">{task.title}</span>
                      <span className="text-[10px] text-white/35">
                        {task.status} · {getTriggerLabel(task.trigger)} · {getActionLabel(task.action)} · 下次 {new Date(task.nextRunAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(task)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/20 text-white/60 transition-colors hover:text-white"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void runTask(task.id)}
                        disabled={busyTaskId === task.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/20 text-white/60 transition-colors hover:text-white disabled:opacity-40"
                        title="立即运行"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTask(task.id)}
                        disabled={deletingTaskId === task.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/20 text-white/60 transition-colors hover:text-red-100 disabled:opacity-40"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showCreate ? (
            <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
                <Sparkles className="h-3.5 w-3.5" />
                {editingTaskId ? '编辑任务' : '新建任务'}
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="任务标题"
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25"
              />
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <select
                  value={triggerMode}
                  onChange={(event) => setTriggerMode(event.target.value as TriggerMode)}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
                >
                  <option value="once" className="bg-gray-900 text-white">一次</option>
                  <option value="interval" className="bg-gray-900 text-white">每隔</option>
                  <option value="cron" className="bg-gray-900 text-white">Cron</option>
                </select>
                {renderTriggerConfig({
                  triggerMode,
                  runAt,
                  intervalValue,
                  intervalUnit,
                  intervalStartAt,
                  cronExpression,
                  setRunAt,
                  setIntervalValue,
                  setIntervalUnit,
                  setIntervalStartAt,
                  setCronExpression,
                })}
              </div>
              <div className="grid grid-cols-[150px_1fr] gap-2">
                <select
                  value={actionMode}
                  onChange={(event) => setActionMode(event.target.value as ActionMode)}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
                >
                  <option value="agent" className="bg-gray-900 text-white">启动角色</option>
                  <option value="skill" className="bg-gray-900 text-white">启动技能</option>
                  <option value="notify" className="bg-gray-900 text-white">系统通知</option>
                  <option value="system-tool" className="bg-gray-900 text-white">系统工具</option>
                </select>
                {renderActionConfig({
                  actionMode,
                  agents,
                  skills,
                  projects,
                  selectedAgent,
                  selectedSkill,
                  selectedNotificationAgent,
                  selectedNotificationSkill,
                  selectedNotificationProject,
                  notificationInitialMessage,
                  notificationActivationMode,
                  prompt,
                  message,
                  systemToolName,
                  setSelectedAgent,
                  setSelectedSkill,
                  setSelectedNotificationAgent,
                  setSelectedNotificationSkill,
                  setSelectedNotificationProject,
                  setNotificationInitialMessage,
                  setNotificationActivationMode,
                  setPrompt,
                  setMessage,
                  setSystemToolName,
                })}
              </div>
              <button
                type="button"
                onClick={() => void saveTask()}
                disabled={loading}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-3.5 w-3.5" />
                {editingTaskId ? '保存定时任务' : '创建定时任务'}
              </button>
            </section>
          ) : null}

          {notice ? (
            <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/85">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100/85">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function formatNotificationFailure(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (record["reason"] === 'PERMISSION_DENIED') {
    return '（PERMISSION_DENIED，请在系统设置中允许 OriginOS CE 通知）';
  }
  const details = [
    typeof record["reason"] === 'string' ? record["reason"] : null,
    typeof record["permission"] === 'string' ? `permission=${record["permission"]}` : null,
    typeof record["focused"] === 'boolean' ? `focused=${record["focused"]}` : null,
    typeof record["nativeSupported"] === 'boolean' ? `nativeSupported=${record["nativeSupported"]}` : null,
  ].filter(Boolean);
  return details.length > 0 ? `（${details.join(', ')}）` : '';
}

function getActionLabel(action: ScheduledTask['action']): string {
  if (action.type === 'agent') return `启动角色: ${action.agentName}`;
  if (action.type === 'skill') return `启动技能: ${action.skillName}`;
  if (action.type === 'system-tool') return `系统工具: ${action.toolName}`;
  return `系统通知: ${getNotificationTargetLabel(action.payload?.["activationTarget"])}`;
}

function getNotificationTargetLabel(value: unknown): string {
  if (!isActivationTarget(value)) return '仅通知';
  if (value.entryType === 'project') return `点击打开项目 ${value.title ?? value.entryId}`;
  if (value.entryType === 'skill') return `点击启动技能 ${value.title ?? value.entryId}`;
  return `点击启动角色 ${value.title ?? value.entryId}`;
}

function getTriggerLabel(trigger: ScheduledTask['trigger']): string {
  if (trigger.type === 'once') return '一次';
  if (trigger.type === 'cron') return `Cron ${trigger.expression}`;
  const minutes = trigger.everyMs / (60 * 1000);
  if (minutes % (24 * 60) === 0) return `每 ${minutes / (24 * 60)} 天`;
  if (minutes % 60 === 0) return `每 ${minutes / 60} 小时`;
  return `每 ${minutes} 分钟`;
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function normalizeInterval(everyMs: number): { value: number; unit: IntervalUnit } {
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  if (everyMs % dayMs === 0) {
    return { value: everyMs / dayMs, unit: 'days' };
  }
  if (everyMs % hourMs === 0) {
    return { value: everyMs / hourMs, unit: 'hours' };
  }
  return { value: Math.max(1, Math.round(everyMs / minuteMs)), unit: 'minutes' };
}

function getSystemNotificationBody(task: ScheduledTask): string {
  if (task.action.type === 'system' && task.action.command === 'notify') {
    const message = task.action.payload?.["message"];
    return typeof message === 'string' && message.trim() ? message : task.title;
  }
  return `${task.title} 已完成`;
}

function getActivationTarget(
  task: ScheduledTask,
  agents: UserAgentOption[],
  skills: SkillOption[],
): SystemNotificationActivationTarget | undefined {
  const { action } = task;
  if (action.type === 'agent') {
    const agent = agents.find((item) => item.id === action.agentName);
    return {
      entryType: agent?.agentType === 'role-agent' ? 'role-agent' : 'agent',
      entryId: action.agentName,
      title: agent?.name ?? action.agentName,
    };
  }
  if (action.type === 'skill') {
    const skill = skills.find((item) => item.name === action.skillName);
    return {
      entryType: 'skill',
      entryId: action.skillName,
      title: skill?.name ?? action.skillName,
    };
  }
  if (action.type === 'system') {
    const target = action.payload?.["activationTarget"];
    if (isActivationTarget(target)) return target;
  }
  return undefined;
}

function isActivationTarget(value: unknown): value is SystemNotificationActivationTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  return (
    (target["entryType"] === 'project' || target["entryType"] === 'agent' || target["entryType"] === 'role-agent' || target["entryType"] === 'skill') &&
    typeof target["entryId"] === 'string' &&
    (target["title"] === undefined || typeof target["title"] === 'string') &&
    (target["initialMessage"] === undefined || typeof target["initialMessage"] === 'string')
  );
}

function renderTriggerConfig({
  triggerMode,
  runAt,
  intervalValue,
  intervalUnit,
  intervalStartAt,
  cronExpression,
  setRunAt,
  setIntervalValue,
  setIntervalUnit,
  setIntervalStartAt,
  setCronExpression,
}: {
  triggerMode: TriggerMode;
  runAt: string;
  intervalValue: string;
  intervalUnit: IntervalUnit;
  intervalStartAt: string;
  cronExpression: string;
  setRunAt: (value: string) => void;
  setIntervalValue: (value: string) => void;
  setIntervalUnit: (value: IntervalUnit) => void;
  setIntervalStartAt: (value: string) => void;
  setCronExpression: (value: string) => void;
}) {
  if (triggerMode === 'once') {
    return (
      <input
        type="datetime-local"
        value={runAt}
        onChange={(event) => setRunAt(event.target.value)}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
      />
    );
  }
  if (triggerMode === 'interval') {
    return (
      <div className="grid grid-cols-[70px_90px_1fr] gap-2">
        <input
          type="number"
          min={1}
          value={intervalValue}
          onChange={(event) => setIntervalValue(event.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
        />
        <select
          value={intervalUnit}
          onChange={(event) => setIntervalUnit(event.target.value as IntervalUnit)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
        >
          <option value="minutes" className="bg-gray-900 text-white">分钟</option>
          <option value="hours" className="bg-gray-900 text-white">小时</option>
          <option value="days" className="bg-gray-900 text-white">天</option>
        </select>
        <input
          type="datetime-local"
          value={intervalStartAt}
          onChange={(event) => setIntervalStartAt(event.target.value)}
          title="开始时间，可不填"
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
        />
      </div>
    );
  }
  return (
    <input
      value={cronExpression}
      onChange={(event) => setCronExpression(event.target.value)}
      placeholder="0 9 * * *"
      title="例如 0 9 * * * 表示每天 09:00"
      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25"
    />
  );
}

function renderActionConfig({
  actionMode,
  agents,
  skills,
  projects,
  selectedAgent,
  selectedSkill,
  selectedNotificationAgent,
  selectedNotificationSkill,
  selectedNotificationProject,
  notificationInitialMessage,
  notificationActivationMode,
  prompt,
  message,
  systemToolName,
  setSelectedAgent,
  setSelectedSkill,
  setSelectedNotificationAgent,
  setSelectedNotificationSkill,
  setSelectedNotificationProject,
  setNotificationInitialMessage,
  setNotificationActivationMode,
  setPrompt,
  setMessage,
  setSystemToolName,
}: {
  actionMode: ActionMode;
  agents: UserAgentOption[];
  skills: SkillOption[];
  projects: ProjectOption[];
  selectedAgent: string;
  selectedSkill: string;
  selectedNotificationAgent: string;
  selectedNotificationSkill: string;
  selectedNotificationProject: string;
  notificationInitialMessage: string;
  notificationActivationMode: NotificationActivationMode;
  prompt: string;
  message: string;
  systemToolName: string;
  setSelectedAgent: (value: string) => void;
  setSelectedSkill: (value: string) => void;
  setSelectedNotificationAgent: (value: string) => void;
  setSelectedNotificationSkill: (value: string) => void;
  setSelectedNotificationProject: (value: string) => void;
  setNotificationInitialMessage: (value: string) => void;
  setNotificationActivationMode: (value: NotificationActivationMode) => void;
  setPrompt: (value: string) => void;
  setMessage: (value: string) => void;
  setSystemToolName: (value: string) => void;
}) {
  if (actionMode === 'agent') {
    return (
      <div className="grid grid-cols-[170px_1fr] gap-2">
        <select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
          {agents.length === 0 ? <option value="" className="bg-gray-900 text-white">暂无角色</option> : null}
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id} className="bg-gray-900 text-white">{agent.name}</option>
          ))}
        </select>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="唤起提示词" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25" />
      </div>
    );
  }
  if (actionMode === 'skill') {
    return (
      <div className="grid grid-cols-[170px_1fr] gap-2">
        <select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
          {skills.length === 0 ? <option value="" className="bg-gray-900 text-white">暂无技能</option> : null}
          {skills.map((skill) => (
            <option key={`${skill.source ?? 'skill'}:${skill.name}`} value={skill.name} className="bg-gray-900 text-white">{skill.name}</option>
          ))}
        </select>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="技能输入/提示词" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25" />
      </div>
    );
  }
  if (actionMode === 'notify') {
    return (
      <div className="flex flex-col gap-2">
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="通知内容" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25" />
        <div className="grid grid-cols-[130px_1fr] gap-2">
          <select
            value={notificationActivationMode}
            onChange={(event) => setNotificationActivationMode(event.target.value as NotificationActivationMode)}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
          >
            <option value="none" className="bg-gray-900 text-white">点击无动作</option>
            <option value="project" className="bg-gray-900 text-white">点击打开项目</option>
            <option value="agent" className="bg-gray-900 text-white">点击启动角色</option>
            <option value="skill" className="bg-gray-900 text-white">点击启动技能</option>
          </select>
          {renderNotificationActivationPicker({
            mode: notificationActivationMode,
            projects,
            agents,
            skills,
            selectedProject: selectedNotificationProject,
            selectedAgent: selectedNotificationAgent,
            selectedSkill: selectedNotificationSkill,
            setSelectedProject: setSelectedNotificationProject,
            setSelectedAgent: setSelectedNotificationAgent,
            setSelectedSkill: setSelectedNotificationSkill,
          })}
        </div>
        {notificationActivationMode !== 'none' ? (
          <input
            value={notificationInitialMessage}
            onChange={(event) => setNotificationInitialMessage(event.target.value)}
            placeholder="点击后自动发送的启动指令"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25"
          />
        ) : null}
      </div>
    );
  }
  return (
    <select value={systemToolName} onChange={(event) => setSystemToolName(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
      <option value="get_current_time" className="bg-gray-900 text-white">get_current_time</option>
    </select>
  );
}

function renderNotificationActivationPicker({
  mode,
  projects,
  agents,
  skills,
  selectedProject,
  selectedAgent,
  selectedSkill,
  setSelectedProject,
  setSelectedAgent,
  setSelectedSkill,
}: {
  mode: NotificationActivationMode;
  projects: ProjectOption[];
  agents: UserAgentOption[];
  skills: SkillOption[];
  selectedProject: string;
  selectedAgent: string;
  selectedSkill: string;
  setSelectedProject: (value: string) => void;
  setSelectedAgent: (value: string) => void;
  setSelectedSkill: (value: string) => void;
}) {
  if (mode === 'none') {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/35">
        仅展示通知
      </div>
    );
  }
  if (mode === 'project') {
    return (
      <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
        {projects.length === 0 ? <option value="" className="bg-gray-900 text-white">暂无项目</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id} className="bg-gray-900 text-white">{project.name}</option>
        ))}
      </select>
    );
  }
  if (mode === 'agent') {
    return (
      <select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
        {agents.length === 0 ? <option value="" className="bg-gray-900 text-white">暂无角色</option> : null}
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id} className="bg-gray-900 text-white">{agent.name}</option>
        ))}
      </select>
    );
  }
  return (
    <select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-white/25">
      {skills.length === 0 ? <option value="" className="bg-gray-900 text-white">暂无技能</option> : null}
      {skills.map((skill) => (
        <option key={`${skill.source ?? 'skill'}:${skill.name}`} value={skill.name} className="bg-gray-900 text-white">{skill.name}</option>
      ))}
    </select>
  );
}

function buildNotificationActivationTarget({
  mode,
  selectedProject,
  selectedAgent,
  selectedSkill,
  initialMessage,
  projects,
  agents,
  skills,
  setError,
}: {
  mode: NotificationActivationMode;
  selectedProject: string;
  selectedAgent: string;
  selectedSkill: string;
  initialMessage: string;
  projects: ProjectOption[];
  agents: UserAgentOption[];
  skills: SkillOption[];
  setError: (value: string) => void;
}): SystemNotificationActivationTarget | false | undefined {
  if (mode === 'none') return undefined;
  if (mode === 'project') {
    const project = projects.find((item) => item.id === selectedProject);
    if (!selectedProject || !project) {
      setError('请选择通知点击后要打开的项目');
      return false;
    }
    return {
      entryType: 'project',
      entryId: selectedProject,
      title: project.name,
      ...(initialMessage.trim() ? { initialMessage: initialMessage.trim() } : {}),
    };
  }
  if (mode === 'agent') {
    const agent = agents.find((item) => item.id === selectedAgent);
    if (!selectedAgent || !agent) {
      setError('请选择通知点击后要启动的角色');
      return false;
    }
    return {
      entryType: agent.agentType === 'role-agent' ? 'role-agent' : 'agent',
      entryId: selectedAgent,
      title: agent.name,
      ...(initialMessage.trim() ? { initialMessage: initialMessage.trim() } : {}),
    };
  }
  const skill = skills.find((item) => item.name === selectedSkill);
  if (!selectedSkill || !skill) {
    setError('请选择通知点击后要启动的技能');
    return false;
  }
  return {
    entryType: 'skill',
    entryId: selectedSkill,
    title: skill.name,
    ...(initialMessage.trim() ? { initialMessage: initialMessage.trim() } : {}),
  };
}
