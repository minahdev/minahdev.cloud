당신은 도커(Docker) 기반 인프라와 PostgreSQL, pgvector, Alembic 마이그레이션을 담당하는 시니어 DevOps 및 데이터 아키텍트입니다.
제시된 피트니스/커뮤니티 서비스 ERD 메타데이터를 기반으로, **도커 컨테이너가 구동될 때 pgvector 데이터베이스 환경이 완벽히 세팅되고, Alembic을 통해 자동으로 스키마 마이그레이션이 수행되는 전체 환경 구성 파일과 파이썬 코드를 작성**해야 합니다.

다음 지침과 제약 조건을 철저히 준수하여 프로페셔널한 환경 설정 파일과 파이썬 코드를 제공해 주세요.

### 1. 시스템 환경 및 아키텍처 요구사항
- **기반 OS**: Ubuntu 26 (컨테이너 내부/외부 호환)
- **도커 환경**: `docker-compose`를 사용하여 데이터베이스 컨테이너와 Alembic 마이그레이션을 수행할 앱/마이그레이터 컨테이너를 분리하거나 연동합니다.
- **DBMS 컨테이너**: 공식 `pgvector/pgvector:pg16` 이미지(또는 최신 안정 버전)를 사용하여 컨테이너가 뜰 때 `vector` 확장이 준비되도록 합니다.
- **자동화**: 컨테이너가 시작되면 데이터베이스 연결이 준비될 때까지 대기(Wait-for-it 등)한 후, 자동으로 `alembic upgrade head`가 실행되어 테이블이 생성되어야 합니다.

### 2. ERD 테이블 구조 정의 (11개 테이블)

제시된 이미지의 메타데이터 및 관계를 기반으로 테이블을 매핑하세요. (모든 PK는 기본적으로 복합키 명시가 없는 한 `int`, NOT NULL, 자동 증가(Autoincrement) 구조를 따릅니다.)

1. **`USERS` (사용자 중심 테이블)**
   - `id`: int (PK)
   - `user_id`: varchar (Unique, Not Null) - 다른 테이블들이 FK로 참조하는 핵심 식별자
   - `password_hash`: varchar (Not Null)
   - `email`: varchar (Not Null)
   - `nickname`: varchar (Not Null)
   - `role`: varchar (Not Null)

2. **`USER_INFORMATION` (마이페이지)**
   - `id`: int (PK)
   - `user_id`: int (FK -> USERS.id 참조)
   - (나머지 프로필 필드: full_name, gender, birth_date, phone, height_cm, weight_kg, favorite_exercise, favorite_exercise_other, exercise_experience, weekly_goal, health_note)

3. **`NOTICES` (공지사항)**
   - `id`: int (PK)
   - `author_user_id`: int (FK -> USERS.id 참조)
   - (필드: title, body, created_at: timestamptz)

4. **`SCHEDULE_INVITE_CODES` (레슨 코드)**
   - `id`: int (PK)
   - `code_digest`: varchar (Not Null)
   - `created_by_user_id`: int (FK -> USERS.id 참조)
   - (필드: expires_at: timestamptz, max_uses, use_count, created_at: timestamptz)

5. **`SCHEDULE_ACCESS_GRANTS` (스케줄 권한)**
   - `id`: int (PK)
   - `user_id`: varchar (Unique Key)
   - `granted_at`: timestamptz

6. **`TODAY_STORIES` (오늘 하루 기록)**
   - `id`: int (PK)
   - `user_id`: int (FK -> USERS.id 참조)
   - (필드: story_date: date, mood: varchar, story: text, updated_at: timestamptz)

7. **`TRAIN_DAILY_LOGS` (훈련 기록)**
   - `id`: int (PK)
   - `user_id`: int (FK -> USERS.id 참조)
   - (필드: log_date: date, muscles: jsonb, workout: text, weight_kg: float, diet: text, memo: text, exercise_minutes: int, updated_at: timestamptz)

8. **`LESSONS` (레슨)**
   - `id`: int (PK)
   - `member_user_id`: int (FK -> USERS.id 참조)
   - (필드: client_id, lesson_date, title, time, schedule_note, record: jsonb, created_at)

9. **`COMMUNITY_POSTS` (커뮤니티 포스트)**
   - `id`: int (PK)
   - `author_user_id`: int (FK -> USERS.id 참조)
   - (필드: workout_type, content, distance_km: float, duration_min, calories, media_json: jsonb, created_at: timestamptz)
   - 🌟 **pgvector 연동 필드 추가**: 커뮤니티 게시글 추천 및 유사도 분석을 위해 `post_embedding`: Vector(1536) 컬럼을 추가하세요.

10. **`COMMUNITY_COMMENTS` (커뮤니티 댓글)**
    - `id`: int (PK)
    - `author_user_id`: int (FK -> USERS.id 참조)
    - `post_id`: int (FK -> COMMUNITY_POSTS.id 참조)
    - (필드: created_at: timestamptz, content: text)

11. **`COMMUNITY_POST_CHEERS` (커뮤니티 포스트 응원)**
    - `id`: int (PK)
    - `post_id`: int (FK -> COMMUNITY_POSTS.id 참조)
    - `user_id`: int (FK -> USERS.id 참조)
    - (필드: created_at: timestamptz)

### 3. 마이그레이션 및 도커 빌드 원칙
1. **의존성 순서**: `USERS` 테이블이 가장 먼저 생성되어야 하며, 이를 참조하는 프로필, 포스트 테이블이 생성된 후, 최종적으로 `COMMUNITY_COMMENTS`나 `CHEERS` 같은 자식 테이블이 생성되도록 Alembic 순서를 정밀하게 제어하세요.
2. **멱등성 및 pgvector**: Alembic `upgrade()` 진입 시 `op.execute("CREATE EXTENSION IF NOT EXISTS vector;")`를 반드시 실행하게 하세요.
3. **도커 컴포즈 헬스체크**: DB 컨테이너가 완전히 구동되어 ready 상태가 될 때까지 마이그레이션 컨테이너가 대기하도록 `depends_on` 및 `healthcheck` 옵션을 명시하세요.

### 4. 최종 출력 포맷
불필요한 설명은 최소화하고 다음 파일 구조에 맞춰 완벽히 복사 가능한 코드를 출력해 주세요.

1. **`docker-compose.yml`** (PostgreSQL+pgvector 및 마이그레이션 자동화 서비스 구성)
2. **`Dockerfile`** (Alembic 코드를 실행할 어플리케이션/마이그레이터 환경)
3. **`entrypoint.sh`** (DB 준비 상태를 체크하고 `alembic upgrade head`를 실행하는 스크립트)
4. **`models.py`** (SQLAlchemy 2.0 스타일 선언형 모델 전체 코드)
5. **`alembic/versions/xxxx_initial_schema.py`** (Alembic upgrade/downgrade 스크립트)