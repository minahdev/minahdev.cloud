"""RBAC — 이 프로젝트 역할 체계(user=회원 / coach / admin)와 일치.

role→permission 매핑은 라우터 게이팅(RoleChecker)과 별개로, 세분화된 권한 검사가
필요할 때 참조한다. admin은 모든 권한을 포함한다.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    USER = "user"   # 회원
    COACH = "coach"
    ADMIN = "admin"


class Permission(str, Enum):
    SCHEDULE_MANAGE = "schedule:manage"   # 초대코드·접근암호·회원목록
    NOTICE_WRITE = "notice:write"
    MEMBER_VIEW = "member:view"


# role → 보유 권한 집합
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.USER: set(),
    Role.COACH: {Permission.SCHEDULE_MANAGE, Permission.MEMBER_VIEW},
    Role.ADMIN: {Permission.SCHEDULE_MANAGE, Permission.MEMBER_VIEW, Permission.NOTICE_WRITE},
}


def permissions_for(roles: list[str]) -> set[Permission]:
    result: set[Permission] = set()
    for r in roles:
        try:
            result |= ROLE_PERMISSIONS.get(Role(r), set())
        except ValueError:
            continue
    return result
