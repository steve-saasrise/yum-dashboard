# OpenAI Responses API Reference

## Overview

The Responses API allows you to create model responses with text or image inputs to generate text or JSON outputs. The model can call custom code or use built-in tools like web search or file search.

## Endpoints

### Create a Response

`POST https://api.openai.com/v1/responses`

Creates a model response with various configuration options.

#### Request Body Parameters

| Parameter              | Type             | Required | Default  | Description                                                                                          |
| ---------------------- | ---------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `background`           | boolean          | No       | false    | Whether to run the model response in the background                                                  |
| `conversation`         | string or object | No       | null     | The conversation this response belongs to. Items from this conversation are prepended to input_items |
| `include`              | array            | No       | -        | Additional output data to include (see Include Options below)                                        |
| `input`                | string or array  | No       | -        | Text, image, or file inputs to the model                                                             |
| `instructions`         | string           | No       | -        | System/developer message inserted into the model's context                                           |
| `max_output_tokens`    | integer          | No       | -        | Upper bound for tokens that can be generated (including reasoning tokens)                            |
| `max_tool_calls`       | integer          | No       | -        | Maximum number of total calls to built-in tools                                                      |
| `metadata`             | map              | No       | -        | Set of 16 key-value pairs (keys: max 64 chars, values: max 512 chars)                                |
| `model`                | string           | No       | -        | Model ID (e.g., `gpt-4o`, `gpt-5`, `o3`)                                                             |
| `parallel_tool_calls`  | boolean          | No       | true     | Whether to allow parallel tool calls                                                                 |
| `previous_response_id` | string           | No       | -        | ID of previous response for multi-turn conversations                                                 |
| `prompt`               | object           | No       | -        | Reference to a prompt template and its variables                                                     |
| `prompt_cache_key`     | string           | No       | -        | Cache key for optimizing similar requests                                                            |
| `reasoning`            | object           | No       | -        | Configuration for reasoning models (gpt-5 and o-series only)                                         |
| `safety_identifier`    | string           | No       | -        | Stable identifier for detecting usage policy violations                                              |
| `service_tier`         | string           | No       | auto     | Processing type: `auto`, `default`, `flex`, or `priority`                                            |
| `store`                | boolean          | No       | true     | Whether to store the response for later retrieval                                                    |
| `stream`               | boolean          | No       | false    | If true, streams response data using server-sent events                                              |
| `stream_options`       | object           | No       | null     | Options for streaming (only when stream: true)                                                       |
| `temperature`          | number           | No       | 1        | Sampling temperature (0-2). Higher = more random                                                     |
| `text`                 | object           | No       | -        | Configuration for text response (plain text or structured JSON)                                      |
| `tool_choice`          | string or object | No       | -        | How the model should select tools                                                                    |
| `tools`                | array            | No       | -        | Array of tools the model may call (see Tools section)                                                |
| `top_logprobs`         | integer          | No       | -        | Number of most likely tokens to return (0-20)                                                        |
| `top_p`                | number           | No       | 1        | Nucleus sampling probability (0-1)                                                                   |
| `truncation`           | string           | No       | disabled | Truncation strategy: `auto` or `disabled`                                                            |
| `user`                 | string           | No       | -        | **Deprecated** - Use `safety_identifier` and `prompt_cache_key` instead                              |

#### Include Options

- `web_search_call.action.sources`: Sources of web search tool calls
- `code_interpreter_call.outputs`: Outputs of Python code execution
- `computer_call_output.output.image_url`: Image URLs from computer calls
- `file_search_call.results`: Search results of file search tool calls
- `message.input_image.image_url`: Image URLs from input messages
- `message.output_text.logprobs`: Logprobs with assistant messages
- `reasoning.encrypted_content`: Encrypted reasoning tokens for multi-turn conversations

#### Tools Categories

1. **Built-in tools**: OpenAI-provided tools (web search, file search)
2. **MCP Tools**: Third-party integrations via MCP servers
3. **Function calls**: Custom functions with strongly typed arguments

