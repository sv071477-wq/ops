from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import Team, User
from app.api.v1.teams.repository_interfaces import ITeamRepository


class TeamRepository(ITeamRepository):
    def __init__(self, db: Session):
        self.db = db

    def list_teams(
        self,
        department: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[Team]:
        query = self.db.query(Team)
        if department:
            query = query.filter(Team.department.ilike(department.strip()))
        if is_active is not None:
            query = query.filter(Team.is_active == is_active)
        return query.order_by(Team.department.asc(), Team.name.asc()).all()

    def get_by_id(self, team_id: UUID) -> Optional[Team]:
        return self.db.query(Team).filter(Team.id == team_id).first()

    def get_member_count(self, team_id: UUID) -> int:
        return self.db.query(User).filter(User.team_id == team_id, User.is_active == True).count()

    def create(self, team: Team) -> Team:
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        return team

    def update(
        self,
        team: Team,
        name: Optional[str] = None,
        department: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Team:
        if name is not None:
            team.name = name
        if department is not None:
            team.department = department
        if description is not None:
            team.description = description
        if is_active is not None:
            team.is_active = is_active
        self.db.commit()
        self.db.refresh(team)
        return team

    def delete(self, team: Team) -> None:
        self.db.delete(team)
        self.db.commit()

    def unassign_users(self, team_id: UUID) -> None:
        self.db.query(User).filter(User.team_id == team_id).update({"team_id": None})
        self.db.commit()

    def exists_by_name(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        query = self.db.query(Team).filter(Team.name.ilike(name))
        if exclude_id:
            query = query.filter(Team.id != exclude_id)
        return query.first() is not None