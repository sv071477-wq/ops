from app.services.auth import AuthService as LegacyAuthService


class AuthFeatureService(LegacyAuthService):
    """Feature service facade; repository extraction can evolve independently."""