#### Example Request

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4.1",
    "tools": [{ "type": "web_search_preview" }],
    "input": "What was a positive news story from today?"
  }'
```

### Get a Response

`GET https://api.openai.com/v1/responses/{response_id}`

Retrieves a model response with the given ID.

#### Path Parameters

- `response_id` (required): The ID of the response to retrieve

#### Query Parameters

- `include` (optional): Additional fields to include
- `include_obfuscation` (optional): Enable stream obfuscation for security
- `starting_after` (optional): Sequence number for streaming
- `stream` (optional): If true, streams response data

#### Example Request

```bash
curl https://api.openai.com/v1/responses/resp_123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Delete a Response

`DELETE https://api.openai.com/v1/responses/{response_id}`

Deletes a model response with the given ID.

#### Path Parameters

- `response_id` (required): The ID of the response to delete

#### Example Request

```bash
curl -X DELETE https://api.openai.com/v1/responses/resp_123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Cancel a Response

`POST https://api.openai.com/v1/responses/{response_id}/cancel`

Cancels a background response. Only responses created with `background: true` can be cancelled.

#### Path Parameters

- `response_id` (required): The ID of the response to cancel

#### Example Request

```bash
curl -X POST https://api.openai.com/v1/responses/resp_123/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### List Input Items

`GET https://api.openai.com/v1/responses/{response_id}/input_items`

Returns a list of input items for a given response.

#### Path Parameters

- `response_id` (required): The ID of the response

#### Query Parameters

- `after` (optional): Item ID for pagination
- `include` (optional): Additional fields to include
- `limit` (optional, default: 20): Number of objects to return (1-100)
- `order` (optional, default: desc): Order of items (`asc` or `desc`)

## Response Object Structure

| Field                  | Type         | Description                                                                          |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `id`                   | string       | Unique identifier for the response                                                   |
| `object`               | string       | Always set to "response"                                                             |
| `created_at`           | number       | Unix timestamp of creation                                                           |
| `status`               | string       | Status: `completed`, `failed`, `in_progress`, `cancelled`, `queued`, or `incomplete` |
| `error`                | object       | Error object if the model fails                                                      |
| `incomplete_details`   | object       | Details about incomplete responses                                                   |
| `model`                | string       | Model ID used to generate the response                                               |
| `output`               | array        | Array of content items generated by the model                                        |
| `output_text`          | string       | SDK-only property with aggregated text output                                        |
| `usage`                | object       | Token usage details                                                                  |
| `conversation`         | object       | Conversation this response belongs to                                                |
| `instructions`         | string/array | System/developer message                                                             |
| `max_output_tokens`    | integer      | Token generation limit                                                               |
| `metadata`             | map          | Custom key-value pairs                                                               |
| `parallel_tool_calls`  | boolean      | Whether parallel tool calls are allowed                                              |
| `previous_response_id` | string       | ID of previous response                                                              |
| `reasoning`            | object       | Reasoning configuration (gpt-5 and o-series)                                         |
| `temperature`          | number       | Sampling temperature used                                                            |
| `tools`                | array        | Tools available to the model                                                         |
| `truncation`           | string       | Truncation strategy used                                                             |

## Usage Object

```json
{
  "input_tokens": 328,
  "input_tokens_details": {
    "cached_tokens": 0
  },
  "output_tokens": 356,
  "output_tokens_details": {
    "reasoning_tokens": 0
  },
  "total_tokens": 684
}
```

## Key Features

### Multi-turn Conversations

- Use `previous_response_id` to link responses
- Or use `conversation` parameter for automatic conversation management

### Streaming

- Set `stream: true` to receive server-sent events
- Use `stream_options` for additional streaming configuration

### Background Processing

- Set `background: true` for long-running responses
- Use the cancel endpoint to stop background responses

### Caching

