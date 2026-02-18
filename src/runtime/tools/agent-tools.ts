/**
 * Oracle tools for orchestrating subagents and managing projects/tasks.
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { StructuredTool } from '@langchain/core/tools';
import { getDb } from '../memory/db.js';
import { ProjectStore } from '../../projects/store.js';
import { TaskStore } from '../../tasks/store.js';
import { TaskExecutor } from '../../tasks/executor.js';
import { TheArchitect } from '../../agents/architect.js';
import { TheKeymaker } from '../../agents/keymaker.js';
import { TheMerovingian } from '../../agents/merovingian.js';
import { getPendingApprovals } from '../../agents/notifier.js';
import type { TaskFilter } from '../../tasks/types.js';

// ─── create_plan ──────────────────────────────────────────────────────────────

const CreatePlanTool = tool(
  async ({ objective, project_id, session_id }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const taskStore = new TaskStore(db);

    const architect = new TheArchitect();
    const keymaker = new TheKeymaker();

    try {
      // 1. Architect creates the strategic plan
      const plan = await architect.createPlan(objective, session_id);

      // 2. Keymaker creates technical blueprints
      const blueprints = await keymaker.createBlueprints(plan, session_id);

      // 3. Determine working_dir from project (if provided)
      let workingDir: string | undefined;
      if (project_id) {
        const project = projectStore.getById(project_id);
        workingDir = project?.path;
      }

      // 4. Persist tasks to DB
      const createdTasks = plan.tasks.map((pt, i) => {
        const blueprint = blueprints.find((b) => b.task_index === i);
        return taskStore.create({
          project_id: project_id ?? undefined,
          session_id: session_id ?? 'cli',
          created_by: 'architect',
          assigned_to: pt.assigned_to,
          title: pt.title,
          description: pt.description,
          blueprint: blueprint?.blueprint,
          working_dir: workingDir,
        });
      });

      return JSON.stringify({
        success: true,
        objective: plan.objective,
        task_count: createdTasks.length,
        tasks: createdTasks.map((t) => ({
          id: t.id,
          title: t.title,
          assigned_to: t.assigned_to,
          status: t.status,
        })),
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'create_plan',
    description:
      'Decompose an objective into tasks using The Architect (strategic plan) and The Keymaker (technical blueprints). Tasks are persisted to the database.',
    schema: z.object({
      objective: z.string().describe('The objective to decompose into tasks'),
      project_id: z.string().optional().describe('Project ID to associate tasks with'),
      session_id: z.string().optional().describe('Session ID for message history tracking'),
    }),
  },
);

// ─── get_tasks ────────────────────────────────────────────────────────────────

const GetTasksTool = tool(
  async ({ project_id, session_id, status, assigned_to, limit }) => {
    const db = getDb();
    const taskStore = new TaskStore(db);

    const filter: TaskFilter = {
      project_id,
      session_id,
      status: status as any,
      assigned_to: assigned_to as any,
    };

    const tasks = taskStore.list(filter).slice(0, limit ?? 50);
    return JSON.stringify({ success: true, count: tasks.length, tasks });
  },
  {
    name: 'get_tasks',
    description: 'List tasks with optional filters (project, session, status, assignee).',
    schema: z.object({
      project_id: z.string().optional(),
      session_id: z.string().optional(),
      status: z
        .enum(['pending', 'in_progress', 'done', 'failed', 'cancelled', 'awaiting_approval'])
        .optional(),
      assigned_to: z.enum(['apoc', 'merovingian']).optional(),
      limit: z.number().int().optional().describe('Max results, default 50'),
    }),
  },
);

// ─── get_task_status ──────────────────────────────────────────────────────────

const GetTaskStatusTool = tool(
  async ({ task_id }) => {
    const db = getDb();
    const taskStore = new TaskStore(db);
    const task = taskStore.getById(task_id);
    if (!task) return JSON.stringify({ success: false, error: 'Task not found' });
    return JSON.stringify({ success: true, task });
  },
  {
    name: 'get_task_status',
    description: 'Get detailed status and result of a specific task by ID.',
    schema: z.object({ task_id: z.string() }),
  },
);

// ─── run_next_task ────────────────────────────────────────────────────────────

const RunNextTaskTool = tool(
  async ({ project_id, session_id }) => {
    const db = getDb();
    const taskStore = new TaskStore(db);
    const projectStore = new ProjectStore(db);

    const task = taskStore.nextPending(project_id);
    if (!task) {
      return JSON.stringify({ success: true, message: 'No pending tasks' });
    }

    const executor = new TaskExecutor(taskStore, projectStore);
    try {
      const result = await executor.runTask(task.id);
      return JSON.stringify({ success: true, task: result });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'run_next_task',
    description: 'Execute the next pending task (optionally filtered by project or session).',
    schema: z.object({
      project_id: z.string().optional(),
      session_id: z.string().optional(),
    }),
  },
);

// ─── run_all_tasks ────────────────────────────────────────────────────────────

const RunAllTasksTool = tool(
  async ({ project_id, session_id, parallel }) => {
    const db = getDb();
    const taskStore = new TaskStore(db);
    const projectStore = new ProjectStore(db);

    const tasks = taskStore.list({
      project_id,
      session_id,
      status: 'pending',
    });

    if (tasks.length === 0) {
      return JSON.stringify({ success: true, message: 'No pending tasks' });
    }

    const executor = new TaskExecutor(taskStore, projectStore);
    try {
      const results = await executor.runAll(tasks, parallel ?? false);
      const summary = {
        total: results.length,
        done: results.filter((t) => t.status === 'done').length,
        failed: results.filter((t) => t.status === 'failed').length,
        awaiting_approval: results.filter((t) => t.status === 'awaiting_approval').length,
      };
      return JSON.stringify({ success: true, summary, tasks: results });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'run_all_tasks',
    description:
      'Execute all pending tasks. Can run in parallel (faster but no dependency order) or serial (respects order).',
    schema: z.object({
      project_id: z.string().optional(),
      session_id: z.string().optional(),
      parallel: z
        .boolean()
        .optional()
        .describe('Run tasks in parallel (default: false = serial)'),
    }),
  },
);

// ─── cancel_task ──────────────────────────────────────────────────────────────

const CancelTaskTool = tool(
  async ({ task_id, reason }) => {
    const db = getDb();
    const taskStore = new TaskStore(db);
    const task = taskStore.getById(task_id);
    if (!task) return JSON.stringify({ success: false, error: 'Task not found' });
    if (['done', 'failed', 'cancelled'].includes(task.status)) {
      return JSON.stringify({ success: false, error: `Cannot cancel task in status: ${task.status}` });
    }
    taskStore.update(task_id, { status: 'cancelled', error: reason });
    return JSON.stringify({ success: true, task_id, message: 'Task cancelled' });
  },
  {
    name: 'cancel_task',
    description: 'Cancel a pending or in_progress task.',
    schema: z.object({
      task_id: z.string(),
      reason: z.string().optional().describe('Reason for cancellation'),
    }),
  },
);

// ─── ask_merovingian ──────────────────────────────────────────────────────────

const AskMerovingianTool = tool(
  async ({ request, session_id }) => {
    const mero = new TheMerovingian();
    try {
      const result = await mero.execute(request, session_id);
      return JSON.stringify({ success: true, result });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'ask_merovingian',
    description:
      'Delegate a task to The Merovingian — a free agent with full system access and no working directory restriction. Use for system-wide tasks, research, or ad-hoc operations outside a project.',
    schema: z.object({
      request: z.string().describe('The task or request for The Merovingian'),
      session_id: z.string().optional().describe('Session ID for message history tracking'),
    }),
  },
);

// ─── check_approvals ─────────────────────────────────────────────────────────

const CheckApprovalsTool = tool(
  async ({ session_id }) => {
    const pending = getPendingApprovals(session_id);
    if (pending.length === 0) {
      return JSON.stringify({ success: true, message: 'No pending approvals' });
    }

    const formatted = pending.map((a) => ({
      id: a.id,
      action_type: a.action_type,
      description: a.action_description,
      task_id: a.task_id,
      created_at: a.created_at,
    }));

    return JSON.stringify({
      success: true,
      count: pending.length,
      approvals: formatted,
      message: `There are ${pending.length} action(s) awaiting your approval.`,
    });
  },
  {
    name: 'check_approvals',
    description:
      'Check if any subagent actions are waiting for user approval in the current session.',
    schema: z.object({
      session_id: z.string().describe('The current session ID'),
    }),
  },
);

// ─── resolve_approval ────────────────────────────────────────────────────────

const ResolveApprovalTool = tool(
  async ({ approval_id, decision, scope }) => {
    const db = getDb();
    const now = Date.now();

    const row = db
      .prepare(`SELECT * FROM approval_requests WHERE id = ?`)
      .get(approval_id) as any;

    if (!row) return JSON.stringify({ success: false, error: 'Approval request not found' });
    if (row.status !== 'pending') {
      return JSON.stringify({ success: false, error: `Already resolved: ${row.status}` });
    }

    let newStatus: string;
    if (decision === 'approve') {
      newStatus = 'approved';
    } else if (decision === 'approve_always') {
      newStatus = 'approved_always';
    } else {
      newStatus = 'denied';
    }

    db.prepare(
      `UPDATE approval_requests SET status = ?, resolved_at = ?, resolved_by = 'user' WHERE id = ?`,
    ).run(newStatus, now, approval_id);

    // If approve_always, create a permanent permission
    if (newStatus === 'approved_always' && scope) {
      const scopeId =
        scope === 'session'
          ? row.session_id
          : scope === 'project'
          ? (db.prepare(`SELECT project_id FROM tasks WHERE id = ?`).get(row.task_id) as any)
              ?.project_id
          : null;

      const permId = `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        `INSERT INTO permissions (id, action_type, scope, scope_id, granted_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(permId, row.action_type, scope, scopeId ?? null, now);
    }

    return JSON.stringify({
      success: true,
      approval_id,
      decision,
      message: `Action ${decision === 'deny' ? 'denied' : 'approved'}.`,
    });
  },
  {
    name: 'resolve_approval',
    description:
      'Approve or deny an action that a subagent requested. Use approve_always to grant permanent permission for this action type.',
    schema: z.object({
      approval_id: z.string().describe('ID of the approval request'),
      decision: z.enum(['approve', 'deny', 'approve_always']),
      scope: z
        .enum(['session', 'project', 'global'])
        .optional()
        .describe('Scope for approve_always: session, project, or global'),
    }),
  },
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const AGENT_TOOLS: StructuredTool[] = [
  CreatePlanTool,
  GetTasksTool,
  GetTaskStatusTool,
  RunNextTaskTool,
  RunAllTasksTool,
  CancelTaskTool,
  AskMerovingianTool,
  CheckApprovalsTool,
  ResolveApprovalTool,
];

export {
  CreatePlanTool,
  GetTasksTool,
  GetTaskStatusTool,
  RunNextTaskTool,
  RunAllTasksTool,
  CancelTaskTool,
  AskMerovingianTool,
  CheckApprovalsTool,
  ResolveApprovalTool,
};
