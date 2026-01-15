import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import app from '../src/app';
import { logger } from '../src/config/logger';

// Mock the logger to avoid actual file operations during tests
mock.mock('../src/config/logger', () => ({
  logger: {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn(),
  }
}));

describe('App Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mock.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    mock.restoreAllMocks();
  });

  describe('Health Check Endpoint', () => {
    it('should return health check information', async () => {
      const res = await app.request('/');
      
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        message: 'Bidong API is running',
        version: '1.0.0',
      });
      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe('string');
    });

    it('should return valid ISO timestamp format', async () => {
      const res = await app.request('/');
      const json = await res.json();
      
      expect(() => new Date(json.timestamp)).not.toThrow();
      expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
    });
  });

  describe('Middleware Tests', () => {
    it('should apply response format middleware to GET /', async () => {
      const res = await app.request('/');
      
      // After middleware, response should be wrapped
      expect(res.status).toBe(200);
      const json = await res.json();
      
      // The health check endpoint returns raw JSON, but middleware wraps it
      // So we check if the response structure is maintained
      expect(json.message).toBe('Bidong API is running');
    });

    it('should log request information', async () => {
      await app.request('/');
      
      // Check if logger.info was called (for request logging)
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await app.request('/non-existent-route');
      
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toMatchObject({
        code: 404,
        message: 'API接口不存在',
        data: null,
      });
    });

    it('should handle various HTTP methods for non-existent routes', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const res = await app.request('/non-existent', { method });
        expect(res.status).toBe(404);
        
        const json = await res.json();
        expect(json.code).toBe(404);
        expect(json.message).toBe('API接口不存在');
      }
    });
  });

  describe('Error Handler', () => {
    it('should handle server errors gracefully', async () => {
      // Mock a route that throws an error
      const testApp = app.clone();
      testApp.get('/error', () => {
        throw new Error('Test error message');
      });

      const res = await testApp.request('/error');
      
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toMatchObject({
        code: 500,
        message: 'Test error message',
        data: null,
      });
    });

    it('should handle errors without message', async () => {
      const testApp = app.clone();
      testApp.get('/error-no-message', () => {
        const error = new Error();
        delete error.message;
        throw error;
      });

      const res = await testApp.request('/error-no-message');
      
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe(500);
      expect(json.message).toBe('Internal Server Error');
    });
  });

  describe('Route Registration', () => {
    it('should have extract user profile tags route registered', async () => {
      // Test that the route exists (should not return 404)
      const res = await app.request('/v1/extractUserProfileTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          user_introduces: 'Test user introduction',
          user_sex: '男',
          user_age: 25
        })
      });
      
      // Should not be 404 (routing exists), though might be validation error
      expect(res.status).not.toBe(404);
    });
  });

  describe('Request Logging Middleware', () => {
    it('should log request method and URL', async () => {
      await app.request('/test-path');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /test-path')
      );
    });

    it('should log different HTTP methods', async () => {
      const methodsAndPaths = [
        { method: 'GET', path: '/' },
        { method: 'POST', path: '/test' },
        { method: 'PUT', path: '/test' },
      ];

      for (const { method, path } of methodsAndPaths) {
        await app.request(path, { method });
        
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(`${method} ${path}`)
        );
      }
    });
  });

  describe('Response Format Middleware', () => {
    it('should wrap responses in standard format', async () => {
      const testApp = app.clone();
      testApp.get('/test-data', (c) => {
        return c.json({ customData: 'test' });
      });

      const res = await testApp.request('/test-data');
      const json = await res.json();
      
      // Response should be wrapped by middleware
      expect(json.code).toBe(200);
      expect(json.message).toBe('返回结果成功');
      expect(json.data).toBeDefined();
    });
  });
});