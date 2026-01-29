/**
 * 测试 v3 接口：抽取用户标签并存储完整信息
 * 
 * 运行方式：
 * bun run test-v3-api.js
 */

const API_BASE_URL = 'http://localhost:3999/v3';

/**
 * 测试用例1：完整用户信息
 */
async function testCompleteUserProfile() {
  console.log('\n========== 测试用例1：完整用户信息 ==========');
  
  const payload = {
    user_uuid: 'user_1234567890_complete',
    user_introduces: '我是95后，在北京做程序员，年薪50w左右。身高175cm，本科学历，未婚。平时比较宅，喜欢打游戏和撸猫。',
    gender: 1, // 1-男，2-女
    age: 28,
    height: 175,
    current_city: '北京',
    marital_status: 1, // 假设1表示未婚
    education: 4, // 假设4表示本科
    occupation: '程序员',
    annual_income: '50w左右'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/extractUserProfileTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

/**
 * 测试用例2：部分用户信息（部分字段缺失）
 */
async function testPartialUserProfile() {
  console.log('\n========== 测试用例2：部分用户信息 ==========');
  
  const payload = {
    user_uuid: 'user_9876543210_partial',
    user_introduces: '来自上海，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿。',
    // 只提供部分字段，其他字段缺失
    gender: 1,
    age: 25,
    current_city: '上海'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/extractUserProfileTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

/**
 * 测试用例3：只有用户描述和UUID（最小可用字段）
 */
async function testMinimalUserProfile() {
  console.log('\n========== 测试用例3：最小可用字段 ==========');
  
  const payload = {
    user_uuid: 'user_1111111111_minimal',
    user_introduces: '我在杭州做金融，平时爱看电影，希望找一个同样在上海、性格温柔、有共同语言的女生。'
    // 其他字段全部缺失
  };

  try {
    const response = await fetch(`${API_BASE_URL}/extractUserProfileTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

/**
 * 测试用例4：参数校验失败（缺少必填字段）
 */
async function testValidationFailed() {
  console.log('\n========== 测试用例4：参数校验失败 ==========');
  
  const payload = {
    // 缺少必填字段 user_uuid 和 user_introduces
    gender: 1,
    age: 28
  };

  try {
    const response = await fetch(`${API_BASE_URL}/extractUserProfileTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

/**
 * 测试用例5：字段值超出范围（测试Zod校验）
 */
async function testFieldOutOfRange() {
  console.log('\n========== 测试用例5：字段值超出范围 ==========');
  
  const payload = {
    user_uuid: 'user_0000000000_invalid',
    user_introduces: '测试用户',
    gender: 3, // 无效值，只能是1或2
    age: 150, // 超出范围，应该在1-120之间
    height: 300 // 超出范围，应该在100-250之间
  };

  try {
    const response = await fetch(`${API_BASE_URL}/extractUserProfileTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('========================================');
  console.log('开始测试 v3 接口：抽取用户标签并存储完整信息');
  console.log('========================================');

  try {
    // 测试完整用户信息
    await testCompleteUserProfile();

    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试部分用户信息
    await testPartialUserProfile();

    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试最小可用字段
    await testMinimalUserProfile();

    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试参数校验失败
    await testValidationFailed();

    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试字段值超出范围
    await testFieldOutOfRange();

    console.log('\n========================================');
    console.log('所有测试用例执行完毕！');
    console.log('========================================');
  } catch (error) {
    console.error('\n测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
