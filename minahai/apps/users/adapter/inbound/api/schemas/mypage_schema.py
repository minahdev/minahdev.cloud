from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GenderCode = Literal["male", "female"]


class MyPageProfileSchema(BaseModel):
    """마이페이지 프로필 — secom_users 확장 컬럼."""

    model_config = ConfigDict(populate_by_name=True)

    userId: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=64)
    nickname: str = Field(default="", max_length=64)
    gender: GenderCode
    birthDate: str = Field(..., min_length=8, max_length=8)
    # 연락처는 선택 입력 — 미입력 허용.
    phone: str = Field(default="", max_length=32)
    heightCm: float = Field(..., gt=0, le=300)
    weightKg: float = Field(..., gt=0, le=500)
    # 복수 선택. favoriteExercise(단일)는 응답 호환용이라 요청에서는 받지 않는다.
    favoriteExercises: list[str] = Field(default_factory=list, max_length=16)
    favoriteExerciseOther: str = Field(default="", max_length=128)
    experience: str = Field(..., max_length=32)
    weeklyGoal: str = Field(..., max_length=32)
    # ↓ 민감 건강정보 — 저장 시 암호화된다.
    healthFlags: list[str] = Field(default_factory=list, max_length=16)
    healthNote: str = Field(default="", max_length=2000)


class MyPageProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    userId: str
    name: str | None = None
    nickname: str | None = None
    gender: GenderCode | None = None
    genderLabel: str | None = None
    birthDate: str | None = None
    phone: str | None = None
    heightCm: float | None = None
    weightKg: float | None = None
    favoriteExercise: str | None = None
    favoriteExercises: list[str] = Field(default_factory=list)
    favoriteExerciseOther: str | None = None
    experience: str | None = None
    weeklyGoal: str | None = None
    experienceLabel: str | None = None
    weeklyGoalLabel: str | None = None
    favoriteExerciseLabel: str | None = None
    healthFlags: list[str] = Field(default_factory=list)
    healthFlagLabels: list[str] = Field(default_factory=list)
    healthNote: str | None = None
    # 암호문인데 키가 없거나 틀려 복호화하지 못한 경우 True — UI가 "읽을 수 없음"을 표시한다.
    healthUnreadable: bool = False
    message: str = "ok"
