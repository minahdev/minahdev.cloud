import mafraFoodsJson from "@/data/mafra-calorie-foods.json"

export type FoodCategory =
  | "밥/면/빵"
  | "고기/생선/달걀"
  | "유제품"
  | "과일"
  | "채소"
  | "간식/음료"
  | "기타"

export type ServingNutrition = {
  carbsG: number
  proteinG: number
  fatG: number
}

export type FoodRecord = {
  id: string
  name: string
  category: FoodCategory
  kcalPer100g: number
  defaultServingG: number
  /** 농림부 CSV 1인분 칼로리 (있으면 defaultServingG = 1인분 추정 중량) */
  kcalPerServing?: number
  servingNutrition?: ServingNutrition
  aliases?: string[]
}

type MafraFoodJson = FoodRecord

export const MAFRA_FOOD_DATASET: FoodRecord[] = mafraFoodsJson as MafraFoodJson[]

export const FOOD_DATASET: FoodRecord[] = [
  {
    id: "rice-cooked",
    name: "밥(흰쌀, 공기밥)",
    category: "밥/면/빵",
    kcalPer100g: 130,
    defaultServingG: 210,
    aliases: ["공기밥", "흰밥", "쌀밥"],
  },
  {
    id: "ramen-instant",
    name: "라면(조리 후)",
    category: "밥/면/빵",
    kcalPer100g: 90,
    defaultServingG: 550,
    aliases: ["라면", "인스턴트 라면"],
  },
  {
    id: "bread-white",
    name: "식빵",
    category: "밥/면/빵",
    kcalPer100g: 265,
    defaultServingG: 60,
    aliases: ["빵", "토스트"],
  },
  {
    id: "chicken-breast",
    name: "닭가슴살(구운/삶은)",
    category: "고기/생선/달걀",
    kcalPer100g: 165,
    defaultServingG: 120,
    aliases: ["닭가슴살"],
  },
  {
    id: "egg",
    name: "달걀(계란)",
    category: "고기/생선/달걀",
    kcalPer100g: 143,
    defaultServingG: 50,
    aliases: ["계란", "달걀"],
  },
  {
    id: "salmon",
    name: "연어",
    category: "고기/생선/달걀",
    kcalPer100g: 208,
    defaultServingG: 120,
    aliases: ["연어", "훈제연어"],
  },
  {
    id: "milk",
    name: "우유(일반)",
    category: "유제품",
    kcalPer100g: 64,
    defaultServingG: 200,
    aliases: ["우유", "milk"],
  },
  {
    id: "yogurt-plain",
    name: "요거트(플레인)",
    category: "유제품",
    kcalPer100g: 60,
    defaultServingG: 150,
    aliases: ["요거트", "요구르트", "플레인 요거트"],
  },
  {
    id: "banana",
    name: "바나나",
    category: "과일",
    kcalPer100g: 89,
    defaultServingG: 120,
    aliases: ["바나나"],
  },
  {
    id: "apple",
    name: "사과",
    category: "과일",
    kcalPer100g: 52,
    defaultServingG: 180,
    aliases: ["사과"],
  },
  {
    id: "sweet-potato",
    name: "고구마(찐)",
    category: "기타",
    kcalPer100g: 86,
    defaultServingG: 150,
    aliases: ["고구마"],
  },
  {
    id: "salad",
    name: "샐러드(채소 위주)",
    category: "채소",
    kcalPer100g: 25,
    defaultServingG: 200,
    aliases: ["샐러드", "샐러드볼"],
  },
  {
    id: "americano",
    name: "아메리카노(무가당)",
    category: "간식/음료",
    kcalPer100g: 1,
    defaultServingG: 350,
    aliases: ["아아", "아메리카노"],
  },
  {
    id: "protein-bar",
    name: "프로틴바",
    category: "간식/음료",
    kcalPer100g: 390,
    defaultServingG: 55,
    aliases: ["단백질바", "프로틴 바"],
  },
  {
    id: "cola",
    name: "콜라",
    category: "간식/음료",
    kcalPer100g: 42,
    defaultServingG: 250,
    aliases: ["탄산", "콜라", "coke"],
  },
]

export function normalizeQuery(q: string) {
  return q.trim().toLowerCase()
}

export function matchesFood(food: FoodRecord, q: string): boolean {
  const query = normalizeQuery(q)
  if (!query) return true
  const hay = [food.name, food.category, ...(food.aliases ?? [])].join(" ").toLowerCase()
  return hay.includes(query)
}

export function foodKcalLabel(food: Pick<FoodRecord, "kcalPer100g" | "kcalPerServing" | "defaultServingG">): string {
  if (food.kcalPerServing != null) {
    return `1인분 ${food.kcalPerServing.toLocaleString()} kcal (약 ${food.defaultServingG}g)`
  }
  return `${food.kcalPer100g} kcal/100g`
}

