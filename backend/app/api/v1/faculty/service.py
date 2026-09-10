from app.services.faculty import FacultyService as LegacyFacultyService


class FacultyFeatureService(LegacyFacultyService):
    """Feature service for faculty directory and utilization."""