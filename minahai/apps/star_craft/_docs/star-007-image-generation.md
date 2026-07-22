# 이미지 생성 에이전트 — DCGAN·SAGAN 대체 · LoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — DCGAN/SAGAN → 확산모델 + LoRA

| | DCGAN·Self-Attention GAN (원서) | 추천 대체 |
|---|---|---|
| 학습 안정성 | mode collapse 잦음 | 확산모델 안정 |
| 조건부 생성 | 클래스 라벨 한정 | **텍스트 프롬프트**(SD) |
| 커스텀 대상 | 처음부터 재학습 | **LoRA/DreamBooth** 소수 이미지로 |
| 8GB | 저해상 한정 | SD1.5 LoRA 512² 여유 |

이 주제가 **8GB LoRA 파인튜닝의 정석 사례**. 10~20장으로 특정 스타일·객체를 SD1.5에 각인.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 | LoRA 학습 VRAM | 추론 | 용도 |
|---|---|---|---|
| `stable-diffusion-v1-5/stable-diffusion-v1-5` | ~6–7GB (512², batch 1, grad-ckpt, 8bit-adam) | ~4GB | **기본값**. 스타일/객체 LoRA |
| `stabilityai/sd-turbo` | 동일 | 1–4 스텝 초고속 | 미리보기·대량 생성 |
| `stabilityai/stable-diffusion-xl-base-1.0` | 빡빡(~8GB 한계, 고급 최적화 필수) | ~7GB | 고품질(선택·상급) |

- 기본 `GEN_MODEL=stable-diffusion-v1-5/stable-diffusion-v1-5`.
- **SDXL은 8GB 경계선** — grad-ckpt+8bit-adam+xformers 다 켜야 겨우. 우선 SD1.5 권장.

---

## 3. 산출물 트리

```
image-generator/
├─ engine/
│  ├─ infer.py            # 파이프라인 warm 로드 + LoRA 적용 생성
│  └─ train_lora.py       # diffusers LoRA/DreamBooth 학습 래퍼
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/image-generator/SKILL.md
├─ .claude/agents/image-generator.md
├─ train_data/            # 커스텀 이미지 10~20장 (+캡션)
├─ artifacts/lora/        # pytorch_lora_weights.safetensors
├─ outputs/               # 생성물 (파일로 저장)
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, torch
from diffusers import StableDiffusionPipeline
MODEL = os.environ.get("GEN_MODEL", "stable-diffusion-v1-5/stable-diffusion-v1-5")
LORA = os.environ.get("GEN_LORA", "artifacts/lora")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        pipe = StableDiffusionPipeline.from_pretrained(
            MODEL, torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
            safety_checker=None)
        if os.path.isdir(LORA): pipe.load_lora_weights(LORA)
        pipe = pipe.to(DEVICE)
        pipe.enable_attention_slicing()                   # 8GB 절약
        _state["pipe"] = pipe
    return _state["pipe"]

@torch.inference_mode()
def generate(prompt, steps=25, guidance=7.5, seed=None, n=1):
    pipe = load()
    g = torch.Generator(DEVICE).manual_seed(seed) if seed is not None else None
    imgs = pipe(prompt, num_inference_steps=steps, guidance_scale=guidance,
                num_images_per_prompt=n, generator=g).images
    paths = []
    for i, im in enumerate(imgs):
        p = f"outputs/{abs(hash((prompt, seed, i))) % 10**8}.png"; im.save(p); paths.append(p)
    return {"prompt": prompt, "seed": seed, "images": paths}   # 이미지 경로만 반환(바이너리 인라인 금지)
```

---

## 5. LoRA 파인튜닝 (8GB)

```
accelerate launch diffusers/examples/text_to_image/train_text_to_image_lora.py \
  --pretrained_model_name_or_path=$GEN_MODEL \
  --train_data_dir=train_data --resolution=512 --center_crop \
  --train_batch_size=1 --gradient_accumulation_steps=4 \
  --gradient_checkpointing --use_8bit_adam --mixed_precision=fp16 \
  --rank=8 --max_train_steps=1000 --learning_rate=1e-4 \
  --output_dir=artifacts/lora
```

- **8GB 필수 스위치**: `--gradient_checkpointing --use_8bit_adam --mixed_precision=fp16 --train_batch_size=1`. xformers 설치 시 추가 절약.
- 특정 객체 각인은 DreamBooth(`train_dreambooth_lora.py`) + instance prompt.

---

## 6. MCP 툴 계약

- `generate(prompt: str, steps: int=25, guidance: float=7.5, seed: int=None, n: int=1) -> dict`
  - `{"prompt","seed","images":[경로]}` — **바이너리 인라인 금지, 파일 경로만**
- `list_loras() -> list[str]` / `set_lora(name: str) -> dict`
- `model_info() -> dict`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — 프롬프트 작성 규칙(주제/스타일/화질 토큰), seed 고정으로 재현, 대량은 n으로 배치. 생성물은 경로로 보고.
`agents/image-generator.md` — `tools:` 생성 MCP 툴 + Read만. **결과 이미지 경로만 전달**, base64 인라인 금지.

---

## 8. 8GB 최적화 요구사항 (필수)

1. **파이프라인 warm 로드**(재로딩 금지).
2. **fp16 + attention slicing**(+ 가능 시 xformers, `enable_model_cpu_offload` 옵션).
3. 학습: **grad-ckpt + 8bit-adam + batch 1 + grad accum**.
4. **이미지 파일 저장 후 경로 반환**(컨텍스트 보호).
5. 디바이스 자동 감지.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py "a cat"` 가 outputs/*.png 저장 + 경로 JSON 반환.
- [ ] 반환에 이미지 바이너리/base64 없음(경로만).
- [ ] MCP 파이프라인 로딩 1회(warm).
- [ ] `train_lora.py` 가 8GB에서 OOM 없이 `artifacts/lora/` 생성, 이후 생성물에 스타일 반영.
- [ ] seed 고정 시 동일 출력(재현성).
- [ ] 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`diffusers transformers accelerate torch bitsandbytes safetensors mcp`)
2. `train_data/`에 10~20장 → `train_lora.py` → `artifacts/lora/`.
3. `python mcp_server.py` → `image-generator` 에이전트에 "이 스타일로 X 생성".
4. 모델 교체: `GEN_MODEL=stabilityai/sd-turbo`(초고속 미리보기).
