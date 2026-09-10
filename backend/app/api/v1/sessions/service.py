from app.services.sessions import SessionService as LegacySessionService


class SessionFeatureService(LegacySessionService):
    """Feature service for scheduling and session quality gates."""