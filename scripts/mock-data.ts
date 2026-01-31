/**
 * Mock 数据生成脚本
 * 用于生成测试数据：用户画像、用户行为、黑名单、用户设置等
 */

import { db } from '../src/db';
import {
  recommendUserProfiles,
  userActions,
  userBlacklist,
  userSettings,
  tagDefinitions,
  actionTypeEnum
} from '../src/db/schema';

// 配置
const MOCK_USER_COUNT = 100;
const MOCK_TAG_COUNT = 30;
const MOCK_ACTION_DAYS = 30;

// 城市列表
const CITIES = [
  '北京市', '上海市', '天津市', '重庆市',
  '广州市', '深圳市', '杭州市', '成都市',
  '南京市', '武汉市', '西安市', '苏州市',
  '长沙市', '沈阳市', '青岛市', '郑州市',
];

// 职业列表
const OCCUPATIONS = [
  '软件工程师', '产品经理', '设计师', '教师', '医生',
  '律师', '会计', '销售', '市场专员', '人力资源',
  '公务员', '创业者', '建筑师', '记者', '摄影师',
];

// 标签列表
const TAG_NAMES = [
  '热爱运动', '喜欢旅游', '美食爱好者', '音乐发烧友', '电影迷',
  '喜欢阅读', '宠物控', '摄影爱好者', '游戏达人', '宅男宅女',
  '性格开朗', '温柔体贴', '幽默风趣', '细心体贴', '成熟稳重',
  '积极乐观', '文艺青年', '时尚达人', '健身达人', '户外探险',
  '喜欢烹饪', '手工艺人', '科技发烧友', '音乐创作', '写作达人',
];

// 随机数工具
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 生成用户 UUID
function generateUserUuid(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 生成标签定义
async function generateTagDefinitions() {
  console.log('[Mock Data] 生成标签定义...');

  const tags = [];
  for (let i = 0; i < MOCK_TAG_COUNT; i++) {
    const level = randomInt(1, 3);
    const parentId = level > 1 ? randomInt(1, i) : null;

    tags.push({
      name: TAG_NAMES[i % TAG_NAMES.length],
      level,
      parentId,
      category: level === 1 ? 'root' : level === 2 ? 'category' : 'tag',
    });
  }

  await db.insert(tagDefinitions).values(tags);
  console.log(`[Mock Data] 已生成 ${tags.length} 个标签`);
}

// 生成随机 embedding (1024 维)
function generateRandomEmbedding(): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 1024; i++) {
    embedding.push(Math.random() * 2 - 1); // -1 到 1 之间的随机数
  }
  return embedding;
}

// 生成用户画像
async function generateUserProfiles() {
  console.log('[Mock Data] 生成用户画像...');

  const profiles = [];
  for (let i = 0; i < MOCK_USER_COUNT; i++) {
    const gender = randomInt(1, 2); // 1-男, 2-女
    const age = randomInt(22, 45);
    const height = gender === 1 ? randomInt(165, 190) : randomInt(155, 175);

    const tagCount = randomInt(3, 8);
    const allTagIds = Array.from({ length: MOCK_TAG_COUNT }, (_, i) => i + 1);
    const selectedTags = randomItems(allTagIds, tagCount);

    profiles.push({
      userUuid: generateUserUuid(),
      gender,
      age,
      height,
      currentCity: randomItem(CITIES),
      maritalStatus: randomInt(0, 2), // 0-未婚, 1-离异, 2-丧偶
      education: randomInt(1, 6), // 1-高中, 2-大专, 3-本科, 4-硕士, 5-博士, 6-其他
      occupation: randomItem(OCCUPATIONS),
      annualIncome: ['10-20万', '20-30万', '30-50万', '50万以上'][randomInt(0, 3)],
      targetGender: gender === 1 ? 2 : 1, // 理想型性别相反
      embedding: generateRandomEmbedding(),
      tagIds: selectedTags,
      l1TagIds: selectedTags.slice(0, Math.floor(selectedTags.length / 3)),
      l2TagIds: selectedTags.slice(Math.floor(selectedTags.length / 3), Math.floor(selectedTags.length * 2 / 3)),
      l3TagIds: selectedTags.slice(Math.floor(selectedTags.length * 2 / 3)),
      tagsSnapshot: {},
    });
  }

  await db.insert(recommendUserProfiles).values(profiles);
  console.log(`[Mock Data] 已生成 ${profiles.length} 个用户画像`);

  return profiles;
}

