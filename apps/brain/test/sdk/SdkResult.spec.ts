import type { NonNullableUsage, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';
import { SdkResult } from '@simple-claude-bot/brain-core/sdk/SdkResult';
import { describe, expect, it } from 'vitest';

function createResultMessage(overrides: Partial<SDKResultSuccess> = {}): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    result: 'Hello!',
    stop_reason: 'end_turn',
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: {
        ephemeral_1h_input_tokens: 0,
        ephemeral_5m_input_tokens: 0,
      },
      inference_geo: '',
      iterations: [],
      server_tool_use: {
        web_fetch_requests: 0,
        web_search_requests: 0,
      },
      service_tier: 'standard',
      speed: 'standard',
    } satisfies NonNullableUsage,
    modelUsage: {},
    permission_denials: [],
    uuid: '00000000-0000-0000-0000-000000000000',
    session_id: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  } satisfies SDKResultSuccess;
}

describe('SdkResult', () => {
  describe('normal success', () => {
    const msg = createResultMessage();
    const sdkResult = new SdkResult(msg);

    it('is not an error', () => {
      const actual = sdkResult.isError;
      const expected = false;
      expect(actual).toEqual(expected);
    });

    it('is not an API error', () => {
      const actual = sdkResult.isApiError;
      const expected = false;
      expect(actual).toEqual(expected);
    });

    it('has null apiError', () => {
      const actual = sdkResult.apiError;
      expect(actual).toBeNull();
    });

    it('is not rate limited', () => {
      const actual = sdkResult.isRateLimited;
      const expected = false;
      expect(actual).toEqual(expected);
    });

    it('has the result string', () => {
      const actual = sdkResult.result;
      const expected = 'Hello!';
      expect(actual).toEqual(expected);
    });

    it('has the stop reason', () => {
      const actual = sdkResult.stopReason;
      const expected = 'end_turn';
      expect(actual).toEqual(expected);
    });
  });

  describe('API error 400 with valid JSON', () => {
    const msg = createResultMessage({
      is_error: true,
      stop_reason: 'stop_sequence',
      total_cost_usd: 0.005,
      result: 'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Unable to download the file. Please verify the URL and try again."},"request_id":"req_011CYAtVCi31nkqkgUGYaAh4"}',
    });
    const sdkResult = new SdkResult(msg);

    it('is an API error', () => {
      const actual = sdkResult.isApiError;
      const expected = true;
      expect(actual).toEqual(expected);
    });

    it('has status code 400', () => {
      const actual = sdkResult.apiError?.statusCode;
      const expected = 400;
      expect(actual).toEqual(expected);
    });

    it('has error type invalid_request_error', () => {
      const actual = sdkResult.apiError?.errorType;
      const expected = 'invalid_request_error';
      expect(actual).toEqual(expected);
    });

    it('has the error message', () => {
      const actual = sdkResult.apiError?.errorMessage;
      const expected = 'Unable to download the file. Please verify the URL and try again.';
      expect(actual).toEqual(expected);
    });

    it('is not rate limited', () => {
      const actual = sdkResult.isRateLimited;
      const expected = false;
      expect(actual).toEqual(expected);
    });
  });

  describe('API error 401', () => {
    const msg = createResultMessage({
      is_error: true,
      stop_reason: 'stop_sequence',
      result: 'API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"Invalid API key"}}',
    });
    const sdkResult = new SdkResult(msg);

    it('has status code 401', () => {
      const actual = sdkResult.apiError?.statusCode;
      const expected = 401;
      expect(actual).toEqual(expected);
    });

    it('has error type authentication_error', () => {
      const actual = sdkResult.apiError?.errorType;
      const expected = 'authentication_error';
      expect(actual).toEqual(expected);
    });
  });

  describe('API error with malformed JSON', () => {
    const msg = createResultMessage({
      is_error: true,
      result: 'API Error: 500 {not valid json}',
    });
    const sdkResult = new SdkResult(msg);

    it('is an API error', () => {
      const actual = sdkResult.isApiError;
      const expected = true;
      expect(actual).toEqual(expected);
    });

    it('has status code 500', () => {
      const actual = sdkResult.apiError?.statusCode;
      const expected = 500;
      expect(actual).toEqual(expected);
    });

    it('has null error type', () => {
      const actual = sdkResult.apiError?.errorType;
      expect(actual).toBeNull();
    });

    it('has null error message', () => {
      const actual = sdkResult.apiError?.errorMessage;
      expect(actual).toBeNull();
    });
  });

  describe('non-API error string', () => {
    const msg = createResultMessage({
      is_error: true,
      result: 'Some other SDK error occurred',
    });
    const sdkResult = new SdkResult(msg);

    it('is not an API error', () => {
      const actual = sdkResult.isApiError;
      const expected = false;
      expect(actual).toEqual(expected);
    });

    it('has null apiError', () => {
      const actual = sdkResult.apiError;
      expect(actual).toBeNull();
    });
  });

  describe('rate limited', () => {
    const msg = createResultMessage({
      is_error: true,
      total_cost_usd: 0,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 0,
        },
        inference_geo: '',
        iterations: [],
        server_tool_use: {
          web_fetch_requests: 0,
          web_search_requests: 0,
        },
        service_tier: 'standard',
        speed: 'standard',
      } satisfies NonNullableUsage,
      result: 'Error: 429 rate_limit_error - Too many requests',
    });
    const sdkResult = new SdkResult(msg);

    it('is rate limited', () => {
      const actual = sdkResult.isRateLimited;
      const expected = true;
      expect(actual).toEqual(expected);
    });
  });

  describe('not rate limited when tokens are present', () => {
    const msg = createResultMessage({
      is_error: true,
      total_cost_usd: 0.01,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 0,
        },
        inference_geo: '',
        iterations: [],
        server_tool_use: {
          web_fetch_requests: 0,
          web_search_requests: 0,
        },
        service_tier: 'standard',
        speed: 'standard',
      },
      result: 'Error: 429 rate_limit_error - Too many requests',
    });
    const sdkResult = new SdkResult(msg);

    it('is not rate limited', () => {
      const actual = sdkResult.isRateLimited;
      const expected = false;
      expect(actual).toEqual(expected);
    });
  });
});
