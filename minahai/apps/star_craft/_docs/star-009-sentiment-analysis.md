# 감정 분석 에이전트 — Transformer(scratch) 대체 · QLoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — scratch Transformer → 사전학습 + QLoRA

| | 원서 Transformer(밑바닥 학습) | 추천 대체 |
|---|---|---|
| 학습 비용 | 대량 데이터·긴 학습 | 사전학습 재사용, 소수 데이터 |
| 한국어 | 별도 구축 | KLUE/KcELECTRA 즉시 |
| 확장성 | 분류 고정 | LLM은 라벨+근거+다태스크 |
| 8GB | 처음부터 무리 | 인코더 LoRA 여유 / 3B QLoRA 가능 |

두 갈래: **고정 라벨 분류 = 인코더(DeBERTa/KLUE) + LoRA**(빠르고 가벼움), **유연한 지시형 감정+근거 = 소형 LLM QLoRA**.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 id | 방식 | 학습 VRAM | 용도 |
|---|---|---|---|
| `klue/roberta-base` (한) / `microsoft/deberta-v3-base` (영) | LoRA 시퀀스분류 | ~3GB | **기본값**. 폐쇄 라벨 감정 분류 |
| `beomi/KcELECTRA-base` | LoRA 시퀀스분류 | ~3GB | 한국어 구어/댓글 |
| `Qwen/Qwen2.5-3B-Instruct` | **QLoRA**(4-bit) | ~7GB (batch 1, seq 512, grad accum) | 감정+이유+측면 추출 지시형 |

- 기본 `SENT_MODEL=klue/roberta-base`(한국어) 또는 프로젝트 언어에 맞게.
- **이 주제가 QLoRA LLM 파인튜닝의 정석** — 3B 4-bit면 8GB에 딱.

---

## 3. 산출물 트리

```
sentiment-analyzer/
├─ engine/
│  ├─ infer.py            # warm 추론 (인코더 or LLM)
│  └─ train.py            # LoRA(인코더) / QLoRA(LLM) 학습
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/sentiment-analyzer/SKILL.md
├─ .claude/agents/sentiment-analyzer.md
├─ data/  train.jsonl     # {"text","label"} 또는 지시형 {"messages":[...]}
├─ artifacts/lora/  labels.json
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (인코더 기준선)

```python
import os, json, torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from peft import PeftModel
BASE = os.environ.get("SENT_MODEL", "klue/roberta-base")
LORA = os.environ.get("SENT_LORA", "artifacts/lora")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        labels = json.load(open("artifacts/labels.json"))          # {"0":"neg","1":"pos"}
        tok = AutoTokenizer.from_pretrained(BASE)
        model = AutoModelForSequenceClassification.from_pretrained(BASE, num_labels=len(labels))
        if os.path.isdir(LORA): model = PeftModel.from_pretrained(model, LORA)
        _state.update(tok=tok, model=model.eval().to(DEVICE), labels=labels)
    return _state

@torch.inference_mode()
def analyze(text, topk=2):
    if not text or not text.strip(): return {"error": "empty_text"}
    s = load()
    x = s["tok"](text, truncation=True, max_length=256, return_tensors="pt").to(DEVICE)
    prob = s["model"](**x).logits.softmax(-1)[0]
    p, idx = prob.topk(min(topk, len(s["labels"])))
    return {"text": text[:80], "predictions":
            [{"label": s["labels"][str(int(i))], "prob": round(float(v), 4)} for v, i in zip(p, idx)]}
```

- `analyze_batch(texts)` 는 패딩 배치로 단일 forward.
- LLM 경로(Qwen2.5-3B QLoRA)는 `AutoModelForCausalLM`+4-bit, 프롬프트 → JSON 파싱 감정/근거.

---

## 5. 파인튜닝 (8GB)

**A. 인코더 LoRA (기본)**
```python
from peft import LoraConfig
LoraConfig(r=8, lora_alpha=16, target_modules=["query", "value"],
           lora_dropout=0.05, task_type="SEQ_CLS")
# batch 16, seq 256, fp16 → 8GB 여유
```

**B. LLM QLoRA (지시형)**
```python
from transformers import BitsAndBytesConfig
BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                   bnb_4bit_compute_dtype=torch.bfloat16)
# trl SFTTrainer, batch 1 + grad accum 8, seq 512, grad-ckpt → ~7GB (star-011 상세)
```

---

## 6. MCP 툴 계약

- `analyze(text: str, topk: int = 2) -> dict` — `{"text","predictions":[{"label","prob"}]}` / `{"error":"empty_text"}`
- `analyze_batch(texts: list[str], topk) -> list[dict]` — 순서 보존, 단일 forward
- `model_info() -> dict` — `{"model","device","labels"}`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — top-1<0.6이면 "중립/모호" 표기. 대량 리뷰는 배치. 라벨 분포 요약 제공. LLM 모드는 감정+근거 문장 추출.
`agents/sentiment-analyzer.md` — `tools:` 감정 MCP 툴 + Read만. 감정 판정은 툴 확률 근거만(주관 판단 금지).

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩**(토크나이저+모델 1회).
2. **배치 추론**(패딩), `inference_mode`.
3. 인코더는 LoRA·fp16, LLM은 4-bit + grad-ckpt.
4. 시퀀스 길이 상한(256/512)로 VRAM 고정.
5. 디바이스 자동 감지.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py "재밌다"` 가 라벨+확률 JSON 출력.
- [ ] 빈 문자열 → `empty_text`(크래시 없음).
- [ ] `train.py` 가 커스텀 라벨 LoRA + `labels.json` 생성, 추론 반영.
- [ ] `analyze_batch` 단일 forward(코드 확인).
- [ ] MCP 모델 로딩 1회(warm).
- [ ] 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`transformers torch peft bitsandbytes trl datasets mcp`)
2. `data/train.jsonl`(`{"text","label"}`) → `python engine/train.py`.
3. `python mcp_server.py` → `sentiment-analyzer` 에이전트에 "이 리뷰들 감정 분류 + 분포".
4. 지시형 모드: `SENT_MODEL=Qwen/Qwen2.5-3B-Instruct` + QLoRA.
