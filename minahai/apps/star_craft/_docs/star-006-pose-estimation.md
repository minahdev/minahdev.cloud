# 자세 추정 에이전트 — OpenPose 대체 · QLoRA 하네스 빌드 스펙

> **용도**: Claude Code용 **빌드 스펙**. 빈 폴더에서 읽히고
> *"이 스펙대로 구현하고 §9 수용 기준을 통과시켜라"* 라고 지시한다.
> 하네스 원칙은 [star-002-observer-agent.md](star-002-observer-agent.md) §0,
> 파인튜닝 공통 규칙은 [star-011-transfer-learning-qlora.md](star-011-transfer-learning-qlora.md).

대상 하드웨어: **RTX 3050 · VRAM 8GB**.

---

## 1. 왜 교체하나 — OpenPose → 현대 포즈 추정

| | OpenPose (원서) | 추천 대체 |
|---|---|---|
| 방식 | PAF 상향식, 무거움 | Top-down ViT / 실시간 RTM |
| 설치 | Caffe 빌드 지옥 | pip 한 줄 |
| 정확도/속도 | 낡음 | ViTPose SOTA · RTMPose 실시간 |
| 8GB | 빡빡 | 여유 |

멀티에이전트에서 실용 1순위는 **YOLO11-pose**(검출+포즈 한 모델, pip 즉시). 정확도 우선은 **ViTPose**, 실시간 다인원은 **RTMPose**.

---

## 2. 추천 모델 (RTX 3050 · 8GB)

| 모델 | 방식 | VRAM | 용도 |
|---|---|---|---|
| `yolo11n-pose.pt` / `yolo11s-pose.pt` (Ultralytics) | 검출+17키포인트 일체형 | 추론 ~3GB / 학습 ~6GB | 기본값. 다인원 즉시 |
| `usyd-community/vitpose-base-simple` (transformers) | top-down ViT | 추론 ~2GB, LoRA 학습 ~6GB | 정확도 우선 |
| RTMPose-m (`rtmlib`/mmpose) | 실시간 | 추론 ~2GB | 고FPS 다인원 |

- 기본 `POSE_MODEL=yolo11n-pose.pt`. COCO 17키포인트.
- ViTPose는 사람 박스(검출기) 필요 → top-down.

---

## 3. 산출물 트리

```
pose-estimator/
├─ engine/
│  ├─ infer.py            # YOLO11-pose warm 추론
│  └─ train.py            # 커스텀 키포인트 파인튜닝(선택)
├─ mcp_server.py
├─ .mcp.json
├─ .claude/skills/pose-estimator/SKILL.md
├─ .claude/agents/pose-estimator.md
├─ artifacts/best.pt
├─ tests/test_infer.py
├─ requirements.txt
└─ README.md
```

---

## 4. 추론 엔진 `engine/infer.py` (기준선)

```python
import os, torch, numpy as np
from ultralytics import YOLO
MODEL = os.environ.get("POSE_MODEL", "yolo11n-pose.pt")
DEVICE = 0 if torch.cuda.is_available() else "cpu"
KP = ["nose","l_eye","r_eye","l_ear","r_ear","l_sho","r_sho","l_elb","r_elb",
      "l_wri","r_wri","l_hip","r_hip","l_knee","r_knee","l_ank","r_ank"]
_state = {}

def load():
    if not _state:
        m = YOLO(MODEL)
        m.predict(np.zeros((640, 640, 3), "uint8"), device=DEVICE, verbose=False)  # 워밍업
        _state["model"] = m
    return _state["model"]

def estimate(path, conf=0.25):
    if not os.path.isfile(path): return {"error": "file_not_found", "path": path}
    r = load().predict(source=path, conf=conf, device=DEVICE, verbose=False)[0]
    people = []
    if r.keypoints is not None:
        for kp in r.keypoints.data:                 # [N,17,3] = x,y,conf
            people.append({KP[i]: [round(float(x), 1), round(float(y), 1), round(float(c), 3)]
                           for i, (x, y, c) in enumerate(kp)})
    return {"path": path, "num_people": len(people), "poses": people}
```

- 대량 좌표를 그대로 흘리되, 스킬에서 각도·자세 라벨로 해석(원시 좌표는 필요 시만).

---

## 5. 파인튜닝 (8GB · 선택)

- COCO 17키포인트로 충분하면 **파인튜닝 불필요**(zero-shot).
- 커스텀 키포인트(예: 장비·동물):
```python
YOLO("yolo11n-pose.pt").train(data="pose.yaml", epochs=100,
                              imgsz=640, batch=8, device=0, amp=True)
```
- ViTPose LoRA 파인튜닝은 star-011 참조.

---

## 6. MCP 툴 계약

- `estimate(path: str, conf: float = 0.25) -> dict` — `{"path","num_people","poses":[{kp:[x,y,c]}]}` / `{"error"}`
- `estimate_batch(paths, conf) -> list[dict]` — 순서 보존
- `model_info() -> dict` — `{"model","device","keypoints"}`

---

## 7. 스킬 + 서브에이전트

`SKILL.md` — 관절 좌표로 **각도/자세 판정**(예: 스쿼트 깊이, 손 들기). conf<0.3 키포인트는 무시. 다인원은 num_people 먼저 보고.
`agents/pose-estimator.md` — `tools:` 포즈 MCP 툴 + Read/Glob만. 좌표는 툴 결과만 사용.

---

## 8. 8GB 최적화 요구사항 (필수)

1. **warm 로딩** + 워밍업.
2. 추론 `half=True`(CUDA), 학습 `amp=True`.
3. **배치 추론**, 저신뢰 키포인트 필터.
4. 디바이스 자동 감지.

---

## 9. 수용 기준 (전부 통과)

- [ ] `python engine/infer.py <img>` 가 num_people + 17키포인트 JSON 출력.
- [ ] 없는 경로 → `file_not_found`.
- [ ] MCP 모델 로딩 1회, warm 확인.
- [ ] 스킬이 좌표 → 자세 라벨(각도) 해석 규칙 포함.
- [ ] 서브에이전트 `tools:` 화이트리스트, `pytest tests/` 통과, README 문서화.

---

## 10. 사용법

1. `pip install -r requirements.txt` (`ultralytics torch numpy mcp`; ViTPose는 `transformers`)
2. `python mcp_server.py` → `pose-estimator` 에이전트에 "이 영상 프레임에서 스쿼트 자세 판정".
3. 커스텀 키포인트만 `train.py`.
