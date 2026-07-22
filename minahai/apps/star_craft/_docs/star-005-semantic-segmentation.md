


클스# 시멘틱 분할 에이전트 — PSPNet 대체 · QLoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — PSPNet → 현대 분할기

| | PSPNet (원서) | 추천 대체 |
|---|---|---|
| 백본 | ResNet + PPM | 계층적 Transformer(SegFormer) |
| 효율 | 무거움 | SegFormer-B0 3.7M로 경량·정확 |
| 프롬프트 분할 | 불가 | **SAM2**로 점/박스 클릭 분할 zero-shot |
| 8GB 학습 | 빡빡 | SegFormer-B0/B2 LoRA 여유 |

두 축으로 나눈다: **고정 클래스 분할 = SegFormer**(학습), **임의 객체 분할 = SAM2**(프롬프트 zero-shot).

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 id | 파라미터 | 학습 VRAM | 용도 |
|---|---|---|---|
| `nvidia/segformer-b0-finetuned-ade-512-512` | 3.7M | ~4GB (LoRA, 512², batch 4) | 커스텀 클래스 분할 기본 |
| `nvidia/segformer-b2-finetuned-ade-512-512` | 27M | ~7GB | 정확도 우선 |
| `facebook/sam2-hiera-small` | — | 추론 ~4GB | 점/박스 프롬프트 zero-shot 마스크 |

- 기본 `SEG_MODEL=nvidia/segformer-b0-finetuned-ade-512-512`.
- SAM2는 "이 지점 물체만 떼줘" 류 대화형 분할 툴로 병설.

---

## 3. 산출물 트리

```
semantic-segmenter/
├─ engine/
│  ├─ infer.py            # SegFormer warm 추론 → 마스크 요약
│  ├─ train.py            # SegFormer LoRA 파인튜닝
│  └─ prompt.py           # SAM2 프롬프트 분할(선택)
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/semantic-segmenter/SKILL.md
├─ .claude/agents/semantic-segmenter.md
├─ dataset/  (images/ masks/)
├─ artifacts/lora/  id2label.json
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, json, torch, numpy as np
from PIL import Image
from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

MODEL = os.environ.get("SEG_MODEL", "nvidia/segformer-b0-finetuned-ade-512-512")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        proc = AutoImageProcessor.from_pretrained(MODEL)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL).eval().to(DEVICE)
        _state.update(proc=proc, model=model, id2label=model.config.id2label)
    return _state

@torch.inference_mode()
def segment(path):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    s = load(); img = Image.open(path).convert("RGB")
    x = s["proc"](img, return_tensors="pt").to(DEVICE)
    logits = s["model"](**x).logits
    up = torch.nn.functional.interpolate(logits, size=img.size[::-1], mode="bilinear", align_corners=False)
    seg = up.argmax(1)[0].cpu().numpy()
    total = seg.size
    classes = [{"label": s["id2label"][int(c)], "ratio": round(int((seg == c).sum()) / total, 4)}
               for c in np.unique(seg)]
    classes.sort(key=lambda d: -d["ratio"])                 # 컨텍스트 효율: 픽셀맵 대신 클래스별 비율만
    return {"path": path, "size": list(img.size), "classes": classes,
            "mask_path": _save_mask(seg, path)}             # 마스크 PNG는 파일로, 경로만 반환
```

- **핵심**: 원시 마스크 배열을 컨텍스트에 흘리지 않는다. 클래스별 픽셀 **비율**만 반환하고 마스크는 파일로.

---

## 5. 파인튜닝 (8GB · SegFormer + LoRA)

```python
from peft import LoraConfig, get_peft_model
lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05,
                  target_modules=["query", "value"], bias="none")
# 학습: 512x512, batch 4, gradient_checkpointing=True, fp16
# 데이터: images/ + 인덱스 마스크 PNG(masks/), id2label.json 동봉
```

- 8GB 팁: `gradient_checkpointing_enable()` + fp16, batch 4. B2는 batch 2.
- 산출물 `artifacts/lora/` + `id2label.json`, 추론 코어는 LoRA 병합 로드.

---

## 6. MCP 툴 계약

- `segment(path: str) -> dict` — `{"path","size","classes":[{"label","ratio"}],"mask_path"}` / `{"error"}`
- `segment_batch(paths) -> list[dict]` — 순서 보존
- `segment_prompt(path, points: list[[x,y]]) -> dict` — SAM2 프롬프트 분할(선택), `{"mask_path","area_ratio"}`
- `model_info() -> dict`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — "장면 구성 비율"은 `segment`(클래스별 ratio 보고), "이 지점 물체만"은 `segment_prompt`. 마스크는 경로로 전달, 배열 인라인 금지.
`agents/semantic-segmenter.md` — `tools:` 분할 MCP 툴 + Read/Glob만.

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩**.
2. **gradient checkpointing + fp16** 학습.
3. **마스크 비인라인** — 클래스 비율만 반환, 마스크는 파일 저장 후 경로.
4. **배치 추론**, 디바이스 자동 감지.
5. 추론 시 `torch.autocast`(CUDA) 선택.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <img>` 가 클래스별 ratio JSON + 마스크 파일 경로 출력.
- [ ] 없는 경로 → `file_not_found`.
- [ ] 반환 JSON에 원시 마스크 배열이 없다(경로만).
- [ ] `train.py` 가 커스텀 클래스 LoRA 생성, 추론이 커스텀 id2label 반영.
- [ ] `segment_prompt` 가 클릭 지점 마스크 반환(SAM2 연결 시).
- [ ] 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`transformers torch peft pillow numpy mcp`; SAM2는 `sam2`)
2. `dataset/`(images+인덱스 마스크) → `python engine/train.py` → `artifacts/lora/`.
3. `python mcp_server.py` → 에이전트에 "이 사진 장면 구성 비율 알려줘".
4. 프롬프트 분할: `segment_prompt(img, [[320,240]])`.
