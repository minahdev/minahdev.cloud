"""농림수산식품교육문화정보원 칼로리 CSV → frontend/data/mafra-calorie-foods.json

Usage (repo root):
  python scripts/build_mafra_food_json.py "C:/Users/hi/Downloads/농림수산식품교육문화정보원_칼로리 정보_20190926.csv"
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "data" / "mafra-calorie-foods.json"


def _float(val: str) -> float:
    val = (val or "").strip()
    if not val:
        return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0


def _food_id(name: str) -> str:
    digest = hashlib.md5(name.encode("utf-8")).hexdigest()[:12]
    return f"mafra-{digest}"


def _estimate_serving_g(carbs: float, protein: float, fat: float) -> float:
    total = carbs + protein + fat
    if total >= 10:
        return max(total, 30.0)
    return 100.0


def _category(name: str) -> str:
    if any(k in name for k in ("밥", "면", "빵", "국수", "떡", "죽")):
        return "밥/면/빵"
    if any(k in name for k in ("닭", "돼지", "소", "고기", "생선", "오징어", "새우", "계란", "달걀")):
        return "고기/생선/달걀"
    if any(k in name for k in ("우유", "치즈", "요거트", "유제")):
        return "유제품"
    if any(k in name for k in ("사과", "바나나", "포도", "과일", "귤", "배")):
        return "과일"
    if any(k in name for k in ("상추", "배추", "나물", "채소", "시금치", "양파")):
        return "채소"
    if any(k in name for k in ("커피", "주스", "음료", "콜라", "차")):
        return "간식/음료"
    return "기타"


def convert_row(cells: list[str]) -> dict | None:
    if len(cells) < 2:
        return None
    name = cells[0].strip()
    if not name:
        return None
    kcal_serving = _float(cells[1])
    if kcal_serving <= 0:
        return None
    carbs = _float(cells[2]) if len(cells) > 2 else 0.0
    protein = _float(cells[3]) if len(cells) > 3 else 0.0
    fat = _float(cells[4]) if len(cells) > 4 else 0.0
    serving_g = _estimate_serving_g(carbs, protein, fat)
    kcal_per_100g = max(1, round(kcal_serving * 100 / serving_g))
    return {
        "id": _food_id(name),
        "name": name,
        "category": _category(name),
        "kcalPer100g": kcal_per_100g,
        "defaultServingG": int(round(serving_g)),
        "kcalPerServing": round(kcal_serving),
        "servingNutrition": {
            "carbsG": carbs,
            "proteinG": protein,
            "fatG": fat,
        },
    }


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if src is None or not src.is_file():
        print("Usage: python scripts/build_mafra_food_json.py <path-to.csv>", file=sys.stderr)
        sys.exit(1)

    foods: list[dict] = []
    seen_names: set[str] = set()
    with src.open(encoding="cp949", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            item = convert_row(row)
            if item is None:
                continue
            if item["name"] in seen_names:
                continue
            seen_names.add(item["name"])
            foods.append(item)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(foods, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Wrote {len(foods)} foods → {OUT}")


if __name__ == "__main__":
    main()
