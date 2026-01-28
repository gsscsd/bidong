// 测试用户资料标签提取接口
// 使用 node test-api.js 来运行

const testData = {
    // 完整用户资料测试
    fullProfile: {
        user_id: "test-user-001",
        user_introduces: "我是95后程序员，在上海工作，身高180cm，本科毕业，目前单身，喜欢运动和旅行。希望找到一个性格温柔、有共同语言的女生。",
        user_sex: "男",
        user_age: 28,
        height: 180,
        education: 5, // 本科
        current_city: "上海",
        marital_status: 1, // 单身
        occupation: "程序员",
        annual_income: "30-50万"
    },
    
    // 最小信息测试（容错测试）
    minimalProfile: {
        user_id: "test-user-002", 
        user_introduces: "喜欢运动和音乐",
        user_sex: "女",
        user_age: 25
        // 其他字段都为空
    },
    
    // 纯文本介绍测试
    textOnly: {
        user_introduces: "来自北京，从事金融行业，热爱生活，希望找到靠谱的另一半。"
    }
};

console.log('=== 测试数据示例 ===');
console.log('\n1. 完整用户资料:');
console.log(JSON.stringify(testData.fullProfile, null, 2));

console.log('\n2. 最小信息测试（容错）:');
console.log(JSON.stringify(testData.minimalProfile, null, 2));

console.log('\n3. 纯文本介绍:');
console.log(JSON.stringify(testData.textOnly, null, 2));

console.log('\n=== API调用示例 ===');
console.log('\n1. POST /api/v2/extract/extractUserProfileTags');
console.log('请求体:', JSON.stringify(testData.fullProfile, null, 2));

console.log('\n2. POST /api/v2/extract/extractUserInfoTags'); 
console.log('请求体:', JSON.stringify(testData.textOnly, null, 2));

console.log('\n=== 预期功能 ===');
console.log('1. Zod字段校验 - 验证必填字段和数据类型');
console.log('2. 大模型标签提取 - 从介绍中提取self_tags和preference_tags');
console.log('3. 数据库持久化 - 将用户资料存储到recommendUserProfiles表');
console.log('4. 标签快照存储 - AI返回的标签数据存储到tagsSnapshot字段');
console.log('5. 容错处理 - 字段缺失时不会报错，保证核心功能正常');