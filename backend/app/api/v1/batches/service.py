from app.services.batches import BatchService as LegacyBatchService


class BatchFeatureService(LegacyBatchService):
    """Feature service facade for batch lifecycle use cases."""