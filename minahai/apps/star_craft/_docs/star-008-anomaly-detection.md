# 이상 화상 탐지 에이전트 — AnoGAN·EfficientGAN 대체 · 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — AnoGAN/Efficient GAN → Anomalib

| | AnoGAN·Efficient GAN (원서) | 추천 대체 |
|---|---|---|
| 학습 | GAN 재구성, 느리고 불안정 | 사전학습 특징 기반, 빠름 |
| 추론 | latent 역탐색(수백 스텝) | 단일 forward |
| 정확도 | 낡음 | PatchCore·EfficientAD SOTA |
| 데이터 | 많이 필요 | **정상 이미지만** 소량 |

**Anomalib**(오픈소스) 하나로 여러 SOTA 방식을 통일 API로. 대부분 **동결 백본 특징** 기반이라 8GB에서 매우 가볍다.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 (anomalib) | 학습 | VRAM | 용도 |
|---|---|---|---|
| **PatchCore** | 특징 메모리뱅크(역전파 없음) | ~4GB | 기본값. 정상 수십~수백 장 |
| **EfficientAd** | 경량 증류, 빠름·SOTA | ~5GB | 실시간·고정확 |
| **PaDiM** | 통계 분포 | ~4GB | 초경량 베이스라인 |
| **FastFlow** | normalizing flow | ~6GB | 미세 결함 |

- 전부 **정상(good) 이미지만으로 학습**, 결함 라벨 불필요(비지도).
- 기본 `ANOMALY_MODEL=patchcore`.

---

## 3. 산출물 트리

```
anomaly-detector/
├─ engine/
│  ├─ infer.py            # warm 모델 → score + heatmap 경로
│  └─ train.py            # anomalib Engine 학습 래퍼
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/anomaly-detector/SKILL.md
├─ .claude/agents/anomaly-detector.md
├─ dataset/  (train/good/, test/…)
├─ artifacts/model.ckpt   threshold.json
├─ heatmaps/              # 이상영역 시각화(파일)
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, json, torch
from PIL import Image
from anomalib.deploy import TorchInferencer
CKPT = os.environ.get("ANOMALY_CKPT", "artifacts/model.ckpt")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        _state["inf"] = TorchInferencer(path=CKPT, device=DEVICE)
        _state["thr"] = json.load(open("artifacts/threshold.json"))["image_threshold"]
    return _state

def detect(path):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    try: Image.open(path).verify()
    except Exception: return {"error": "unsupported_or_corrupt_image", "path": path}
    s = load(); r = s["inf"].predict(image=path)
    score = float(r.pred_score)
    hp = f"heatmaps/{os.path.basename(path)}.png"
    if r.anomaly_map is not None: Image.fromarray(r.heat_map).save(hp)
    return {"path": path, "anomaly_score": round(score, 4),
            "is_anomaly": score >= s["thr"], "threshold": round(s["thr"], 4),
            "heatmap_path": hp}                 # 이상영역 맵은 파일로, 점수만 인라인
```

---

## 5. 학습 (8GB · Anomalib)

```python
from anomalib.data import Folder
from anomalib.models import Patchcore
from anomalib.engine import Engine
data = Folder(name="parts", root="dataset", normal_dir="train/good",
              abnormal_dir="test/defect")          # 정상만 있으면 abnormal 생략 가능
engine = Engine()
engine.fit(model=Patchcore(), datamodule=data)      # PatchCore는 역전파 없이 1 epoch
engine.export(export_type="torch", export_root="artifacts")   # model.ckpt + threshold
```

- 8GB 팁: PatchCore/PaDiM은 역전파 없어 batch 큼. EfficientAd는 batch 1~4.
- 임계값은 검증셋에서 자동 산출 → `threshold.json` 저장.

---

## 6. MCP 툴 계약

- `detect(path: str) -> dict` — `{"path","anomaly_score","is_anomaly","threshold","heatmap_path"}` / `{"error"}`
- `detect_batch(paths) -> list[dict]` — 순서 보존
- `model_info() -> dict` — `{"model","device","threshold"}`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — score≥threshold면 이상, 경계(±10%)는 "재검사 권고". 이상영역은 heatmap_path로 안내. 폴더 QC는 Glob→배치→이상만 표로.
`agents/anomaly-detector.md` — `tools:` 이상탐지 MCP 툴 + Read/Glob만. 정상/이상 판정은 점수·임계값 근거만.

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩**(inferencer 재생성 금지).
2. **heatmap 파일 저장**, 점수만 반환(컨텍스트 보호).
3. **배치 추론**, 손상 이미지 명시적 실패.
4. 디바이스 자동 감지.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <img>` 가 score + is_anomaly + heatmap 경로 JSON 출력.
- [ ] 없는/손상 경로 → 각 error 코드(크래시 없음).
- [ ] `train.py` 가 정상 이미지만으로 `model.ckpt` + `threshold.json` 생성.
- [ ] 반환에 원시 anomaly_map 배열 없음(경로만).
- [ ] MCP inferencer 로딩 1회(warm).
- [ ] 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`anomalib torch pillow mcp`)
2. `dataset/train/good/`에 정상 이미지 → `python engine/train.py`.
3. `python mcp_server.py` → `anomaly-detector` 에이전트에 "이 라인 이미지들 불량 검사".
4. 모델 교체: `ANOMALY_MODEL=efficient_ad`.
