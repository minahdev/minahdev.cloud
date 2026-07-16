# Docker 운영 규칙 (minahai)

Claude·Cursor 등 코딩 보조 LLM이 이 저장소에서 **도커 컨테이너·DB·백엔드·볼륨**을 다룰 때 따르는 규칙.
전역 행동 원칙은 [루트 CLAUDE.md](../../CLAUDE.md), 백엔드 규칙은 [minahai/_docs/CLAUDE.md](CLAUDE.md) 참고.

---

## 1. 생성 전 기존 리소스 확인 → 승인 (필수)

> **"DB를 만들어라 / 백엔드를 띄워라 / 컨테이너를 생성하라"** 는 요청을 받아도,
> **무조건 먼저 기존 리소스를 확인**한다. 같은 용도의 것이 이미 있으면 **조용히 새로 만들지 않고**,
> 발견 사실을 보고하고 **사용자 승인을 받은 뒤에만** 생성·재생성한다.

### 절차

1. **생성 전 반드시 확인**한다:
   - `docker ps -a` — 같은 이름·이미지의 컨테이너 (실행·중지 포함)
   - `docker volume ls` — 같은 데이터 볼륨 (`pgvector_data`, `neo4j_data`, `redis_data`, `n8n_data`, `pgadmin_data`)
   - `docker images` — 같은 이미지 (`minahdevcloud-backend`, `pgvector/pgvector`, `neo4j:5` 등)

2. **이미 존재하면** → 새로 만들지 말고 다음을 보고한다:
   - 무엇이 이미 있는지 (이름·이미지·상태·생성일)
   - 후보 제시: **① 기존 것 재사용** / **② 지우고 재생성** / **③ 그대로 둠**

3. **사용자 승인 후에만** 생성·재생성한다. 승인 없이 중복 생성 금지.

### 이유

같은 DB·백엔드를 중복 생성하면 **포트 충돌·데이터 볼륨 분산·유령 컨테이너**가 쌓인다.
(실제 사례: `neo4j:5`·`redis:7`·`pgvector`·백엔드 컨테이너가 compose본 + 구버전으로 **중복 생성**되어 `docker ps -a`가 지저분해짐.)

---

## 2. 삭제도 승인 필수

컨테이너·볼륨·이미지 삭제는 되돌리기 어렵다. 삭제 **전에**:

1. 대상이 **코드/compose에서 실제로 쓰이는지** 확인한다:
   - `grep -rniE '<이름>' minahai --include=*.py`
   - `docker-compose.yaml`의 `depends_on`·`environment`(웹훅 URL 등) 참조
2. 삭제로 **깨질 기능**을 보고한다.
   - 예) `neo4j` 삭제 → star_craft 온톨로지 그래프 기능 중단
   - 예) `n8n` 삭제 → comm_agent 이메일/텔레그램 전송·admin 기능 중단
3. 볼륨(`*_data`) 삭제는 **데이터 영구 손실**임을 명시하고 별도 승인받는다.
4. 승인 후에만 `docker rm` / `docker volume rm` / `docker rmi` 실행.

### 안전하게 정리 가능한 대상 (그래도 보고 후 진행)

- `hello-world` 테스트 컨테이너, 중복된 구버전 Exited 컨테이너 등 **어떤 기능도 참조하지 않는** 잔여물.

---

## 3. 표준 실행 방식

- 백엔드·DB 스택은 **docker-compose로 관리**한다 (`build: ./minahai`로 로컬 빌드 → `minahdevcloud-backend`).
  - Docker Hub의 미리 push된 이미지(`mingddu7427/minahai:latest` 등)로 **직접 `docker run` 하지 않는다.**
- `ollama`는 도커가 아니라 **호스트에서** 실행하고, 백엔드가 `host.docker.internal:11434`로 접속한다 (설계). 자세한 건 코치 챗 로컬 실행 규칙 참고.
