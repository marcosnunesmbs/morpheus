export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  git_remote?: string;
  active_worktree?: string;
  allowed_commands: string[]; // stored as JSON in DB
  created_at: number;
  updated_at: number;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
  git_remote?: string;
  allowed_commands?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  path?: string;
  description?: string;
  git_remote?: string;
  allowed_commands?: string[];
  active_worktree?: string;
}
