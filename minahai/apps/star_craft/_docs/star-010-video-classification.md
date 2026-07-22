# 동영상 분류 에이전트 — 3DCNN·ECO 대체 · LoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**. (이번 작업의 원래 동기 — 과거 3DCNN 대체.)

---

## 1. 왜 교체하나 — 3DCNN/ECO → 비디오 Transformer

| | 3DCNN·ECO (원서) | 추천 대체 |
|---|---|---|
| 사전학습 | 제한적 | Kinetics 대규모 사전학습 |
| 특징 | 3D 컨볼루션 무거움 | 시공간 어텐션 / **마스크 오토인코더** |
| 라벨 없는 분류 | 불가 | **X-CLIP** 텍스트 zero-shot |
| 8GB 학습 | 빡빡 | LoRA + 프레임 축소로 가능 |

핵심 대체는 **VideoMAE V2**(라벨 분류)와 **X-CLIP**(텍스트로 zero-shot 행동 인식). 8GB에선 프레임 수·해상도·LoRA로 예산 맞춘다.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 id | 방식 | 학습 VRAM | 용도 |
|---|---|---|---|
| `MCG-NJU/videomae-base-finetuned-kinetics` | LoRA + 헤드(16프레임 224²) | ~7GB (batch 1, grad-ckpt) | **기본값**. 커스텀 행동 분류 |
| `facebook/timesformer-base-finetuned-k400` | 동일 | ~7GB | 대안 시공간 어텐션 |
| `microsoft/xclip-base-patch32` | **zero-shot** 텍스트↔영상 | 추론 ~4GB | 학습 없이 행동 라벨 후보 매칭 |

- 기본 `VIDEO_MODEL=MCG-NJU/videomae-base-finetuned-kinetics`.
- **8GB 예산 3레버**: num_frames(16→8), 해상도(224→160), LoRA+헤드만 학습(백본 동결).

---

## 3. 산출물 트리

```
video-classifier/
├─ engine/
│  ├─ sampling.py         # decord 균일 프레임 샘플링
│  ├─ infer.py            # warm 추론 (VideoMAE / X-CLIP)
│  └─ train.py            # LoRA 파인튜닝
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/video-classifier/SKILL.md
├─ .claude/agents/video-classifier.md
├─ data/  (label/*.mp4)
├─ artifacts/lora/  id2label.json
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, torch, numpy as np, decord
from transformers import AutoImageProcessor, VideoMAEForVideoClassification
from peft import PeftModel
MODEL = os.environ.get("VIDEO_MODEL", "MCG-NJU/videomae-base-finetuned-kinetics")
LORA = os.environ.get("VIDEO_LORA", "artifacts/lora")
FRAMES = int(os.environ.get("VIDEO_FRAMES", "16"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        proc = AutoImageProcessor.from_pretrained(MODEL)
        model = VideoMAEForVideoClassification.from_pretrained(MODEL)
        if os.path.isdir(LORA): model = PeftModel.from_pretrained(model, LORA)
        _state.update(proc=proc, model=model.eval().to(DEVICE), id2label=model.config.id2label)
    return _state

def sample(path):                                       # 균일 FRAMES개 추출
    vr = decord.VideoReader(path)
    idx = np.linspace(0, len(vr) - 1, FRAMES).astype(int)
    return list(vr.get_batch(idx).asnumpy())

@torch.inference_mode()
def classify(path, topk=3):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    try: frames = sample(path)
    except Exception: return {"error": "unreadable_video", "path": path}
    s = load()
    x = s["proc"](frames, return_tensors="pt").to(DEVICE)
    prob = s["model"](**x).logits.softmax(-1)[0]
    p, idx = prob.topk(min(topk, prob.numel()))
    return {"path": path, "frames": FRAMES, "predictions":
            [{"label": s["id2label"][int(i)], "prob": round(float(v), 4)} for v, i in zip(p, idx)]}
```

- `classify_text(path, labels)` = X-CLIP zero-shot(후보 라벨 리스트 → 최적 매칭) 선택 툴.

---

## 5. 파인튜닝 (8GB · VideoMAE + LoRA)

```python
from peft import LoraConfig, get_peft_model
lora = LoraConfig(r=16, lora_alpha=32, target_modules=["query", "value"],
                  lora_dropout=0.05, modules_to_save=["classifier"])   # 헤드는 풀학습
# 백본 동결 + LoRA, num_frames 16, 224², batch 1, grad accum 8,
# gradient_checkpointing=True, fp16 → ~7GB. OOM 시 frames 8 / 160².
```

- 산출물 `artifacts/lora/` + `id2label.json`. 추론 코어가 LoRA 로드.

---

## 6. MCP 툴 계약

- `classify(path: str, topk: int = 3) -> dict` — `{"path","frames","predictions":[{"label","prob"}]}` / `{"error"}`
- `classify_text(path: str, labels: list[str]) -> dict` — X-CLIP zero-shot(선택)
- `model_info() -> dict` — `{"model","device","num_frames","classes"}`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — 학습된 행동은 `classify`, 임의 후보 라벨은 `classify_text`. top-1<0.4면 저신뢰+top-3. 긴 영상은 구간 나눠 다중 호출 후 집계.
`agents/video-classifier.md` — `tools:` 비디오 MCP 툴 + Read/Glob만. 판정은 툴 결과만(프레임 육안 추측 금지).

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩**(모델·프로세서 1회).
2. **프레임 예산화** — 균일 샘플링 FRAMES개만(전체 디코딩 금지), decord 사용.
3. 학습: **백본 동결 + LoRA + grad-ckpt + fp16 + batch 1/grad accum**.
4. **해상도/프레임 자동 강등**(OOM 캐치 시 160²/8프레임).
5. 디바이스 자동 감지, 읽기 실패 명시적 에러.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <video.mp4>` 가 top-k 행동 JSON 출력.
- [ ] 없는 경로 → `file_not_found`, 손상 영상 → `unreadable_video`(크래시 없음).
- [ ] `train.py` 가 8GB에서 OOM 없이 커스텀 행동 LoRA + `id2label.json` 생성, 추론 반영.
- [ ] 프레임 샘플링이 전체 디코딩이 아니라 균일 FRAMES개(코드 확인).
- [ ] `classify_text` 가 미학습 후보 라벨 매칭(X-CLIP 연결 시).
- [ ] MCP 모델 로딩 1회(warm), 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`transformers torch peft decord av pillow numpy mcp`)
2. `data/<label>/*.mp4` → `python engine/train.py` → `artifacts/lora/`.
3. `python mcp_server.py` → `video-classifier` 에이전트에 "이 클립 어떤 동작인지".
4. zero-shot: `classify_text(clip, ["패스","슛","드리블"])`.
