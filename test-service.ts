import { ExtractUserProfileTagsService } from '../src/services/extractUserProfileTagsService';
import { ConfigService } from '../src/config/config';

async function testService() {
  try {
    console.log('开始测试服务...');
    
    // 加载环境变量
    await import('dotenv').then(dotenv => dotenv.config());
    
    const service = new ExtractUserProfileTagsService();
    
    const testData = {
      user_id: "6cef471f-5e2c-4c5a-97a1-d0083062348d",
      user_introduces: "来自济南，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿",
      user_sex: "男" as const,
      user_age: 26
    };
    
    console.log('测试数据:', testData);
    
    const result = await service.extractUserProfileTags(testData);
    
    console.log('测试结果:', result);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testService();