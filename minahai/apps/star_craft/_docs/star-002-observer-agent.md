# ConvNeXt Nano 이미지 분류 에이전트 — 하네스 엔지니어링 구현 지시서

> **이 문서의 용도**: Claude Code에게 주는 **빌드 스펙(build spec)**이다.
> 빈 프로젝트 폴더에서 Claude Code 세션을 열고 이 파일을 읽힌 뒤 다음과 같이 지시하라:
>
> > "이 지시서(spec)대로 전부 구현하고, **§6 수용 기준**을 모두 통과시켜라."
>
> 각 단계는 명령형으로 작성되어 있으며 Claude Code는 이를 순서대로 실행한다.
> 참조 코드는 "그대로 쓰라"가 아니라 "이 계약을 만족하는 기준선"이다 — §4 툴 계약과
> §6 수용 기준만 지키면 개선은 허용된다.

---

## 0. 역할 및 하네스 엔지니어링 원칙

너(Claude Code)는 이미지 분류 에이전트의 **하네스를 설계·구현**한다.
"하네스 엔지니어링"이란 모델에 즉흥적으로 프롬프트를 던지는 대신, 에이전트가 동작하는
환경 — **툴 인터페이스 · 스킬 · 권한 · 컨텍스트 · 검증** — 을 공학적으로 설계하는 것이다.
아래 원칙을 모든 단계에서 준수하라.

1. **결정론적 툴 우선** — 분류는 LLM의 추측이 아니라 코드(ConvNeXt Nano 추론)가 수행한다. 에이전트는 툴 결과를 *해석·보고*만 한다.
2. **구조화된 I/O** — 모든 툴은 파싱 가능한 JSON을 반환한다. 결과를 자유서술 텍스트로 흘리지 않는다.
3. **모델 상시 로딩(warm)** — 가중치는 프로세스 생명주기당 **1회만** 로드해 메모리에 상주시킨다. 호출마다 재로딩 금지.
4. **툴 표면 최소화** — 서브에이전트에는 분류에 필요한 툴만 화이트리스트한다.
5. **명시적 실패 모드** — 파일 없음 / 손상 이미지 / 미지원 포맷을 조용히 넘기지 말고 구조화된 에러로 반환한다.
6. **컨텍스트 효율** — 1000차원 확률 벡터 같은 대량 출력을 컨텍스트에 쏟지 않는다. top-k만 반환한다.
7. **검증 가능성** — §6 수용 기준을 자동으로 확인할 수 있어야 한다.

---

## 1. 산출물 (Deliverables)

다음 파일 트리를 생성하라:

```
convnext-classifier/
├─ engine/
│  ├─ __init__.py
│  └─ classify.py            # ConvNeXt Nano 추론 엔진 (결정론적 코어)
├─ mcp_server.py             # warm 모델을 상주시키는 MCP 툴 서버
├─ .mcp.json                 # Claude Code용 MCP 서버 등록
├─ .claude/
│  ├─ skills/
│  │  └─ image-classifier/
│  │     └─ SKILL.md         # 사용법·워크플로우 스킬
│  └─ agents/
│     └─ image-classifier.md # 전용 서브에이전트
├─ tests/
│  └─ test_classify.py       # 수용 기준 자동 검증
├─ requirements.txt
└─ README.md
```

---

## 2. 단계별 구현

### Step 1 — 환경
- `requirements.txt`: `timm>=1.0`, `torch`, `pillow`, `mcp`(파이썬 MCP SDK).
- Python 3.10+ 가정. **GPU 유무를 런타임에 감지**해 자동 대응하라(있으면 CUDA, 없으면 CPU).
- `engine/__init__.py`는 비어 있어도 되며, `from engine.classify import ...`가 프로젝트 루트에서 동작하도록 보장하라.

### Step 2 — 추론 엔진 `engine/classify.py`

다음 기준선 구현을 작성하라(§4 툴 계약과 §5 최적화를 반드시 유지):

