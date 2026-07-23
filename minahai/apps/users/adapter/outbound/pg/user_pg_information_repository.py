import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.field_crypto import decrypt_field, encrypt_field, is_encrypted
from users.app.labels import (
    EXPERIENCE_LABELS,
    FAVORITE_EXERCISE_LABELS,
    GENDER_LABELS,
    WEEKLY_GOAL_LABELS,
    experience_to_code,
    experience_to_label,
    favorite_exercise_to_code,
    favorite_exercise_to_label,
    gender_to_code,
    gender_to_label,
    health_flag_to_label,
    weekly_goal_to_code,
    weekly_goal_to_label,
)
from users.adapter.inbound.api.schemas.mypage_schema import (
    MyPageProfileResponse,
    MyPageProfileSchema,
)
from users.app.dtos.user_information_dto import UserInformation
from users.app.dtos.user_dto import User
from users.app.ports.output.mypage_repository import MyPageRepository

logger = logging.getLogger(__name__)


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part for part in (p.strip() for p in value.split(",")) if part]


class UserInformationRepository(MyPageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _find_user(self, login_user_id: str) -> User | None:
        result = await self._session.execute(select(User).where(User.user_id == login_user_id))
        return result.scalar_one_or_none()

    async def find_by_login_user_id(self, login_user_id: str) -> UserInformation | None:
        user = await self._find_user(login_user_id)
        if user is None:
            return None

        stmt = select(UserInformation).where(UserInformation.user_id == user.id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    def _to_profile_response(
        self, row: UserInformation, login_user_id: str, nickname: str | None
    ) -> MyPageProfileResponse:
        experience_code = experience_to_code(row.exercise_experience)
        weekly_goal_code = weekly_goal_to_code(row.weekly_goal)
        favorite_code = favorite_exercise_to_code(row.favorite_exercise)
        gender_code = gender_to_code(row.gender)
        gender_api = gender_code if gender_code in GENDER_LABELS else None

        # 민감 필드 복호화. 암호문인데 결과가 비면 키가 없거나 틀린 것.
        flags_plain = decrypt_field(row.health_flags)
        note_plain = decrypt_field(row.health_note)
        unreadable = (is_encrypted(row.health_flags) and not flags_plain) or (
            is_encrypted(row.health_note) and not note_plain
        )

        exercises = _split_csv(row.favorite_exercises)
        if not exercises and favorite_code:
            exercises = [favorite_code]  # 복수선택 도입 전 데이터 호환
        health_flags = _split_csv(flags_plain)

        return MyPageProfileResponse(
            userId=login_user_id,
            name=row.full_name,
            nickname=nickname,
            gender=gender_api,
            genderLabel=GENDER_LABELS.get(gender_code or "", row.gender or ""),
            birthDate=row.birth_date,
            phone=row.phone,
            heightCm=row.height_cm,
            weightKg=row.weight_kg,
            favoriteExercise=favorite_code,
            favoriteExercises=exercises,
            favoriteExerciseOther=row.favorite_exercise_other or "",
            experience=experience_code,
            weeklyGoal=weekly_goal_code,
            experienceLabel=EXPERIENCE_LABELS.get(experience_code or "", row.exercise_experience),
            weeklyGoalLabel=WEEKLY_GOAL_LABELS.get(weekly_goal_code or "", row.weekly_goal),
            favoriteExerciseLabel=FAVORITE_EXERCISE_LABELS.get(
                favorite_code or "", row.favorite_exercise
            ),
            healthFlags=health_flags,
            healthFlagLabels=[health_flag_to_label(f) for f in health_flags],
            healthNote=note_plain,
            healthUnreadable=unreadable,
        )

    async def get_profile(self, login_user_id: str) -> MyPageProfileResponse | None:
        row = await self.find_by_login_user_id(login_user_id)
        if row is None:
            return None
        user = await self._find_user(login_user_id)
        return self._to_profile_response(row, login_user_id, user.nickname if user else None)

    async def save_profile(self, profile: MyPageProfileSchema) -> None:
        logger.info("[UserInformationRepository] save_profile | userId=%s", profile.userId)

        user = await self._find_user(profile.userId)
        if user is None:
            raise ValueError("사용자를 찾을 수 없습니다.")

        row = await self.find_by_login_user_id(profile.userId)
        if row is None:
            row = UserInformation(user_id=user.id)
            self._session.add(row)

        # 닉네임 SSOT는 secom_users.nickname — 여기서 동기화한다(빈 값이면 기존 유지).
        if profile.nickname.strip():
            user.nickname = profile.nickname.strip()

        exercises = [e for e in profile.favoriteExercises if e]
        health_flags = [f for f in profile.healthFlags if f]
        # '해당 없음'은 배타 — 다른 항목과 같이 오면 나머지를 버린다.
        if "none" in health_flags:
            health_flags = ["none"]

        row.full_name = profile.name
        row.gender = gender_to_label(profile.gender)
        row.birth_date = profile.birthDate
        row.phone = profile.phone or None
        row.height_cm = profile.heightCm
        row.weight_kg = profile.weightKg
        row.favorite_exercises = ",".join(exercises) or None
        # 기존 단일 컬럼도 계속 채워 예전 조회 경로가 깨지지 않게 한다.
        row.favorite_exercise = (
            favorite_exercise_to_label(exercises[0]) if exercises else None
        )
        row.favorite_exercise_other = profile.favoriteExerciseOther or None
        row.exercise_experience = experience_to_label(profile.experience)
        row.weekly_goal = weekly_goal_to_label(profile.weeklyGoal)
        row.health_flags = encrypt_field(",".join(health_flags))
        row.health_note = encrypt_field(profile.healthNote)

        await self._session.commit()
        logger.info("[UserInformationRepository] save_profile 완료 | userId=%s", profile.userId)
