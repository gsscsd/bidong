import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// 确保日志目录存在
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 缓存解析结果以避免重复计算
const filenameCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

// 自定义格式：用于获取调用者文件信息（优化版）
const addFilename = winston.format((info: any) => {
  try {
    // 创建一个错误对象来获取堆栈信息
    const stack = new Error().stack;
    if (!stack) return info;
    
    // 生成一个简单的缓存键（基于堆栈的前几行）
    const cacheKey = stack.substring(0, 100);
    
    // 检查缓存
    if (filenameCache.has(cacheKey)) {
      info.filename = filenameCache.get(cacheKey);
      return info;
    }
    
    // 分割堆栈行
    const lines = stack.split('\n');
    // 寻找非 logger.ts 的第一行堆栈信息
    // 索引通常为 4 或 5，取决于调用深度。我们遍历寻找第一个不含 logger.ts 和 node_modules 的路径
    const callerLine = lines.find(line => 
      line && 
      !line.includes('logger.ts') && 
      !line.includes('node_modules') && 
      line.includes('at ')
    );

    if (callerLine) {
      // 正则匹配文件名
      // 匹配格式如： at /path/to/file.ts:10:5
      const match = callerLine.match(/\((.*):(\d+):(\d+)\)/) || callerLine.match(/at (.*):(\d+):(\d+)/);
      if (match && match[1] && match[2]) {
        const fullPath = match[1];
        const line = match[2];
        // 只保留文件名，不保留全路径（可选）
        const filename = `${path.basename(fullPath)}:${line}`;
        info.filename = filename;
        
        // 添加到缓存，限制缓存大小
        if (filenameCache.size < MAX_CACHE_SIZE) {
          filenameCache.set(cacheKey, filename);
        }
      }
    }
  } catch (error) {
    // 如果解析出错，静默失败，避免影响日志记录
    // 在生产环境中可以考虑记录这个错误
    // console.error('Logger filename extraction error:', error);
  }
  
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    addFilename(), // 应用自定义的获取文件名格式
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bidong-api' },
  // 使用循环日志处理，防止日志文件过大
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({ 
      filename: 'logs/info.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
  ],
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// 开发环境下控制台输出优化
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, filename, ...rest }: any) => {
        // 自定义控制台显示格式： [时间] [级别] [文件名]: 消息
        const scope = filename ? ` \x1b[36m[${filename}]\x1b[0m` : '';
        const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} ${level}${scope}: ${message}${meta}`;
      })
    )
  }));
}