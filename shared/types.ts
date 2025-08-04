// Shared types between client and server

export interface ServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string | number
  name: string
  parameters: any
  timestamp: Date
  status: 'executing' | 'completed' | 'error'
  result?: any
  error?: string
}

export interface ModelDefinition {
  id: string
  provider: 'anthropic' | 'openai' | 'ollama'
  name: string
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema: any
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ConnectionTestResponse {
  success: boolean
  error?: string
  details?: string
}

export interface ChatStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'elicitation_request' | 'elicitation_complete' | 'error'
  content?: string
  toolCall?: ToolCall
  toolResult?: {
    id: string | number
    toolCallId: string | number
    result?: any
    error?: string
    timestamp: Date
  }
  requestId?: string
  message?: string
  schema?: any
  error?: string
  timestamp?: Date
}

// Server status types
export interface ServerStatus {
  status: 'ok' | 'error'
  timestamp: string
  service?: string
}