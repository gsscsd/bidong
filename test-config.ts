import { ConfigService } from './src/config/config';
import { logger } from './src/config/logger';

async function testConfig() {
  console.log('测试配置服务...');
  
  const config = ConfigService.getInstance();
  
  const apiKey = config.get<string>('apiKey');
  const baseUrl = config.get<string>('apiBaseUrl');
  
  console.log('API Key:', apiKey ? '已配置' : '未配置');
  console.log('Base URL:', baseUrl);
  
  logger.info('配置测试完成');
}

testConfig();