```python
import argparse, json, os
import torch, timm
from PIL import Image, UnidentifiedImageError
from timm.data import ImageNetInfo

MODEL_NAME = os.environ.get("CONVNEXT_MODEL", "convnext_nano.d1h_in1k")  # ImageNet-1k
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_state = {}  # 프로세스당 1회 로드되는 warm 상태

def load():
    if not _state:
        model = timm.create_model(MODEL_NAME, pretrained=True).eval().to(DEVICE)
        model.to(memory_format=torch.channels_last)          # ← ConvNeXt 최적화
        cfg = timm.data.resolve_model_data_config(model)
        tf = timm.data.create_transform(**cfg, is_training=False)
        _state.update(model=model, tf=tf, info=ImageNetInfo(), input_size=cfg["input_size"])
        # 워밍업: 첫 실호출 지연 제거
        dummy = torch.zeros(1, *cfg["input_size"], device=DEVICE).to(memory_format=torch.channels_last)
        with torch.inference_mode():
            model(dummy)
    return _state

def _predict(tensors, topk):
    s = load()
    x = torch.stack(tensors).to(DEVICE).to(memory_format=torch.channels_last)
    with torch.inference_mode():
        probs = s["model"](x).softmax(dim=1)
    p, idx = probs.topk(topk)
    return [
        [{"label": s["info"].index_to_description(int(i), detailed=True),
          "prob": round(float(v), 4)} for v, i in zip(pr, ix)]
        for pr, ix in zip(p, idx)
    ]

def classify(path, topk=5):
    if not os.path.isfile(path):
        return {"error": "file_not_found", "path": path}
    try:
        img = Image.open(path).convert("RGB")
    except UnidentifiedImageError:
        return {"error": "unsupported_or_corrupt_image", "path": path}
    s = load()
    return {"path": path, "predictions": _predict([s["tf"](img)], topk)[0]}

def classify_batch(paths, topk=5):
    """유효한 이미지들을 한 번의 forward로 배치 추론."""
    s = load()
    valid, tensors, results = [], [], {}
    for p in paths:
        if not os.path.isfile(p):
            results[p] = {"error": "file_not_found", "path": p}; continue
        try:
            tensors.append(s["tf"](Image.open(p).convert("RGB"))); valid.append(p)
        except UnidentifiedImageError:
            results[p] = {"error": "unsupported_or_corrupt_image", "path": p}
    if tensors:
        for p, preds in zip(valid, _predict(tensors, topk)):
            results[p] = {"path": p, "predictions": preds}
    return [results[p] for p in paths]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--topk", type=int, default=5)
    a = ap.parse_args()
    out = classify_batch(a.images, a.topk) if len(a.images) > 1 else classify(a.images[0], a.topk)
    print(json.dumps(out, ensure_ascii=False, indent=2))
```

### Step 3 — MCP 툴 서버 `mcp_server.py`

모델을 warm 상태로 상주시키는 서버. 기동 시 1회 로드 후 이후 호출은 수십 ms대로 처리된다.

```python
from mcp.server.fastmcp import FastMCP
from engine.classify import classify, classify_batch, load, MODEL_NAME, DEVICE

mcp = FastMCP("convnext-classifier")
load()  # 기동 시 1회 로드 + 워밍업 → 이후 상시 warm

@mcp.tool()
def classify_image(path: str, topk: int = 5) -> dict:
    """이미지 파일 하나를 ConvNeXt Nano로 분류한다.
    반환: {path, predictions:[{label, prob}]} 또는 {error, path}."""
    return classify(path, topk)

@mcp.tool()
def classify_images(paths: list[str], topk: int = 5) -> list[dict]:
    """여러 이미지를 한 번의 forward로 배치 분류한다."""
    return classify_batch(paths, topk)

@mcp.tool()
def model_info() -> dict:
    """현재 로드된 모델명과 디바이스를 반환한다."""
    return {"model": MODEL_NAME, "device": DEVICE}

if __name__ == "__main__":
    mcp.run()
```

### Step 4 — `.mcp.json` (Claude Code MCP 등록)

```json
{
  "mcpServers": {
    "convnext": {
      "command": "python",
      "args": ["mcp_server.py"]
    }
  }
}
```

