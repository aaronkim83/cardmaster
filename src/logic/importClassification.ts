import type { Category } from '../db/types';

interface CategoryRule {
  category: string;
  keywords: string[];
}

const RULES: CategoryRule[] = [
  { category: '마트', keywords: ['이마트', '홈플러스', '롯데마트', '트레이더스', '코스트코', '마트'] },
  { category: '배달', keywords: ['배달의민족', '배민', '요기요', '쿠팡이츠', '배달'] },
  { category: '카페', keywords: ['스타벅스', '투썸', '이디야', '메가커피', '컴포즈', '빽다방', '커피', '카페'] },
  { category: '간식', keywords: ['파리바게뜨', '뚜레쥬르', '베이커리', '도넛', '아이스크림'] },
  { category: '외식', keywords: ['식당', '음식점', '치킨', '피자', '버거', '김밥', '분식', '한우', '고기', '초밥', '짬뽕', '중식', '일식', '양식'] },
  { category: '주유', keywords: ['주유소', 'gs칼텍스', 's-oil', '에스오일', 'sk에너지', '현대오일', '오일뱅크'] },
  { category: '택시', keywords: ['택시', '카카오택시', '티머니택시'] },
  { category: '대중교통', keywords: ['교통', '버스', '지하철', '티머니', '캐시비', '코레일'] },
  { category: '온라인몰', keywords: ['쿠팡', '네이버파이낸셜', '네이버페이', '11번가', 'g마켓', '옥션', 'ssg', '마켓컬리', '컬리'] },
  { category: '의류', keywords: ['무신사', '유니클로', '자라', '의류', '패션'] },
  { category: '뷰티', keywords: ['올리브영', '랄라블라', '화장품', '뷰티'] },
  { category: '생활용품', keywords: ['다이소', '문구', '생활용품'] },
  { category: '의료', keywords: ['약국', '병원', '의원', '치과', '의료'] },
  { category: '통신', keywords: ['skt', 'kt', 'lg유플러스', '통신비', '통신'] },
  { category: '영화/공연', keywords: ['cgv', '롯데시네마', '메가박스', '영화', '공연'] },
  { category: '여행', keywords: ['호텔', '숙박', '항공', '대한항공', '아시아나', '여행'] },
  { category: '취미', keywords: ['넷플릭스', '유튜브', '멜론', '구글', '애플', '게임'] },
  { category: '관리비', keywords: ['관리비', '아파트'] },
  { category: '전기/가스', keywords: ['한국전력', '전기', '가스'] },
  { category: '세금', keywords: ['국세', '지방세', '세금', '관세'] },
];

export interface CategorySuggestion {
  categoryId: string;
  name: string;
  icon: string;
}

export function suggestExpenseCategory(categories: Category[], merchant: string): CategorySuggestion | undefined {
  const normalized = normalizeMerchant(merchant);
  if (!normalized) return undefined;

  for (const rule of RULES) {
    if (!rule.keywords.some((keyword) => normalized.includes(normalizeMerchant(keyword)))) continue;
    const category = findExpenseCategory(categories, rule.category);
    if (category) return toSuggestion(category);
  }

  const byName = categories
    .filter((category) => category.type === 'expense')
    .find((category) => normalized.includes(normalizeMerchant(category.name)));
  return byName ? toSuggestion(byName) : undefined;
}

function findExpenseCategory(categories: Category[], name: string): Category | undefined {
  return categories.find((category) => category.type === 'expense' && category.name === name);
}

function toSuggestion(category: Category): CategorySuggestion {
  return { categoryId: category.id, name: category.name, icon: category.icon };
}

function normalizeMerchant(value: string): string {
  return value.replace(/\s/g, '').toLowerCase();
}
