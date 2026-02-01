import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { callQwenAI } from '../src/lib/client/ai.chat';
import { logger } from '../src/config/logger';

// Mock fetch
global.fetch = mock.fn();

// Mock logger
mock.mock('../src/config/logger', () => ({
  logger: {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn(),
  }
}));

// Mock Bun.env
const originalEnv = Bun.env;

describe('AI Client Tests', () => {
  beforeEach(() => {
    mock.clearAllMocks();
    
    // Set up test environment variables
    Bun.env = {
      ...originalEnv,
      apiKey: 'test-api-key',
      apiBaseUrl: 'https://test-api.example.com/v1/chat/completions'
    };
  });

  afterEach(() => {
    mock.restoreAllMocks();
    Bun.env = originalEnv;
  });

  describe('callQwenAI', () => {
    const validMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' }
    ];

    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: 'I am doing well, thank you!'
          }
        }
      ]
    };

    it('should successfully call AI API with valid configuration', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      const result = await callQwenAI(validMessages);

      expect(result).toEqual(mockSuccessResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://test-api.example.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct',
            messages: validMessages,
            response_format: { type: 'json_object' }
          })
        })
      );

      expect(logger.info).toHaveBeenCalledWith('调用AI服务: https://test-api.example.com/v1/chat/completions');
      expect(logger.info).toHaveBeenCalledWith('调用AI服务: test-api-key');
    });

    it('should throw error when apiKey is missing', async () => {
      delete Bun.env.apiKey;

      await expect(callQwenAI(validMessages)).rejects.toThrow('AI 服务配置未初始化，请检查环境变量');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error when apiBaseUrl is missing', async () => {
      delete Bun.env.apiBaseUrl;

      await expect(callQwenAI(validMessages)).rejects.toThrow('AI 服务配置未初始化，请检查环境变量');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error when environment variables are empty strings', async () => {
      Bun.env.apiKey = '';
      Bun.env.apiBaseUrl = '';

      await expect(callQwenAI(validMessages)).rejects.toThrow('AI 服务配置未初始化，请检查环境变量');
    });

    it('should handle API response with error status', async () => {
      const errorDetail = 'Invalid API key';
      mock.mock(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: mock.fn().mockResolvedValue(errorDetail)
      });

      await expect(callQwenAI(validMessages)).rejects.toThrow('AI服务调用失败: 401');
      expect(logger.error).toHaveBeenCalledWith('AI API 失败: 401', { detail: errorDetail });
    });

    it('should handle different HTTP error status codes', async () => {
      const errorStatuses = [400, 401, 403, 404, 429, 500, 502, 503];

      for (const status of errorStatuses) {
        mock.mock(fetch).mockResolvedValue({
          ok: false,
          status,
          text: mock.fn().mockResolvedValue(`Error ${status}`)
        });

        await expect(callQwenAI(validMessages)).rejects.toThrow(`AI服务调用失败: ${status}`);
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mock.mock(fetch).mockRejectedValue(networkError);

      await expect(callQwenAI(validMessages)).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mock.mock(fetch).mockRejectedValue(timeoutError);

      await expect(callQwenAI(validMessages)).rejects.toThrow('Request timeout');
    });

    it('should handle malformed JSON response', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      await expect(callQwenAI(validMessages)).rejects.toThrow('Invalid JSON');
    });

    it('should handle empty response body', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(null)
      });

      const result = await callQwenAI(validMessages);
      expect(result).toBeNull();
    });

    it('should send correct request format', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(validMessages);

      const fetchCall = mock.mock(fetch).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toEqual({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: validMessages,
        response_format: { type: 'json_object' }
      });
    });

    it('should handle different message structures', async () => {
      const differentMessages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant response' }
      ];

      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(differentMessages);

      const fetchCall = mock.mock(fetch).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages).toEqual(differentMessages);
    });

    it('should handle messages with special characters', async () => {
      const specialCharMessages = [
        { role: 'user', content: 'Hello 世界! 🌍 Special chars: àáâãäå' }
      ];

      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(specialCharMessages);

      const fetchCall = mock.mock(fetch).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages[0].content).toBe(specialCharMessages[0].content);
    });

    it('should handle very long messages', async () => {
      const longContent = 'a'.repeat(10000);
      const longMessages = [
        { role: 'user', content: longContent }
      ];

      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(longMessages);

      const fetchCall = mock.mock(fetch).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages[0].content).toBe(longContent);
    });

    it('should handle empty messages array', async () => {
      const emptyMessages: any[] = [];

      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(emptyMessages);

      const fetchCall = mock.mock(fetch).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages).toEqual([]);
    });

    it('should validate API key format in logs', async () => {
      const specialApiKey = 'sk-1234567890abcdef';
      Bun.env.apiKey = specialApiKey;

      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      await callQwenAI(validMessages);

      expect(logger.info).toHaveBeenCalledWith('调用AI服务: sk-1234567890abcdef');
    });

    it('should handle API responses with different content types', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { 'content-type': 'text/plain' },
        json: mock.fn().mockResolvedValue(mockSuccessResponse)
      });

      const result = await callQwenAI(validMessages);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle fetch returning undefined error detail', async () => {
      mock.mock(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: mock.fn().mockResolvedValue(undefined)
      });

      await expect(callQwenAI(validMessages)).rejects.toThrow('AI服务调用失败: 500');
      expect(logger.error).toHaveBeenCalledWith('AI API 失败: 500', { detail: undefined });
    });
  });
});