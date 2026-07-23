"""마이페이지 코드 ↔ DB 라벨 변환 (최소 구현)."""

from __future__ import annotations

GENDER_LABELS: dict[str, str] = {
    "male": "남성",
    "female": "여성",
}

EXPERIENCE_LABELS: dict[str, str] = {}
FAVORITE_EXERCISE_LABELS: dict[str, str] = {}
WEEKLY_GOAL_LABELS: dict[str, str] = {}

# 건강 특이사항 — 민감정보. 'none'(해당 없음)은 다른 항목과 함께 선택될 수 없다.
HEALTH_FLAG_LABELS: dict[str, str] = {
    "none": "해당 없음",
    "diabetes": "당뇨",
    "pregnant": "임신·임산부",
    "medication": "상시 복용약",
    "smoking": "흡연",
    "drinking": "음주",
}


def health_flag_to_label(value: str) -> str:
    return HEALTH_FLAG_LABELS.get(value, value)


def _to_code(value: str, labels: dict[str, str]) -> str:
    if value in labels:
        return value
    for code, label in labels.items():
        if label == value:
            return code
    return value


def _to_label(value: str, labels: dict[str, str]) -> str:
    return labels.get(value, value)


def gender_to_code(value: str) -> str:
    return _to_code(value, GENDER_LABELS)


def gender_to_label(value: str) -> str:
    return _to_label(value, GENDER_LABELS)


def experience_to_code(value: str) -> str:
    return _to_code(value, EXPERIENCE_LABELS)


def experience_to_label(value: str) -> str:
    return _to_label(value, EXPERIENCE_LABELS)


def favorite_exercise_to_code(value: str) -> str:
    return _to_code(value, FAVORITE_EXERCISE_LABELS)


def favorite_exercise_to_label(value: str) -> str:
    return _to_label(value, FAVORITE_EXERCISE_LABELS)


def weekly_goal_to_code(value: str) -> str:
    return _to_code(value, WEEKLY_GOAL_LABELS)


def weekly_goal_to_label(value: str) -> str:
    return _to_label(value, WEEKLY_GOAL_LABELS)
