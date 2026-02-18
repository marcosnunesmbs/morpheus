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
import type { CreateProjectInput, UpdateProjectInput } from '../../projects/types.js';

// ─── list_projects ────────────────────────────────────────────────────────────

const ListProjectsTool = tool(
  async () => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const projects = projectStore.list();
    return JSON.stringify({
      success: true,
      count: projects.length,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        description: p.description,
        git_remote: p.git_remote,
        allowed_commands: p.allowed_commands,
        created_at: p.created_at,
      })),
    });
  },
  {
    name: 'list_projects',
    description:
      'List all registered projects. Always call this before creating tasks for Apoc to find the correct project_id.',
    schema: z.object({}),
  },
);

// ─── create_project ───────────────────────────────────────────────────────────

const CreateProjectTool = tool(
  async ({ name, path, description, git_remote, allowed_commands }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    try {
      const project = projectStore.create({
        name,
        path,
        description,
        git_remote,
        allowed_commands: allowed_commands ?? [],
      } as CreateProjectInput);
      return JSON.stringify({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          path: project.path,
          allowed_commands: project.allowed_commands,
        },
        message: `Project '${project.name}' registered with ID ${project.id}. Use this project_id when creating tasks for Apoc.`,
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'create_project',
    description:
      'Register a new project in the database. Apoc can only work within registered projects — always register a project before creating Apoc tasks.',
    schema: z.object({
      name: z.string().describe('Human-readable project name'),
      path: z.string().describe('Absolute path to the project directory on the filesystem'),
      description: z.string().optional().describe('Brief description of the project'),
      git_remote: z.string().optional().describe('Git remote URL (e.g. https://github.com/...)'),
      allowed_commands: z
        .array(z.string())
        .optional()
        .describe(
          'Commands Apoc is allowed to run (e.g. ["npm", "git", "python"]). Empty = block all commands.',
        ),
    }),
  },
);

// ─── get_project ──────────────────────────────────────────────────────────────

const GetProjectTool = tool(
  async ({ project_id }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const project = projectStore.getById(project_id);
    if (!project) return JSON.stringify({ success: false, error: `Project '${project_id}' not found` });
    return JSON.stringify({ success: true, project });
  },
  {
    name: 'get_project',
    description: 'Get detailed information about a specific project by ID.',
    schema: z.object({ project_id: z.string() }),
  },
);

// ─── update_project ───────────────────────────────────────────────────────────

const UpdateProjectTool = tool(
  async ({ project_id, name, path, description, git_remote, allowed_commands }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const existing = projectStore.getById(project_id);
    if (!existing) return JSON.stringify({ success: false, error: `Project '${project_id}' not found` });

    const updates: UpdateProjectInput = {};
    if (name !== undefined) updates.name = name;
    if (path !== undefined) updates.path = path;
    if (description !== undefined) updates.description = description;
    if (git_remote !== undefined) updates.git_remote = git_remote;
    if (allowed_commands !== undefined) updates.allowed_commands = allowed_commands;

    const updated = projectStore.update(project_id, updates);
    return JSON.stringify({
      success: true,
      project: updated ?? existing,
      message: `Project '${(updated ?? existing).name}' updated.`,
    });
  },
  {
    name: 'update_project',
    description: 'Update an existing project (name, path, description, allowed commands, etc.).',
    schema: z.object({
      project_id: z.string(),
      name: z.string().optional(),
      path: z.string().optional(),
      description: z.string().optional(),
      git_remote: z.string().optional(),
      allowed_commands: z.array(z.string()).optional(),
    }),
  },
);

// ─── delete_project ───────────────────────────────────────────────────────────

const DeleteProjectTool = tool(
  async ({ project_id }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const existing = projectStore.getById(project_id);
    if (!existing) return JSON.stringify({ success: false, error: `Project '${project_id}' not found` });
    projectStore.delete(project_id);
    return JSON.stringify({
      success: true,
      message: `Project '${existing.name}' removed from the database. No files were deleted.`,
    });
  },
  {
    name: 'delete_project',
    description:
      'Remove a project from the database. Does NOT delete files from the filesystem. Only removes the registration.',
    schema: z.object({ project_id: z.string() }),
  },
);

// ─── create_plan ──────────────────────────────────────────────────────────────

const CreatePlanTool = tool(
  async ({ objective, project_id, session_id }) => {
    const db = getDb();
    const projectStore = new ProjectStore(db);
    const taskStore = new TaskStore(db);

    // Validate project_id if provided
    if (project_id) {
      const proj = projectStore.getById(project_id);
      if (!proj) {
        return JSON.stringify({
          success: false,
          error: `Project '${project_id}' not found. Use list_projects to see available projects or create_project to register one.`,
        });
      }
    }

    const architect = new TheArchitect();
    const keymaker = new TheKeymaker();

    try {
      // 1. Architect creates the strategic plan
      const plan = await architect.createPlan(objective, session_id);

      // 2. Validate: Apoc tasks require a project
      const hasApocTasks = plan.tasks.some((t) => t.assigned_to === 'apoc');
      if (hasApocTasks && !project_id) {
        return JSON.stringify({
          success: false,
          error:
            'This plan includes tasks for Apoc, which requires a registered project. ' +
            'Use list_projects to find a project or create_project to register one, then include project_id.',
        });
      }

      // 3. Keymaker creates technical blueprints
      const blueprints = await keymaker.createBlueprints(plan, session_id);

      // 4. Determine working_dir from project (if provided)
      let workingDir: string | undefined;
      if (project_id) {
        const project = projectStore.getById(project_id);
        workingDir = project?.path;
      }

      // 5. Persist tasks to DB
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
        message:
          `Plan created with ${createdTasks.length} task(s). ` +
          `Use run_all_tasks or run_next_task to start execution. ` +
          `Tasks run in background — use get_task_status to check progress.`,
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'create_plan',
    description:
      'Decompose an objective into tasks using The Architect (strategic plan) and The Keymaker (technical blueprints). Tasks are persisted to the database. For Apoc tasks, project_id is required.',
    schema: z.object({
      objective: z.string().describe('The objective to decompose into tasks'),
      project_id: z
        .string()
        .optional()
        .describe('Project ID to associate tasks with (required for Apoc tasks)'),
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

    // Fire-and-forget: dispatch in background, return immediately
    executor.runInBackground([task.id], false, session_id);

    return JSON.stringify({
      success: true,
      message: `Task '${task.title}' dispatched to ${task.assigned_to ?? 'apoc'} in background.`,
      task_id: task.id,
      task_title: task.title,
      assigned_to: task.assigned_to,
      note: 'Use get_task_status to check progress. You will be notified when it completes.',
    });
  },
  {
    name: 'run_next_task',
    description:
      'Dispatch the next pending task to the appropriate agent in background (non-blocking). Returns immediately with the task ID. Use get_task_status to poll progress.',
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
    const taskIds = tasks.map((t) => t.id);

    // Fire-and-forget: dispatch all in background, return immediately
    executor.runInBackground(taskIds, parallel ?? false, session_id);

    return JSON.stringify({
      success: true,
      message: `${taskIds.length} task(s) dispatched in background (${parallel ? 'parallel' : 'serial'}).`,
      task_ids: taskIds,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        assigned_to: t.assigned_to,
        status: t.status,
      })),
      note: 'Tasks are running in background. Use get_task_status to check individual progress, or get_tasks to see all. You will be notified when all tasks complete.',
    });
  },
  {
    name: 'run_all_tasks',
    description:
      'Dispatch all pending tasks to their agents in background (non-blocking). Returns immediately with task IDs. Can run in parallel or serial order.',
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
  ListProjectsTool,
  CreateProjectTool,
  GetProjectTool,
  UpdateProjectTool,
  DeleteProjectTool,
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
  ListProjectsTool,
  CreateProjectTool,
  GetProjectTool,
  UpdateProjectTool,
  DeleteProjectTool,
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
