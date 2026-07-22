# 전이학습·QLoRA 공통 플레이북 — RTX 3050 8GB 파인튜닝 SSOT

> **용도**: star-003~010 모든 에이전트가 공유하는 **파인튜닝 공통 규칙**이다.
> 각 빌드 스펙의 "파인튜닝" 절은 이 문서를 참조한다. 여기서 8GB VRAM 예산·
> LoRA/QLoRA 설정·데이터 준비·저장·검증을 한 곳에 고정한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0.

대상 하드웨어: **RTX 3050 · VRAM 8GB · Ampere(bf16 지원)**.

---

## 1. 언제 무엇을 쓰나 (결정 트리)

```
백본을 안 건드려도 되나? (소수 클래스·특징만 필요)
 └ 예 → linear-probe / head 교체        (가장 쌈, 백본 동결)
 └ 아니오 → 파라미터가 큰가?
      └ 인코더/비전(≤300M) → LoRA (fp16, 4-bit 불필요)
      └ LLM(1B~7B)         → QLoRA (4-bit NF4 + LoRA)
```

| 태스크 | 문서 | 8GB 권장 |
|---|---|---|
| 이미지 분류 | star-003 | linear-probe → LoRA |
| 물체 감지 | star-004 | YOLO full FT(소형) / RT-DETR LoRA |
| 시멘틱 분할 | star-005 | SegFormer LoRA |
| 자세 추정 | star-006 | 대개 zero-shot, 필요시 LoRA |
| 이미지 생성 | star-007 | SD1.5 **LoRA/DreamBooth** |
| 이상 탐지 | star-008 | 특징기반, 파인튜닝 거의 불필요 |
| 감정 분석 | star-009 | 인코더 LoRA / 3B **QLoRA** |
| 동영상 분류 | star-010 | VideoMAE **LoRA**+동결 |

---

## 2. QLoRA 4-bit 로드 (LLM · 큰 비전 모델)

```python
import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import prepare_model_for_kbit_training, LoraConfig, get_peft_model

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",            # NF4가 fp4보다 정확
    bnb_4bit_use_double_quant=True,       # 이중 양자화로 추가 절약
    bnb_4bit_compute_dtype=torch.bfloat16 # Ampere는 bf16
)
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-3B-Instruct", quantization_config=bnb, device_map={"": 0})
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
                  task_type="CAUSAL_LM",
                  target_modules=["q_proj","k_proj","v_proj","o_proj",
                                  "gate_proj","up_proj","down_proj"])
model = get_peft_model(model, lora)
model.print_trainable_parameters()        # 보통 <1% 학습
```

- **rank(r)**: 8~16 기본. 데이터 많고 태스크 어려우면 32.
- **alpha ≈ 2×r**. dropout 0.05~0.1.
- **target_modules**: LLM은 attention+MLP 전부, 비전 ViT는 `["query","value"]`부터.

---

## 3. 8GB VRAM 예산표 (경험칙)

| 설정 | 대략 VRAM | 비고 |
|---|---|---|
| ViT-B / SegFormer-B0 LoRA (fp16) | 3~5GB | batch 4~16 |
| SD1.5 LoRA 512² | 6~7GB | grad-ckpt + 8bit-adam 필수 |
| VideoMAE-B LoRA 16프레임 224² | ~7GB | batch 1 + grad accum |
| **Qwen2.5-3B QLoRA** seq512 | ~7GB | batch 1 + grad accum 8 |
| Llama-3.2-3B QLoRA | ~7GB | 동일 |
| 7B QLoRA | ✗ 위험 | 8GB 경계 초과, 3B 권장 |

**황금 조합**: `4-bit(LLM) 또는 fp16(비전)` + `gradient_checkpointing` + `paged_adamw_8bit` + `batch_size=1` + `gradient_accumulation`.

---

## 4. 8GB 필수 스위치 (전부 켠다)

1. **gradient checkpointing** — 활성값 재계산으로 메모리↓(속도 약간↓). `model.gradient_checkpointing_enable()`.
2. **8-bit / paged optimizer** — `optim="paged_adamw_8bit"`(OOM 스파이크 방지). bitsandbytes.
3. **batch 1 + grad accum** — 유효 배치는 accum으로 키움(`effective = 1 × accum`).
4. **mixed precision** — Ampere는 `bf16=True`(fp16보다 안정). diffusers는 fp16.
5. **seq/frame/해상도 상한** — 입력 크기가 VRAM을 지배. 먼저 줄인다.
6. **OOM 폴백** — `try/except torch.cuda.OutOfMemoryError` → 크기 강등 후 재시도, 로그 남김.

