/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Role {
  USER = 'user',
  BOT = 'bot'
}

export enum ModelName {
  FLASH = 'Jarwo Flash',
  THINKING = 'Jarwo Thinking',
  GROQ_LLAMA_3_3 = 'Llama 3.3 (Groq)',
  GROQ_LLAMA_3_1 = 'Llama 3.1 (Groq)',
  GROQ_QWEN = 'Qwen 32B (Groq)'
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  base64?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  isThinking?: boolean;
  error?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  activeModel: ModelName;
  pinned?: boolean;
}

export interface UserPreferences {
  audioEnabled: boolean;
  theme: 'light' | 'dark';
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}