### Step 5 — 스킬 `.claude/skills/image-classifier/SKILL.md`

```markdown
---
name: image-classifier
description: ConvNeXt Nano로 이미지를 ImageNet 클래스로 분류한다. 단일 이미지 판별, 폴더 일괄 분류·태깅, top-k 확률/신뢰도 해석이 필요할 때 사용.
---

# 이미지 분류 (ConvNeXt Nano)

## 언제 쓰나
- 사진/스크린샷의 카테고리 판별, 폴더 정리·태깅, 잘못 분류된 이미지 검수.

## 사용법
- 단일 이미지: `classify_image(path, topk=5)`.
- 여러 이미지/폴더: 경로 목록을 모아 `classify_images(paths, topk=5)`로 **배치 호출**(한 장씩 호출 금지 — 처리량 저하).
- 경로는 항상 절대경로를 전달한다.

## 결과 해석 규칙
- 최고 확률 < 0.30 이면 "저신뢰"로 표시하고 top-3를 함께 제시한다.
- 확률은 소수 2자리 %로 사용자에게 보고한다.
- 툴이 {error} 를 반환하면 그대로 사용자에게 사유를 전달하고, 다음 파일로 진행한다.

## 폴더 일괄 분류 워크플로우
1. Glob 으로 이미지 경로 수집(jpg/png/webp).
2. classify_images 로 배치 분류.
3. 파일명 · top-1 라벨 · 확률 표로 요약.
```

### Step 6 — 서브에이전트 `.claude/agents/image-classifier.md`

```markdown
---
name: image-classifier
description: 이미지를 ConvNeXt Nano로 분류하는 전문 에이전트. 카테고리 판별, 폴더 정리·태깅에 사용.
tools: mcp__convnext__classify_image, mcp__convnext__classify_images, mcp__convnext__model_info, Read, Glob
---
너는 이미지 분류 전문 에이전트다. 분류는 반드시 classify_image/classify_images 툴로만
수행하고, 절대 이미지 내용을 육안 추측으로 판정하지 않는다. 결과는 확률과 함께 보고하며,
최고 확률이 0.30 미만이면 저신뢰로 표기하고 top-3를 제시한다. 여러 이미지는 배치 툴을 쓴다.
```

`tools:`에는 위 항목만 화이트리스트한다(원칙 4). Bash·Write 등 불필요한 툴은 부여하지 않는다.

### Step 7 — 최적화 적용
§5의 모든 항목이 코드에 반영되었는지 확인하라.

### Step 8 — 검증
§6 수용 기준을 `tests/test_classify.py`로 자동 검증하고, §7 절차를 수행하라.

---

## 3. 모델 선택 지침

| 모델 id | 용도 |
|---|---|
| `convnext_nano.d1h_in1k` | 기본값. ImageNet-1k(1000 클래스). |
| `convnext_nano.in12k_ft_in1k` | 더 강한 특징. 전이학습 기반으로 쓸 때. |
| `convnextv2_nano.fcmae_ft_in22k_in1k` | ConvNeXt V2. 정확도 우선. |

- 모델은 `CONVNEXT_MODEL` 환경변수로 교체 가능해야 한다(코드에 하드코딩 금지).
- **커스텀 클래스**가 필요하면: `timm.create_model(..., num_classes=N)`로 head를 교체해 fine-tune하고, `ImageNetInfo` 대신 프로젝트에 번들한 `labels.txt` 매핑을 사용하도록 `classify.py`를 확장하라.

---

## 4. 툴 계약 (Tool Contract) — 반드시 준수

- `classify_image(path: str, topk: int = 5) -> dict`
  - 성공: `{"path": str, "predictions": [{"label": str, "prob": float}, ...]}` (길이 = topk, prob 내림차순)
  - 실패: `{"error": "file_not_found" | "unsupported_or_corrupt_image", "path": str}`
- `classify_images(paths: list[str], topk: int = 5) -> list[dict]`
  - 입력 순서와 동일한 순서로 각 항목의 성공/실패 dict를 반환한다.
