# 1. Node.js 기반 이미지 가져오기
FROM node:24.15.0-slim

# 2. pnpm 글로벌 설치
RUN npm install -g pnpm

# 3. 도커 내부에 작업할 폴더 만들기
WORKDIR /app

# 4. 패키지 파일들 먼저 복사 후 설치
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# 5. 나머지 모든 소스코드 복사
COPY . .

# 6. Next.js 빌드 및 실행 (3000 포트)
RUN pnpm build
CMD ["pnpm", "start", "-p", "3000"]
