from app.services.excel_ingestion import ExcelIngestionService


class ScheduleFeatureService(ExcelIngestionService):
    """Feature service facade for schedule validation and ingestion."""