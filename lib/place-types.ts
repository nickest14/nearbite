import {
  Beef,
  Beer,
  Cake,
  Coffee,
  Croissant,
  EggFried,
  Fish,
  Hamburger,
  IceCreamCone,
  Leaf,
  Pizza,
  Sandwich,
  Soup,
  Sun,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";

export { SEARCH_TYPES } from "@/lib/google/config";

// Google Places 類型 → 繁體中文名稱與圖示。對照表只放七個搜尋類型加常見料理類型，
// 查不到的回「餐飲」；料理篩選的 change 會擴充這張表（design D10）。
type PlaceTypeEntry = {
  label: string;
  icon: LucideIcon;
};

const PLACE_TYPE_TABLE: Readonly<Record<string, PlaceTypeEntry>> = {
  // 七個搜尋類型
  restaurant: { label: "餐廳", icon: Utensils },
  cafe: { label: "咖啡廳", icon: Coffee },
  coffee_shop: { label: "咖啡廳", icon: Coffee },
  bakery: { label: "麵包店", icon: Croissant },
  dessert_shop: { label: "甜點", icon: Cake },
  ice_cream_shop: { label: "冰品", icon: IceCreamCone },
  bar: { label: "酒吧", icon: Beer },
  // 常見料理類型（primaryType 通常比 restaurant 更具體）
  ramen_restaurant: { label: "拉麵", icon: Soup },
  japanese_restaurant: { label: "日式料理", icon: Fish },
  sushi_restaurant: { label: "壽司", icon: Fish },
  chinese_restaurant: { label: "中式料理", icon: Utensils },
  italian_restaurant: { label: "義式料理", icon: Pizza },
  pizza_restaurant: { label: "披薩", icon: Pizza },
  hamburger_restaurant: { label: "漢堡", icon: Hamburger },
  american_restaurant: { label: "美式料理", icon: Hamburger },
  korean_restaurant: { label: "韓式料理", icon: Utensils },
  thai_restaurant: { label: "泰式料理", icon: Utensils },
  vietnamese_restaurant: { label: "越式料理", icon: Soup },
  indian_restaurant: { label: "印度料理", icon: Utensils },
  vegetarian_restaurant: { label: "素食", icon: Leaf },
  vegan_restaurant: { label: "素食", icon: Leaf },
  steak_house: { label: "牛排", icon: Beef },
  barbecue_restaurant: { label: "燒烤", icon: Beef },
  seafood_restaurant: { label: "海鮮", icon: Fish },
  breakfast_restaurant: { label: "早餐", icon: EggFried },
  brunch_restaurant: { label: "早午餐", icon: Sun },
  fast_food_restaurant: { label: "速食", icon: Hamburger },
  sandwich_shop: { label: "三明治", icon: Sandwich },
  noodle_shop: { label: "麵食", icon: Soup },
  dumpling_restaurant: { label: "餃子", icon: Soup },
  hot_pot_restaurant: { label: "火鍋", icon: Soup },
  tea_house: { label: "茶館", icon: Coffee },
  wine_bar: { label: "酒吧", icon: Wine },
  pub: { label: "酒吧", icon: Beer },
  bar_and_grill: { label: "酒吧", icon: Beer },
  diner: { label: "小餐館", icon: Utensils },
  food_court: { label: "美食街", icon: Utensils },
  meal_takeaway: { label: "外帶", icon: Utensils },
};

const FALLBACK: PlaceTypeEntry = { label: "餐飲", icon: Utensils };

// 先查 primaryType，查不到再依序查 types，都查不到就回預設
function resolve(primaryType: string | null | undefined, types: readonly string[]): PlaceTypeEntry {
  if (primaryType) {
    const entry = PLACE_TYPE_TABLE[primaryType];
    if (entry) return entry;
  }
  for (const type of types) {
    const entry = PLACE_TYPE_TABLE[type];
    if (entry) return entry;
  }
  return FALLBACK;
}

export function typeLabel(
  primaryType: string | null | undefined,
  types: readonly string[] = [],
): string {
  return resolve(primaryType, types).label;
}

export function typeIcon(
  primaryType: string | null | undefined,
  types: readonly string[] = [],
): LucideIcon {
  return resolve(primaryType, types).icon;
}
