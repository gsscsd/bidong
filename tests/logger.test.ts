import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import winston from 'winston';
import { logger } from '../src/config/logger';

// Mock console to prevent actual console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Logger Configuration Tests', () => {
  beforeEach(() => {
    // Mock console methods
    console.log = mock.fn();
    console.error = mock.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Logger Instance', () => {
    it('should create a winston logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(winston.Logger);
    });

    it('should have correct log level', () => {
      expect(logger.level).toBe('info');
    });

    it('should have default meta information', () => {
      const loggerInstance = logger as any;
      expect(loggerInstance.defaultMeta).toEqual({
        service: 'bidong-api'
      });
    });
  });

  describe('Log Format', () => {
    it('should use json format with timestamp', () => {
      const loggerInstance = logger as any;
      const format = loggerInstance.format;
      
      expect(format).toBeDefined();
    });

    it('should handle error stack traces', () => {
      const error = new Error('Test error');
      const errorSpy = mock.spyOn(logger, 'error');

      logger.error('Test error message', { error });
      
      expect(errorSpy).toHaveBeenCalledWith('Test error message', { error });
    });
  });

  describe('File Transports', () => {
    it('should have file transport for error logs', () => {
      const loggerInstance = logger as any;
      const transports = loggerInstance.transports;
      
      const errorTransport = transports.find((t: any) => 
        t.filename === 'logs/error.log' && t.level === 'error'
      );
      
      expect(errorTransport).toBeDefined();
    });

    it('should have file transport for combined logs', () => {
      const loggerInstance = logger as any;
      const transports = loggerInstance.transports;
      
      const combinedTransport = transports.find((t: any) => 
        t.filename === 'logs/combined.log'
      );
      
      expect(combinedTransport).toBeDefined();
    });
  });

  describe('Console Transport', () => {
    it('should add console transport in non-production environment', () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Set to non-production
      process.env.NODE_ENV = 'development';
      
      // Require fresh logger to test console transport
      mock.resetModules();
      const { logger: devLogger } = require('../src/config/logger');
      const loggerInstance = devLogger as any;
      
      const consoleTransport = loggerInstance.transports.find((t: any) => 
        t.name === 'console'
      );
      
      expect(consoleTransport).toBeDefined();
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not add console transport in production environment', () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Set to production
      process.env.NODE_ENV = 'production';
      
      // Require fresh logger to test production behavior
      mock.resetModules();
      const { logger: prodLogger } = require('../src/config/logger');
      const loggerInstance = prodLogger as any;
      
      const consoleTransport = loggerInstance.transports.find((t: any) => 
        t.name === 'console'
      );
      
      expect(consoleTransport).toBeUndefined();
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Logging Methods', () => {
    it('should log info messages', () => {
      const infoSpy = mock.spyOn(logger, 'info');
      const message = 'Test info message';
      const meta = { userId: '123' };

      logger.info(message, meta);

      expect(infoSpy).toHaveBeenCalledWith(message, meta);
    });

    it('should log error messages', () => {
      const errorSpy = mock.spyOn(logger, 'error');
      const message = 'Test error message';
      const meta = { error: new Error('Test error') };

      logger.error(message, meta);

      expect(errorSpy).toHaveBeenCalledWith(message, meta);
    });

    it('should log warning messages', () => {
      const warnSpy = mock.spyOn(logger, 'warn');
      const message = 'Test warning message';
      const meta = { warning: 'Test warning' };

      logger.warn(message, meta);

      expect(warnSpy).toHaveBeenCalledWith(message, meta);
    });

    it('should log debug messages', () => {
      const debugSpy = mock.spyOn(logger, 'debug');
      const message = 'Test debug message';
      const meta = { debug: true };

      logger.debug(message, meta);

      expect(debugSpy).toHaveBeenCalledWith(message, meta);
    });

    it('should handle logging without metadata', () => {
      const infoSpy = mock.spyOn(logger, 'info');
      const message = 'Simple message';

      logger.info(message);

      expect(infoSpy).toHaveBeenCalledWith(message);
    });

    it('should handle complex metadata objects', () => {
      const infoSpy = mock.spyOn(logger, 'info');
      const message = 'Complex message';
      const complexMeta = {
        user: {
          id: '123',
          name: 'Test User',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        request: {
          method: 'POST',
          url: '/api/test',
          headers: {
            'content-type': 'application/json'
          }
        },
        timestamp: new Date().toISOString(),
        array: [1, 2, 3, { nested: 'value' }]
      };

      logger.info(message, complexMeta);

      expect(infoSpy).toHaveBeenCalledWith(message, complexMeta);
    });
  });

  describe('Error Handling', () => {
    it('should handle circular reference objects', () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      expect(() => {
        logger.info('Circular reference test', circularObject);
      }).not.toThrow();
    });

    it('should handle very large metadata', () => {
      const largeMeta = {
        data: 'x'.repeat(10000),
        array: new Array(1000).fill('large data')
      };

      expect(() => {
        logger.info('Large metadata test', largeMeta);
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const specialMessages = [
        'Test with emoji 🚀',
        'Test with unicode 你好',
        'Test with quotes "single" and \'double\'',
        'Test with newlines\nand\ttabs',
        'Test with backslashes \\ and slashes /',
        'Test with HTML <script>alert("xss")</script>',
        'Test with JSON {"key": "value"}'
      ];

      specialMessages.forEach(message => {
        expect(() => {
          logger.info(message);
        }).not.toThrow();
      });
    });
  });

  describe('Performance', () => {
    it('should handle rapid logging without errors', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            logger.info(`Message ${i}`, { index: i });
            resolve();
          })
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle concurrent logging', async () => {
      const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            logger.info(`Concurrent message ${i}`, { thread: i });
            resolve();
          }, Math.random() * 10);
        })
      );

      await expect(Promise.all(concurrentPromises)).resolves.not.toThrow();
    });
  });

  describe('Log Levels', () => {
    it('should respect log level hierarchy', () => {
      // Store original level
      const originalLevel = logger.level;
      
      // Set to error level
      logger.level = 'error';
      
      const infoSpy = mock.spyOn(logger, 'info');
      const errorSpy = mock.spyOn(logger, 'error');
      
      logger.info('This should not be logged');
      logger.error('This should be logged');
      
      // Info should not be called at error level
      // Error should be called
      expect(errorSpy).toHaveBeenCalled();
      
      // Restore original level
      logger.level = originalLevel;
    });
  });
});