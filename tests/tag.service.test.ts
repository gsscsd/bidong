import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { extractUserProfileTags } from '../src/services/tag.service';
import { callQwenAI } from '../src/lib/ai.chat';
import { EXTRACT_USER_PROFILE_TAGS_PROMPT } from '../src/constants/prompts';
import { logger } from '../src/config/logger';
import type { CreateExtractUserProfileTagDto } from '../src/types/user.profile.type';

// Mock dependencies
mock.mock('../src/lib/ai-client', () => ({
  callQwenAI: mock.fn(),
}));

mock.mock('../src/config/logger', () => ({
  logger: {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn(),
  }
}));

describe('Tag Service Tests', () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  afterEach(() => {
    mock.restoreAllMocks();
  });

  describe('extractUserProfileTags', () => {
    const validDto: CreateExtractUserProfileTagDto = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      user_introduces: '我是一名软件工程师，在北京工作，喜欢编程和阅读技术书籍。',
      user_sex: '男',
      user_age: 30
    };

    const mockAIResponse = {
      choices: [
        {
          message: {
            content: '{"tags": ["软件工程师", "北京", "编程", "技术书籍", "阅读"]}'
          }
        }
      ]
    };

    it('should successfully extract tags from user introduction', async () => {
      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      const result = await extractUserProfileTags(validDto);

      expect(result).toEqual({
        tags: ["软件工程师", "北京", "编程", "技术书籍", "阅读"]
      });

      expect(callQwenAI).toHaveBeenCalledWith([
        { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
        { role: 'user', content: validDto.user_introduces }
      ]);

      expect(logger.info).toHaveBeenCalledWith('大模型返回结果为: ', {
        content: '{"tags": ["软件工程师", "北京", "编程", "技术书籍", "阅读"]}'
      });
    });

    it('should handle parsed object response', async () => {
      const objectResponse = {
        choices: [
          {
            message: {
              content: { tags: ["开发", "技术"] }
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(objectResponse);

      const result = await extractUserProfileTags(validDto);

      expect(result).toEqual({ tags: ["开发", "技术"] });
    });

    it('should throw error when AI response content is empty', async () => {
      const emptyResponse = {
        choices: [
          {
            message: {
              content: null
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(emptyResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should throw error when AI response has no choices', async () => {
      const noChoicesResponse = {};

      mock.mock(callQwenAI).mockResolvedValue(noChoicesResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should throw error when AI response has undefined choices', async () => {
      const undefinedChoicesResponse = {
        choices: undefined
      };

      mock.mock(callQwenAI).mockResolvedValue(undefinedChoicesResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should throw error when AI response choice has no message', async () => {
      const noMessageResponse = {
        choices: [
          {
            message: undefined
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(noMessageResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should throw error when AI response message has no content', async () => {
      const noContentResponse = {
        choices: [
          {
            message: {
              content: undefined
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(noContentResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should handle AI service call errors', async () => {
      const errorMessage = 'AI service unavailable';
      mock.mock(callQwenAI).mockRejectedValue(new Error(errorMessage));

      await expect(extractUserProfileTags(validDto)).rejects.toThrow(errorMessage);
    });

    it('should handle invalid JSON in AI response', async () => {
      const invalidJSONResponse = {
        choices: [
          {
            message: {
              content: 'invalid json content'
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(invalidJSONResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow();
    });

    it('should handle empty JSON object in AI response', async () => {
      const emptyObjectResponse = {
        choices: [
          {
            message: {
              content: '{}'
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(emptyObjectResponse);

      const result = await extractUserProfileTags(validDto);
      expect(result).toEqual({});
    });

    it('should handle JSON array in AI response', async () => {
      const arrayResponse = {
        choices: [
          {
            message: {
              content: '["tag1", "tag2", "tag3"]'
            }
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(arrayResponse);

      const result = await extractUserProfileTags(validDto);
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it('should handle very long user introductions', async () => {
      const longIntroduction = 'a'.repeat(10000);
      const longDto = {
        ...validDto,
        user_introduces: longIntroduction
      };

      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      const result = await extractUserProfileTags(longDto);

      expect(callQwenAI).toHaveBeenCalledWith([
        { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
        { role: 'user', content: longIntroduction }
      ]);

      expect(result).toEqual({
        tags: ["软件工程师", "北京", "编程", "技术书籍", "阅读"]
      });
    });

    it('should handle special characters in user introduction', async () => {
      const specialCharDto = {
        ...validDto,
        user_introduces: '我是一名软件开发者👨‍💻，在北京🏙️工作，喜欢编程💻和阅读📚技术书籍。'
      };

      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      await extractUserProfileTags(specialCharDto);

      expect(callQwenAI).toHaveBeenCalledWith([
        { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
        { role: 'user', content: specialCharDto.user_introduces }
      ]);
    });

    it('should handle multiline user introductions', async () => {
      const multilineDto = {
        ...validDto,
        user_introduces: '我是一名软件工程师。\n在北京工作。\n喜欢编程和阅读技术书籍。'
      };

      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      await extractUserProfileTags(multilineDto);

      expect(callQwenAI).toHaveBeenCalledWith([
        { role: 'system', content: EXTRACT_USER_PROFILE_TAGS_PROMPT },
        { role: 'user', content: multilineDto.user_introduces }
      ]);
    });

    it('should handle empty user introduction', async () => {
      const emptyDto = {
        ...validDto,
        user_introduces: ''
      };

      mock.mock(callQwenAI).mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"tags": []}'
            }
          }
        ]
      });

      const result = await extractUserProfileTags(emptyDto);
      expect(result).toEqual({ tags: [] });
    });

    it('should handle whitespace-only user introduction', async () => {
      const whitespaceDto = {
        ...validDto,
        user_introduces: '   \n\t   '
      };

      mock.mock(callQwenAI).mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"tags": []}'
            }
          }
        ]
      });

      const result = await extractUserProfileTags(whitespaceDto);
      expect(result).toEqual({ tags: [] });
    });

    it('should pass correct prompt system message', async () => {
      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      await extractUserProfileTags(validDto);

      expect(callQwenAI).toHaveBeenCalledWith([
        { 
          role: 'system', 
          content: EXTRACT_USER_PROFILE_TAGS_PROMPT 
        },
        { 
          role: 'user', 
          content: validDto.user_introduces 
        }
      ]);
    });

    it('should log AI response content', async () => {
      mock.mock(callQwenAI).mockResolvedValue(mockAIResponse);

      await extractUserProfileTags(validDto);

      expect(logger.info).toHaveBeenCalledWith('大模型返回结果为: ', {
        content: '{"tags": ["软件工程师", "北京", "编程", "技术书籍", "阅读"]}'
      });
    });

    it('should handle null AI response', async () => {
      mock.mock(callQwenAI).mockResolvedValue(null);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });

    it('should handle malformed AI response structure', async () => {
      const malformedResponse = {
        choices: [
          {
            message: 'not an object'
          }
        ]
      };

      mock.mock(callQwenAI).mockResolvedValue(malformedResponse);

      await expect(extractUserProfileTags(validDto)).rejects.toThrow('大模型返回内容为空');
    });
  });
});