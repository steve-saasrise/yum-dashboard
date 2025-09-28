// TypeScript types for OpenAI Responses API
// Based on the API documentation

export interface ResponsesAPIClient {
  create(params: CreateResponseParams): Promise<ResponseObject>;
}

export interface CreateResponseParams {
  model: string;
  reasoning?: {
    effort: 'low' | 'medium' | 'high';
  };
  tools?: Tool[];
  include?: string[];
  instructions?: string;
  input: string | Array<string | InputItem>;
  max_output_tokens?: number;
  temperature?: number; // Note: Not supported with structured outputs in GPT-5
  text?: {
    format: {
      type: 'json_schema';
      name: string;
      strict?: boolean;
      schema: any;
    }
  };
  stream?: boolean;
}

export interface Tool {
  type: 'web_search' | 'web_search_preview' | 'file_search' | 'code_interpreter' | 'function';
  search_context_size?: 'low' | 'medium' | 'high';
  filters?: {
    allowed_domains?: string[];
    blocked_domains?: string[];
  };
  user_location?: {
    type: 'approximate';
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };
}

export interface InputItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ResponseObject {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete';
  model: string;
  output?: OutputItem[];
  output_text?: string; // SDK-only aggregated text
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: {
      cached_tokens: number;
    };
    output_tokens_details?: {
      reasoning_tokens: number;
    };
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
  web_search_sources?: string[];
}

export interface OutputItem {
  type: 'web_search_call' | 'message' | 'output_text';
  id?: string;
  status?: string;
  action?: {
    type: string;
    query?: string;
    sources?: string[];
  };
  content?: MessageContent[];
  text?: string;
}

export interface MessageContent {
  type: 'output_text';
  text: string;
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'url_citation';
  start_index: number;
  end_index: number;
  url: string;
  title?: string;
}

// News-specific response structure
export interface NewsDigestResponse {
  bigStory: {
    title: string;
    summary: string;
    source: string;
    sourceUrl: string;
  };
  bullets: Array<{
    text: string;
    summary: string;
    source: string;
    sourceUrl: string;
  }>;
  specialSection: Array<{
    text: string;
    summary: string;
    amount: string;
    series: string;
    source: string;
    sourceUrl: string;
  }>;
}