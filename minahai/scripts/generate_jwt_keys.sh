#!/usr/bin/env bash
# RS256 키쌍 생성. 개인키는 auth 컨테이너에만, 공개키는 backend에도.
set -euo pipefail

OUT_DIR="${1:-.}"
openssl genrsa -out "$OUT_DIR/jwt_private.pem" 2048
openssl rsa -in "$OUT_DIR/jwt_private.pem" -pubout -out "$OUT_DIR/jwt_public.pem"

echo "생성 완료:"
echo "  $OUT_DIR/jwt_private.pem → minahai/.env.auth 의 JWT_PRIVATE_KEY 로 (auth 컨테이너 전용)"
echo "  $OUT_DIR/jwt_public.pem  → minahai/.env.backend 의 JWT_PUBLIC_KEY 로 (모든 컨테이너)"
echo ""
echo "멀티라인 env 주입 팁: 개행을 \\n 리터럴로 치환해 한 줄로 넣으면 security.py가 복원한다."
echo "  예) JWT_PRIVATE_KEY=\$(awk 'BEGIN{ORS=\"\\\\n\"}1' $OUT_DIR/jwt_private.pem)"
echo ""
echo "⚠️ .pem 파일은 커밋 금지 (.gitignore 등록됨). .env.auth/.env.backend도 커밋 금지."
