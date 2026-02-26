import { HttpClient } from './httpClient';

export interface Skill {
  name: string;
  description: string;
  version?: string;
  author?: string;
  enabled: boolean;
  tags?: string[];
  examples?: string[];
  path: string;
}

export interface SkillsListResponse {
  skills: Skill[];
  total: number;
  enabled: number;
}

export interface SkillDetailResponse extends Skill {
  content: string | null;
}

export interface SkillReloadResponse {
  success: boolean;
  loaded: number;
  errors: Array<{
    directory: string;
    message: string;
  }>;
}

export interface SkillToggleResponse {
  success: boolean;
  name: string;
  enabled: boolean;
}

const httpClient = HttpClient.getInstance();

export const skillsService = {
  /** Fetch all skills */
  fetchSkills: async (): Promise<SkillsListResponse> =>
    httpClient.get<SkillsListResponse>('/skills'),

  /** Fetch a single skill with its content */
  fetchSkill: async (name: string): Promise<SkillDetailResponse> =>
    httpClient.get<SkillDetailResponse>(`/skills/${encodeURIComponent(name)}`),

  /** Reload skills from filesystem */
  reloadSkills: async (): Promise<SkillReloadResponse> =>
    httpClient.post<SkillReloadResponse>('/skills/reload', {}),

  /** Enable a skill */
  enableSkill: async (name: string): Promise<SkillToggleResponse> =>
    httpClient.post<SkillToggleResponse>(`/skills/${encodeURIComponent(name)}/enable`, {}),

  /** Disable a skill */
  disableSkill: async (name: string): Promise<SkillToggleResponse> =>
    httpClient.post<SkillToggleResponse>(`/skills/${encodeURIComponent(name)}/disable`, {}),
};
