from app.services.fms_sync import FmsSyncService as LegacyFmsSyncService


class FmsSyncFeatureService(LegacyFmsSyncService):
    """Feature service for external FMS synchronization."""