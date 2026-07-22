# 이미지 분류·전이학습 에이전트 — VGG 대체 · QLoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**이다. 빈 폴더에서 이 파일을 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 모두 통과시켜라"* 라고 지시한다.
> 하네스 원칙(결정론적 툴 · 구조화 I/O · warm 모델 · 툴 최소화 · 명시적 실패 · 컨텍스트 효율)은
> [star-002-observer-agent.md](star-002-observer-agent.md) §0 을 그대로 따른다.
> QLoRA/LoRA 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md) 참조.

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — VGG → 현대 백본

| | VGG16/19 (원서) | 추천 대체 |
|---|---|---|
| 파라미터 | 138M, 무거움 | ViT-B 86M / ConvNeXt-V2-Nano 15M |
| 사전학습 | ImageNet-1k 지도학습 | **DINOv2** 자기지도(라벨 없이 강한 특징) |
| 전이학습 | 전체 미세조정 필요 | **linear-probe** 또는 **LoRA**만으로 충분 |
| 8GB 적합성 | 파인튜닝 빡빡 | 4-bit + LoRA로 여유 |

VGG는 특징 추출기로도 낡았다. 자기지도 백본(DINOv2)은 **동결한 채로도** 선형 분류기 하나만 얹으면 소수 데이터에서 VGG 전체 미세조정을 능가한다.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 id | 파라미터 | 추론 VRAM | 커스텀 학습 방식 | 용도 |
|---|---|---|---|---|
| `facebook/dinov2-base` | 86M | ~1.5GB | **linear-probe**(백본 동결) | 기본값. 소수 클래스 전이학습 |
| `timm/convnextv2_nano.fcmae_ft_in22k_in1k` | 15M | ~0.5GB | head 교체 미세조정 | 초경량 · 빠른 추론 |
| `timm/vit_base_patch14_reg4_dinov2.lvd142m` | 86M | ~1.5GB | **QLoRA**(4-bit + LoRA) | 데이터 많고 정확도 우선 |

- 모델은 `CLS_MODEL` 환경변수로 교체 가능하게(하드코딩 금지).
- **1순위 전략은 linear-probe** — 백본 동결 후 head만 학습. 8GB에서 batch 64도 여유, 몇 분이면 끝.
- 데이터가 크면 QLoRA로 승격(§5).

---

## 3. 산출물 트리

```
image-classifier/
├─ engine/
│  ├─ __init__.py
│  ├─ infer.py            # warm 추론 코어 (결정론)
│  └─ train.py            # linear-probe / QLoRA 학습
├─ mcp_server.py          # warm 모델 상주 MCP 서버
├─ .mcp.json
├─ .claude/
│  ├─ skills/image-classifier/SKILL.md
│  └─ agents/image-classifier.md
├─ data/                  # class_a/*.jpg, class_b/*.jpg …
├─ artifacts/             # head.pt 또는 lora/  + labels.json
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, json, torch
from PIL import Image, UnidentifiedImageError
from transformers import AutoImageProcessor, AutoModel

MODEL = os.environ.get("CLS_MODEL", "facebook/dinov2-base")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        proc = AutoImageProcessor.from_pretrained(MODEL)
        backbone = AutoModel.from_pretrained(MODEL).eval().to(DEVICE)
        labels = json.load(open("artifacts/labels.json"))            # {"0":"cat",...}
        head = torch.nn.Linear(backbone.config.hidden_size, len(labels)).to(DEVICE)
        head.load_state_dict(torch.load("artifacts/head.pt", map_location=DEVICE)); head.eval()
        _state.update(proc=proc, backbone=backbone, head=head, labels=labels)
        with torch.inference_mode():                                  # 워밍업
            backbone(**proc(Image.new("RGB", (224, 224)), return_tensors="pt").to(DEVICE))
    return _state

@torch.inference_mode()
def classify(path, topk=3):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    try: img = Image.open(path).convert("RGB")
    except UnidentifiedImageError: return {"error": "unsupported_or_corrupt_image", "path": path}
    s = load()
    x = s["proc"](img, return_tensors="pt").to(DEVICE)
    feat = s["backbone"](**x).pooler_output                           # [1, H]
    prob = s["head"](feat).softmax(-1)[0]
    p, idx = prob.topk(min(topk, len(s["labels"])))
    return {"path": path, "predictions":
            [{"label": s["labels"][str(int(i))], "prob": round(float(v), 4)} for v, i in zip(p, idx)]}
```

