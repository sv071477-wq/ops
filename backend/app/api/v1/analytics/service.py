from app.services.analytics import AnalyticsService as LegacyAnalyticsService


class AnalyticsFeatureService(LegacyAnalyticsService):
    """Feature service for dashboard metrics and MBR exports."""