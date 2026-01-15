import winston from 'winston';
import path from 'path';

// 自定义格式：用于获取调用者文件信息
const addFilename = winston.format((info) => {
  // 创建一个错误对象来获取堆栈信息
  const stack = new Error().stack;
  if (stack) {
    // 分割堆栈行
    const lines = stack.split('\n');
    // 寻找非 logger.ts 的第一行堆栈信息
    // 索引通常为 4 或 5，取决于调用深度。我们遍历寻找第一个不含 logger.ts 和 node_modules 的路径
    const callerLine = lines.find(line => 
      !line.includes('logger.ts') && 
      !line.includes('node_modules') && 
      line.includes('at ')
    );

    if (callerLine) {
      // 正则匹配文件名
      // 匹配格式如： at /path/to/file.ts:10:5
      const match = callerLine.match(/\((.*):(\d+):(\d+)\)/) || callerLine.match(/at (.*):(\d+):(\d+)/);
      if (match) {
        const fullPath = match[1];
        const line = match[2];
        // 只保留文件名，不保留全路径（可选）
        info.filename = `${path.basename(fullPath)}:${line}`;
      }
    }
  }
  return info;
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    addFilename(), // 应用自定义的获取文件名格式
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bidong-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/info.log' }),
  ],
});

// 开发环境下控制台输出优化
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, filename, ...rest }) => {
        // 自定义控制台显示格式： [时间] [级别] [文件名]: 消息
        const scope = filename ? ` \x1b[36m[${filename}]\x1b[0m` : '';
        const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} ${level}${scope}: ${message}${meta}`;
      })
    )
  }));
}