- 배치 버전 `classify_batch(paths, topk)`도 단일 forward로 구현(원칙: 배치 처리).

---

## 5. 전이학습 (8GB)

**A. linear-probe (기본 · 권장)** — 백본 동결, head만 학습.
```
python engine/train.py --data data/ --mode linear --epochs 20 --batch 64
# 백본 forward는 no_grad, head만 backward → 8GB에서 batch 64 여유
```

**B. QLoRA (데이터 많을 때)** — 백본 4-bit 로드 + LoRA 어댑터.
```python
from transformers import BitsAndBytesConfig
from peft import LoraConfig, get_peft_model
bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                         bnb_4bit_compute_dtype=torch.bfloat16)
lora = LoraConfig(r=8, lora_alpha=16, target_modules=["query", "value"],
                  lora_dropout=0.05, bias="none")
# 자세한 VRAM 예산·저장/병합은 star-011 참조
```

- 산출물: `artifacts/head.pt`(+`labels.json`) 또는 `artifacts/lora/`. 코어는 둘 다 로드 가능해야.

---

## 6. MCP 툴 계약

- `classify_image(path: str, topk: int = 3) -> dict`
  - 성공 `{"path", "predictions":[{"label","prob"}]}` (prob 내림차순) / 실패 `{"error","path"}`
- `classify_images(paths: list[str], topk: int = 3) -> list[dict]` — 입력 순서 보존, 단일 forward 배치
- `model_info() -> dict` — `{"model", "device", "num_classes"}`
- 어떤 입력에도 프로세스가 죽지 않는다(에러는 값으로 반환).

---

## 7. 스킬 + 서브에이전트

`.claude/skills/image-classifier/SKILL.md` — 커스텀 클래스 분류. top-1 < 0.30 이면 저신뢰 표기 + top-3 제시, 폴더는 Glob→배치.
`.claude/agents/image-classifier.md` — `tools:`에 `mcp__cls__classify_image, mcp__cls__classify_images, mcp__cls__model_info, Read, Glob`만 화이트리스트. 육안 추측 판정 금지.

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩** — MCP 기동 시 1회 로드 + 워밍업. 호출마다 재로딩 금지.
2. **백본 동결 추론** — `inference_mode` + `.eval()`, `pooler_output` 재사용.
3. **배치 처리** — 다중 이미지는 stack 후 단일 forward.
4. **linear-probe 우선** — 학습 시 백본 forward는 no_grad, head만 backward.
5. **디바이스 자동 감지** — CUDA/CPU.
6. (선택) GPU `torch.autocast` bf16 추론, CPU는 ONNX 내보내기.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <img>` 가 top-k 예측 JSON 출력.
- [ ] 없는 경로 → `file_not_found`, 손상 파일 → `unsupported_or_corrupt_image`(크래시 없음).
- [ ] MCP 기동 로그에 모델 로딩 **정확히 1회**. 2번째 호출 지연 < 1번째(warm).
- [ ] `train.py --mode linear` 가 `artifacts/head.pt` + `labels.json` 생성, 이후 추론이 커스텀 라벨 반환.
- [ ] 서브에이전트 `tools:`에 분류 MCP 툴 + Read/Glob 외 없음.
- [ ] `classify_images` 가 단일 forward 배치(코드 확인).
- [ ] `pytest tests/` 통과, `README.md`에 학습·추론·모델교체 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`transformers timm torch peft bitsandbytes pillow mcp`)
2. `data/<class>/*.jpg` 배치 → `python engine/train.py --data data/ --mode linear`
3. `python mcp_server.py` → `image-classifier` 서브에이전트에 "이 폴더 분류해서 표로" 지시.
4. 모델 교체: `CLS_MODEL=timm/convnextv2_nano.fcmae_ft_in22k_in1k`.
