"""소셜 로그인(OAuth 2.0) — 네이버·카카오·구글.

secom_users에 `user_id = "{provider}_{uid}"` 형태로 upsert한다(마이그레이션 없음).
provider별 client_id/secret은 환경변수로만 주입한다(커밋 금지).
"""