- `prob`는 0~1 범위의 소수 4자리로 반올림한다.
- 어떤 입력에도 **예외로 프로세스가 죽지 않는다**(에러는 값으로 반환).

---

## 5. 최적화 요구사항 (ConvNeXt Nano 특화) — 필수

1. **모델 상시 로딩(warm)** — MCP 서버 기동 시 1회 로드. 호출마다 재로딩 금지. *(가장 큰 이득)*
2. **`channels_last` 메모리 포맷** — 모델과 입력 텐서 모두 적용. ConvNeXt 계열의 핵심 가속.
3. **`torch.inference_mode()` + `.eval()`** — grad 비활성화.
4. **워밍업 추론 1회** — 로드 직후 더미 forward로 첫 실호출 지연 제거.
5. **배치 처리** — 다중 이미지는 텐서를 stack 해 단일 forward로 처리.
6. **디바이스 자동 감지** — CUDA 가용 시 GPU, 아니면 CPU.

### 선택적 고급 최적화(README에 방법만 문서화, 기본 비활성)
- GPU: `torch.autocast`로 bf16/fp16 추론.
- CPU: **ONNX Runtime** 내보내기 또는 `torch.compile`. `torch.set_num_threads` 튜닝.
- 입력 해상도: 처리량 우선 시 `data_config` 범위 내에서 축소 검토(기본 224).

---

## 6. 수용 기준 (Definition of Done) — 전부 통과해야 완료

- [ ] `python engine/classify.py <sample.jpg>` 가 top-5 예측 JSON을 출력한다.
- [ ] 존재하지 않는 경로 → `{"error":"file_not_found"}` 반환(크래시 없음).
- [ ] 손상/미지원 파일 → `{"error":"unsupported_or_corrupt_image"}` 반환.
- [ ] MCP 서버 기동 로그에 모델 로딩이 **정확히 1회**만 기록된다.
- [ ] 같은 서버 프로세스에서 2번째 호출 지연이 1번째보다 뚜렷하게 작다(warm 확인).
- [ ] 서브에이전트 `tools:` 목록에 분류 관련 MCP 툴과 Read/Glob 외의 툴이 없다.
- [ ] `classify.py`에 `channels_last`, `inference_mode`, 워밍업, 디바이스 자동 감지가 존재한다.
- [ ] `classify_images`가 단일 forward로 배치를 처리한다(코드로 확인 가능).
- [ ] `pytest tests/` 전부 통과.
- [ ] `README.md`에 설치·실행·최적화 토글 방법이 문서화되어 있다.

---

## 7. 검증 절차

1. `pip install -r requirements.txt`
2. 샘플 이미지 1장으로 CLI 확인: `python engine/classify.py sample.jpg --topk 5`
3. 에러 경로 확인: `python engine/classify.py nope.jpg` → error JSON.
4. `tests/test_classify.py` 작성 및 실행:
   - 정상 이미지 → predictions 길이 == topk, prob 내림차순.
   - 없는 경로 / 손상 파일 → 해당 error 코드.
   - `classify_batch([a, 없는경로, b])` → 순서 보존, 중간 항목만 error.
5. MCP 확인: 서버 기동 후 `model_info` 및 `classify_image`를 각각 호출, 2차 호출 지연 감소 확인.

---

## 8. 빌드 후 사용법 (최종 사용자용)

1. Claude Code에서 이 프로젝트 폴더를 연다(`.mcp.json`이 자동 로드됨).
2. `python mcp_server.py`로 MCP 서버가 기동되면 `convnext` 툴들이 노출된다.
3. `image-classifier` 서브에이전트에게 "이 폴더 이미지들을 분류해서 표로 정리해줘"처럼 지시한다.
4. 모델 교체: `CONVNEXT_MODEL=convnextv2_nano.fcmae_ft_in22k_in1k` 환경변수 설정.

---

*참조: ConvNeXt Nano 추론 API는 timm 공식 방식(`resolve_model_data_config` + `create_transform`)과
`ImageNetInfo.index_to_description()` 레이블 매핑을 사용한다.*
