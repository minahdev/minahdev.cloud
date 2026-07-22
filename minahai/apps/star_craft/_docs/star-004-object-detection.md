# 물체 감지 에이전트 — SSD 대체 · QLoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**. (참고: 이 앱 `resources/yolo_train/runs/best.pt` 이미 YOLO 학습 산출물 존재.)

---

## 1. 왜 교체하나 — SSD → 현대 검출기

| | SSD (원서) | 추천 대체 |
|---|---|---|
| 구조 | 앵커 기반 다중스케일 | 앵커프리 · DETR 계열 |
| 정확도/속도 | 낡음 | YOLO11 / RT-DETR SOTA |
| 신규 클래스 | 재학습 필수 | **Grounding DINO**로 zero-shot(텍스트 프롬프트) |
| 8GB 학습 | 가능하나 번거로움 | YOLO11n/s 파인튜닝 간편 |

에이전트 관점에서 핵심은 **개방어휘(open-vocabulary)**: "빨간 유닛 찾아"를 학습 없이 텍스트로 검출하는 Grounding DINO가 SSD 대비 결정적 이점.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 | 방식 | 학습 VRAM | 용도 |
|---|---|---|---|
| `yolo11n.pt` / `yolo11s.pt` (Ultralytics) | 폐쇄셋 파인튜닝 | n: ~4GB / s: ~6GB (imgsz 640, batch 8) | 정해진 클래스 고속 검출 |
| `PekingU/rtdetr_v2_r18vd` (transformers) | 폐쇄셋 파인튜닝 | ~7GB | NMS-free, 혼잡 장면 |
| `IDEA-Research/grounding-dino-tiny` | **zero-shot** 텍스트 프롬프트 | 추론 ~3GB | 학습 없이 신규 객체 |

- 기본은 **YOLO11**(학습·배포 가장 간편). 신규/가변 대상은 **Grounding DINO 툴 병설**.
- 모델 경로는 `DET_MODEL` 환경변수.

---

## 3. 산출물 트리

```
object-detector/
├─ engine/
│  ├─ infer.py            # warm 추론 (YOLO + 선택적 Grounding DINO)
│  └─ train.py            # YOLO11 파인튜닝 래퍼
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/object-detector/SKILL.md
├─ .claude/agents/object-detector.md
├─ dataset/  data.yaml    # YOLO 포맷 (images/ labels/)
├─ artifacts/best.pt
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, torch
from ultralytics import YOLO
MODEL = os.environ.get("DET_MODEL", "artifacts/best.pt")
DEVICE = 0 if torch.cuda.is_available() else "cpu"
_state = {}

def load():
    if not _state:
        m = YOLO(MODEL)
        m.predict(source=__import__("numpy").zeros((640, 640, 3), "uint8"), device=DEVICE, verbose=False)  # 워밍업
        _state["model"] = m
    return _state["model"]

def detect(path, conf=0.25):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    r = load().predict(source=path, conf=conf, device=DEVICE, verbose=False)[0]
    return {"path": path, "detections": [
        {"label": r.names[int(c)], "conf": round(float(p), 4),
         "box": [round(float(v), 1) for v in b]}
        for b, c, p in zip(r.boxes.xyxy, r.boxes.cls, r.boxes.conf)]}
```

- 개방어휘 툴 `detect_text(path, prompt)` 는 Grounding DINO(`transformers`)로 별도 구현 — 텍스트 프롬프트 → 박스.

---

## 5. 파인튜닝 (8GB · YOLO11)

```python
from ultralytics import YOLO
YOLO("yolo11n.pt").train(data="dataset/data.yaml", epochs=100,
                         imgsz=640, batch=8, device=0, amp=True)  # AMP 필수
# 결과 runs/detect/train/weights/best.pt → artifacts/best.pt 복사
```

- 8GB 팁: `batch=8, imgsz=640, amp=True`. OOM 시 `imgsz=512` 또는 `batch=4`.
- RT-DETR 파인튜닝은 `transformers` Trainer + LoRA(백본) — star-011 참조.

---

## 6. MCP 툴 계약

- `detect(path: str, conf: float = 0.25) -> dict` — `{"path","detections":[{"label","conf","box":[x1,y1,x2,y2]}]}` / `{"error","path"}`
- `detect_batch(paths, conf) -> list[dict]` — 순서 보존
- `detect_text(path: str, prompt: str) -> dict` — Grounding DINO zero-shot(선택 툴)
- `model_info() -> dict` — `{"model","device","classes"}`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — 폐쇄셋은 `detect`, "학습 안 한 새 대상"은 `detect_text`. conf<0.25 필터, 박스 좌표는 xyxy 픽셀.
`agents/object-detector.md` — `tools:`에 `mcp__det__detect, mcp__det__detect_batch, mcp__det__detect_text, mcp__det__model_info, Read, Glob`만. 박스는 반드시 툴 결과만 보고(육안 추정 금지).

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩** + 더미 프레임 워밍업.
2. **AMP** 학습(`amp=True`), 추론 `half=True`(CUDA 시).
3. **배치 추론** — `detect_batch`는 리스트를 한 번에 predict.
4. **imgsz/batch 자동 강등** — CUDA OOM 캐치 시 imgsz 512로 재시도.
5. 디바이스 자동 감지.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <img>` 가 detections JSON(box xyxy) 출력.
- [ ] 없는 경로 → `file_not_found`(크래시 없음).
- [ ] MCP 기동 로그 모델 로딩 1회, warm 확인.
- [ ] `train.py` 가 커스텀 데이터로 `artifacts/best.pt` 생성.
- [ ] `detect_text("...prompt...")` 가 미학습 대상도 박스 반환(Grounding DINO 연결 시).
- [ ] 서브에이전트 `tools:` 화이트리스트 준수.
- [ ] `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`ultralytics transformers torch pillow mcp`)
2. 폐쇄셋: `dataset/` YOLO 포맷 → `python engine/train.py` → `artifacts/best.pt`.
3. `python mcp_server.py` → `object-detector` 에이전트에 "이 이미지에서 X 찾아" 지시.
4. 개방어휘: 학습 없이 `detect_text(img, "red marine . command center .")`.
