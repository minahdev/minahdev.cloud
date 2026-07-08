# 음식 칼로리 데이터

| 파일 | 설명 |
|------|------|
| `mafra-calorie-foods.json` | 농림수산식품교육문화정보원 칼로리 CSV에서 생성 (625종) |

CSV를 다시 반영할 때 (저장소 루트):

```bash
python scripts/build_mafra_food_json.py "경로/농림수산식품교육문화정보원_칼로리 정보_20190926.csv"
```
