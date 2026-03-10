export type MemoryCategory = 
  | 'preference'
  | 'project'
  | 'identity'
  | 'constraint'
  | 'context'
  | 'personal_data'
  | 'languages'
  | 'favorite_things'
  | 'relationships'
  | 'pets'
  | 'naming'
  | 'professional_profile';

export type MemoryImportance = 'low' | 'medium' | 'high';

export interface IMemoryRecord {
  id: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  summary: string;
  details?: string;
  hash: string;
  source?: string;
  created_at: Date;
  updated_at: Date;
  last_accessed_at?: Date;
  access_count: number;
  version: number;
  archived: boolean;
}

export interface ISatiRetrievalInput {
  current_message: string;
  recent_messages: string[];
  memory_limit: number;
}

export interface ISatiRetrievalOutput {
  relevant_memories: {
    summary: string;
    category: MemoryCategory;
    importance: MemoryImportance;
  }[];
}

export interface ISatiEvaluationInput {
  recent_conversation: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  existing_memory_summaries: string[];
}

export interface ISatiEvaluationOutput {
  should_store: boolean;
  category?: MemoryCategory;
  importance?: MemoryImportance;
  summary?: string;
  reason?: string;
}

export interface ISatiService {
  /**
   * Initializes the database connection and schema.
   */
  initialize(): Promise<void>;

  /**
   * Retrieves relevant memories based on user input.
   */
  recover(currentMessage: string, recentMessages: string[]): Promise<ISatiRetrievalOutput>;

  /**
   * Evaluates the conversation and persists new memories if needed.
   */
  evaluateAndPersist(conversation: { role: string; content: string }[]): Promise<void>;
}