// 生成用户设置
async function generateUserSettings(userUuids: string[]) {
  console.log('[Mock Data] 生成用户设置...');

  const settings = [];
  for (const userUuid of userUuids) {
    const isVip = Math.random() > 0.8; // 20% 概率是 VIP
    const gender = randomInt(1, 2);

    settings.push({
      userUuid,
      recommendCount: isVip ? 30 : 20,
      targetGender: gender === 1 ? 2 : 1,
      preferredAgeMin: randomInt(20, 30),
      preferredAgeMax: randomInt(35, 45),
      preferredHeightMin: randomInt(150, 170),
      preferredHeightMax: randomInt(180, 200),
      preferredCities: randomItems(CITIES, randomInt(0, 3)),
    });
  }

  await db.insert(userSettings).values(settings);
  console.log(`[Mock Data] 已生成 ${settings.length} 个用户设置`);
}

// 生成用户行为
async function generateUserActions(userUuids: string[]) {
  console.log('[Mock Data] 生成用户行为...');

  const actionTypes = ['like', 'dislike', 'match', 'unmatch'];
  const actions = [];

  for (const fromUserId of userUuids) {
    // 每个用户生成 5-15 个行为
    const actionCount = randomInt(5, 15);

    for (let i = 0; i < actionCount; i++) {
      const toUserId = randomItem(userUuids);
      if (fromUserId === toUserId) continue; // 不能对自己操作

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - randomInt(0, MOCK_ACTION_DAYS));

      actions.push({
        fromUserId,
        toUserId,
        actionType: randomItem(actionTypes),
        createdAt,
      });
    }
  }

  await db.insert(userActions).values(actions);
  console.log(`[Mock Data] 已生成 ${actions.length} 个用户行为`);
}

// 生成黑名单
async function generateBlacklist(userUuids: string[]) {
  console.log('[Mock Data] 生成黑名单...');

  const blacklist = [];
  const blacklistCount = Math.floor(userUuids.length * 0.3); // 30% 的用户有黑名单

  for (let i = 0; i < blacklistCount; i++) {
    const userId = userUuids[i];
    const targetCount = randomInt(1, 3);

    for (let j = 0; j < targetCount; j++) {
      const targetId = randomItem(userUuids);
      if (userId === targetId) continue;

      blacklist.push({
        userId,
        targetId,
      });
    }
  }

  await db.insert(userBlacklist).values(blacklist);
  console.log(`[Mock Data] 已生成 ${blacklist.length} 个黑名单记录`);
}

// 主函数
async function main() {
  console.log('[Mock Data] 开始生成 Mock 数据...\n');

  try {
    // 1. 生成标签定义
    await generateTagDefinitions();

    // 2. 生成用户画像
    const profiles = await generateUserProfiles();
    const userUuids = profiles.map(p => p.userUuid);

    // 3. 生成用户设置
    await generateUserSettings(userUuids);

    // 4. 生成用户行为
    await generateUserActions(userUuids);

    // 5. 生成黑名单
    await generateBlacklist(userUuids);

    console.log('\n[Mock Data] ✅ 所有 Mock 数据生成完成！');
    console.log(`[Mock Data] 用户总数: ${MOCK_USER_COUNT}`);
    console.log(`[Mock Data] 标签总数: ${MOCK_TAG_COUNT}`);
    process.exit(0); // 显式退出，强制关闭连接池
  } catch (error) {
    console.error('[Mock Data] ❌ 生成 Mock 数据失败:', error);
    process.exit(1);
  }
}

// 运行
main();
