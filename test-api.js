// 测试API的简单脚本
const testPayload = {
  user_id: "6cef471f-5e2c-4c5a-97a1-d0083062348d",
  user_introduces: "来自济南，喜欢打篮球，职业是外卖员，喜欢的对象是肤白貌美大长腿",
  user_sex: "男",
  user_age: 26
};

console.log('测试数据:', JSON.stringify(testPayload, null, 2));
console.log('\n启动服务器后，可以使用以下curl命令测试:');
console.log(`curl -X POST http://localhost:3000/api/user-profile/extract-tags \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '${JSON.stringify(testPayload)}'`);