- Use `prompt_cache_key` for optimizing similar requests
- Improves cache hit rates for repeated patterns

### Service Tiers

- `auto`: Uses project settings
- `default`: Standard pricing and performance
- `flex`: Flexible tier
- `priority`: Priority processing

## Important Notes

- The `user` field is deprecated - use `safety_identifier` and `prompt_cache_key` instead
- Models like `gpt-5` and `o-series` support reasoning configuration
- Maximum metadata: 16 key-value pairs
- Token limits and capabilities vary by model

## Web Search Tool Documentation

### Overview

Web search allows models to access up-to-date information from the internet and provide answers with sourced citations. There are three main types:

1. **Non-reasoning web search**: Fast, direct queries for quick lookups
2. **Agentic search with reasoning models**: Actively manages search process, analyzes results, decides whether to keep searching
3. **Deep research**: Extended investigations using models like `o3-deep-research`, `o4-mini-deep-research`, or `gpt-5` with high reasoning

### Basic Usage

```javascript
import OpenAI from 'openai';
const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-5',
  tools: [{ type: 'web_search' }],
  input: 'What was a positive news story from today?',
});

console.log(response.output_text);
```

### Tool Versions

- `web_search`: Generally available (GA) version
- `web_search_preview`: Previous version, points to `web_search_preview_2025_03_11`

### Compatible Models

- gpt-4o-mini
- gpt-4o
- gpt-4.1-mini
- gpt-4.1
- o4-mini
- o3
- gpt-5 with reasoning levels `low`, `medium` and `high`

### Web Search Parameters

#### Domain Filtering

Limit results to specific domains (up to 20):

```javascript
{
  type: "web_search",
  filters: {
    allowed_domains: [
      "techcrunch.com",
      "forbes.com",
      "reuters.com"
    ]
  }
}
```

#### User Location

Refine results based on geography:

```javascript
{
  type: "web_search",
  user_location: {
    type: "approximate",
    country: "US",      // ISO country code
    city: "New York",   // Free text
    region: "NY",       // Free text
    timezone: "America/New_York"  // IANA timezone
  }
}
```

#### Search Context Size

Control how much context is retrieved:

```javascript
{
  type: "web_search",
  search_context_size: "medium"  // "low", "medium" (default), "high"
}
```

- **high**: Most comprehensive, slower
- **medium**: Balanced (default)
- **low**: Fastest, less context

Note: Not supported for o3, o3-pro, o4-mini, and deep research models.

### Getting Sources

To see all domains searched (not just cited):

```javascript
const response = await client.responses.create({
  model: 'gpt-5',
  tools: [{ type: 'web_search' }],
  include: ['web_search_call.action.sources'],
  input: 'Latest SaaS news',
});
```

### Output Structure

Responses include:

1. `web_search_call` with search metadata
2. `message` with text and URL citations

```json
[
  {
    "type": "web_search_call",
    "id": "ws_xyz...",
    "status": "completed",
    "action": {
      "type": "search",
      "query": "search query used",
      "sources": ["url1", "url2", ...]  // When included
    }
  },
  {
    "type": "message",
    "content": [{
      "type": "output_text",
      "text": "Response text...",
      "annotations": [{
        "type": "url_citation",
        "start_index": 100,
        "end_index": 200,
        "url": "https://...",
        "title": "Article Title"
      }]
    }]
  }
]
```

### Reasoning Levels (GPT-5)

Configure reasoning effort for search depth:

```javascript
{
  model: "gpt-5",
  reasoning: { effort: "medium" },  // "low", "medium", "high"
  tools: [{ type: "web_search" }]
}
```

### Limitations

- Not supported in `gpt-5` with `minimal` reasoning or `gpt-4.1-nano`
- Limited to 128K context window even with larger models
- Same rate limits as underlying models
- User location not supported for deep research models

### Cost Considerations

- Search content tokens may be free for some models
- Billed at model's text token rates for others
- Higher context sizes increase cost but improve quality
