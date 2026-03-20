from urllib.parse import unquote

from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from asgiref.sync import sync_to_async


class JWTAuthMiddleware(BaseMiddleware):
    """
    Authenticate WebSocket connections using a `token` querystring parameter.

    Frontend passes: ws://.../ws/monitor/<id>/?token=<access_token>
    """

    async def __call__(self, scope, receive, send):
        # Default to anonymous unless we can validate the JWT.
        scope["user"] = AnonymousUser()

        query_string = scope.get("query_string", b"")
        query_str = query_string.decode(errors="ignore")

        # Robust query parsing: avoid `parse_qs` quirks that can alter base64-like values.
        token = None
        for part in query_str.split("&"):
            if part.startswith("token="):
                token = unquote(part[len("token=") :])
                break

        # Accept "Bearer <token>" if a client ever passes it that way.
        if token and token.startswith("Bearer "):
            token = token[len("Bearer ") :]

        if token:
            jwt_auth = JWTAuthentication()
            try:
                # JWTAuthentication methods are synchronous (and may hit DB),
                # so we must run them in a thread when inside async middleware.
                validated_token = await sync_to_async(jwt_auth.get_validated_token)(token)
                scope["user"] = await sync_to_async(jwt_auth.get_user)(validated_token)
            except Exception as e:
                # Invalid/expired token -> anonymous
                # Log the reason to backend console to troubleshoot WSREJECT loops.
                try:
                    token_preview = token[:10] + "..." if len(token) > 10 else token
                except Exception:
                    token_preview = "<unavailable>"
                print(
                    f"[WS JWT] token validation failed: {type(e).__name__}: {e} (len={len(token)} preview={token_preview})"
                )
                scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)

