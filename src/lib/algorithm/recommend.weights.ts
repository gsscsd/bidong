// 推荐算法权重配置

export const RecommendWeights = {
  // --- 基础权重 (总和为 1.0) ---

  // 向量相似度权重 (最重要的因素)
  vectorSimilarity: 0.35,

  // 标签匹配度权重
  tagMatching: {
    total: 0.25,
    // 自身标签与对方理想型重合度
    selfToTarget: 0.15,
    // 理想型标签与对方自身重合度
    targetToSelf: 0.10,
  },

  // 城市匹配度权重
  cityMatching: {
    total: 0.15,
    // 同城: 1.0, 同省份: 0.7, 不同省份: 0.3
    sameCity: 1.0,
    sameProvince: 0.7,
    differentProvince: 0.3,
  },

  // 年龄差权重
  ageDifference: {
    total: 0.10,
    // 差 0-1 岁: 1.0, 差 2 岁: 0.7, 差 3 岁: 0.4
    diff0to1: 1.0,
    diff2: 0.7,
    diff3: 0.4,
  },

  // 身高匹配权重
  heightMatching: {
    total: 0.08,
    // 在理想型范围内: 1.0, 超出 1-3cm: 0.6, 超出 3-5cm: 0.3, 超出 5cm: 0
    inRange: 1.0,
    exceed1to3: 0.6,
    exceed3to5: 0.3,
    exceedMore: 0,
  },

  // 教育程度权重
  educationMatching: {
    total: 0.05,
    // 教育程度差值越小，分数越高
    diff0: 1.0,
    diff1: 0.8,
    diff2: 0.5,
    diff3: 0.2,
    diffMore: 0,
  },

  // 职业/收入权重 (辅助因素)
  occupationIncome: {
    total: 0.02,
    match: 1.0,
    partial: 0.5,
    noMatch: 0,
  },

  // --- 双向匹配优先级 ---
  // 心动回推（最近3天内喜欢过我但未处理的用户）额外加分
  priorityBonus: 0.5,

  // --- 硬性过滤条件 ---

  // 年龄差硬性限制
  ageFilter: {
    maxDiff: 3, // 最大 ±3 岁
  },

  // 向量化召回配置
  vectorRecall: {
    candidateCount: 100, // 召回候选数量
  },

  // 标签召回配置
  tagRecall: {
    candidateCount: 100, 
  },

  // 最终推荐配置
  finalRecommendation: {
    defaultCount: 20, // 默认推荐数量
    vipCount: 30, // VIP 用户推荐数量
  },
} as const;

// 省份列表（用于判断是否同省）
export const PROVINCES = [
  '北京', '上海', '天津', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆',
  '香港', '澳门',
];

// 获取城市所属省份
export function getProvinceFromCity(city: string): string {
  if (!city) return '';

  // 直辖市
  const municipalities = ['北京', '上海', '天津', '重庆'];
  for (const m of municipalities) {
    if (city.includes(m)) return m;
  }

  // 自治区
  if (city.includes('内蒙古')) return '内蒙古';
  if (city.includes('广西')) return '广西';
  if (city.includes('西藏')) return '西藏';
  if (city.includes('宁夏')) return '宁夏';
  if (city.includes('新疆')) return '新疆';

  // 其他省份
  for (const province of PROVINCES) {
    if (city.includes(province)) return province;
  }

  return '';
}

// 判断两个城市是否同城
export function isSameCity(city1: string, city2: string): boolean {
  if (!city1 || !city2) return false;
  return city1.trim() === city2.trim();
}

// 判断两个城市是否同省
export function isSameProvince(city1: string, city2: string): boolean {
  const province1 = getProvinceFromCity(city1);
  const province2 = getProvinceFromCity(city2);
  return province1 !== '' && province1 === province2;
}

// 计算城市匹配分数
export function calculateCityScore(city1: string, city2: string): number {
  if (!city1 || !city2) return RecommendWeights.cityMatching.differentProvince;

  if (isSameCity(city1, city2)) {
    return RecommendWeights.cityMatching.sameCity;
  } else if (isSameProvince(city1, city2)) {
    return RecommendWeights.cityMatching.sameProvince;
  } else {
    return RecommendWeights.cityMatching.differentProvince;
  }
}

// 计算年龄差分数
export function calculateAgeScore(ageDiff: number): number {
  const diff = Math.abs(ageDiff);
  if (diff <= 1) return RecommendWeights.ageDifference.diff0to1;
  if (diff === 2) return RecommendWeights.ageDifference.diff2;
  if (diff === 3) return RecommendWeights.ageDifference.diff3;
  return 0;
}

// 计算身高匹配分数
export function calculateHeightScore(userHeight: number, targetHeight: number, userPreferredHeightMin: number, userPreferredHeightMax: number): number {
  if (!userHeight || !targetHeight) return 0;

  // 检查是否在理想型范围内
  if (targetHeight >= userPreferredHeightMin && targetHeight <= userPreferredHeightMax) {
    return RecommendWeights.heightMatching.inRange;
  }

  const diff = Math.abs(targetHeight - userPreferredHeightMin);
  if (diff <= 3) return RecommendWeights.heightMatching.exceed1to3;
  if (diff <= 5) return RecommendWeights.heightMatching.exceed3to5;
  return RecommendWeights.heightMatching.exceedMore;
}

// 计算教育程度分数
export function calculateEducationScore(edu1: number, edu2: number): number {
  if (!edu1 || !edu2) return 0;
  const diff = Math.abs(edu1 - edu2);

  if (diff === 0) return RecommendWeights.educationMatching.diff0;
  if (diff === 1) return RecommendWeights.educationMatching.diff1;
  if (diff === 2) return RecommendWeights.educationMatching.diff2;
  if (diff === 3) return RecommendWeights.educationMatching.diff3;
  return RecommendWeights.educationMatching.diffMore;
}
