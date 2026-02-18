import { httpClient } from './httpClient';

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  git_remote?: string;
  active_worktree?: string;
  allowed_commands: string[];
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
}

export const projectsService = {
  list: () => httpClient.get<Project[]>('/projects'),

  get: (id: string) => httpClient.get<Project>(`/projects/${id}`),

  create: (input: CreateProjectInput) =>
    httpClient.post<Project>('/projects', input),

  update: (id: string, input: UpdateProjectInput) =>
    httpClient.put<Project>(`/projects/${id}`, input),

  delete: (id: string) =>
    httpClient.delete<{ success: boolean }>(`/projects/${id}`),
};