```python
from transformers import TrainingArguments
TrainingArguments(
    per_device_train_batch_size=1, gradient_accumulation_steps=8,
    gradient_checkpointing=True, bf16=True, optim="paged_adamw_8bit",
    learning_rate=2e-4, warmup_ratio=0.03, num_train_epochs=3,
    logging_steps=10, save_strategy="epoch", output_dir="artifacts/lora")
```

---

## 5. 데이터 준비 (태스크별 포맷)

| 태스크 | 포맷 |
|---|---|
| 분류(이미지/감정) | 폴더 `label/*` 또는 `{"text","label"}` jsonl |
| 검출 | YOLO(`images/ labels/*.txt`) 또는 COCO json |
| 분할 | `images/` + 인덱스 마스크 PNG + `id2label.json` |
| 생성(LoRA) | 이미지 10~20장 (+ `.txt` 캡션) |
| 이상탐지 | `train/good/` 정상만 |
| 지시형 LLM | `{"messages":[{"role","content"}...]}` chat 포맷 |

- **작게 시작**: 클래스당 수십~수백. LoRA는 소수 데이터에 강함.
- train/val 분리 필수, val로 임계값·early stop.

---

## 6. 저장·병합·배포

```python
model.save_pretrained("artifacts/lora")          # 어댑터만(수 MB~수십 MB)
# 추론 시: 베이스 로드 후 PeftModel.from_pretrained(base, "artifacts/lora")
# 배포 병합(선택, VRAM 여유 시): model.merge_and_unload() → 단일 가중치
```

- **어댑터는 작다** — 여러 태스크 어댑터를 베이스 하나에 스왑 로드 가능(멀티에이전트에 유리).
- 병합은 추론 속도용. 8GB 상시 서비스는 어댑터 유지가 유연.

---

## 7. 검증 루프 (파인튜닝 완료 기준)

1. **성공 기준 수치화** — val 정확도/mAP/FID 등 목표를 문장으로 고정.
2. **소량 오버핏 테스트** — 10샘플로 loss가 0 근처로 떨어지는지(파이프라인 정상 확인).
3. 전체 학습 → val 지표 확인 → 목표 미달이면 rank↑ 또는 데이터 보강.
4. **어댑터 로드 추론**이 베이스 대비 개선됨을 확인(A/B).
5. VRAM 피크를 `nvidia-smi`로 확인, 8GB 여유 두기(OOM 마진).

---

## 8. 흔한 함정 (3050 8GB)

- **`load_in_4bit`인데 optim이 일반 adamw** → OOM. `paged_adamw_8bit` 써라.
- **gradient_checkpointing 안 켬** → 활성값이 VRAM 폭발.
- **fp16으로 QLoRA 학습 시 loss NaN** → Ampere는 `bf16` 권장.
- **seq_len/해상도/프레임을 안 줄임** → 배치보다 입력 크기가 먼저 터진다.
- **`device_map="auto"`가 CPU 오프로딩** → 느려짐. 단일 GPU는 `{"":0}`.
- **7B에 욕심** → 8GB엔 3B가 현실. 품질 부족하면 데이터·rank로 보완.

---

## 9. 멀티에이전트 통합

- 각 태스크 = 어댑터 1개(`artifacts/lora/`) + MCP 툴 서버(warm) + 스킬 + 서브에이전트.
- 베이스 가중치는 공유, **어댑터만 태스크별로 스왑** → 디스크·VRAM 절약.
- 오케스트레이터(star_craft Hub, star-001)가 요청을 해당 서브에이전트로 라우팅.
- 툴 계약(구조화 JSON)과 수용 기준은 각 star-00N 문서가 SSOT.

---

## 10. 최소 의존성

```txt
torch  transformers  peft  bitsandbytes  accelerate  datasets  trl
# 태스크별 추가: timm · ultralytics · diffusers · anomalib · decord
```

- CUDA 버전과 `bitsandbytes` 호환 확인(Ampere sm_86).
- `accelerate config` 1회 설정(단일 GPU, bf16).
