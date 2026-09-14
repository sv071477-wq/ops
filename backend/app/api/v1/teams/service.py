from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import Team, User
from app.schemas.user import TeamCreate, TeamUpdate, TeamResponse


class TeamService:
    def __init__(self, db: Session):
        self.db = db

    def _enrich_team(self, team: Team) -> TeamResponse:
        count = self.db.query(User).filter(User.team_id == team.id, User.is_active == True).count()
        resp = TeamResponse.model_validate(team)
        resp.member_count = count
        return resp

    def list_teams(
        self,
        department: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[TeamResponse]:
        query = self.db.query(Team)
        if department:
            query = query.filter(Team.department.ilike(department.strip()))
        if is_active is not None:
            query = query.filter(Team.is_active == is_active)
        teams = query.order_by(Team.department.asc(), Team.name.asc()).all()
        return [self._enrich_team(t) for t in teams]

    def get_team(self, team_id: UUID) -> TeamResponse:
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        return self._enrich_team(team)

    def create_team(self, team_in: TeamCreate) -> TeamResponse:
        clean_name = team_in.name.strip()
        if not clean_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team name cannot be blank")

        clean_dept = (team_in.department or "Ops").strip()
        if not clean_dept:
            clean_dept = "Ops"

        existing = self.db.query(Team).filter(Team.name.ilike(clean_name)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team with name '{clean_name}' already exists")

        team = Team(
            name=clean_name,
            department=clean_dept,
            description=team_in.description.strip() if team_in.description else None,
            is_active=team_in.is_active
        )
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        return self._enrich_team(team)

    def update_team(self, team_id: UUID, team_in: TeamUpdate) -> TeamResponse:
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        update_data = team_in.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"]:
            clean_name = update_data["name"].strip()
            existing = self.db.query(Team).filter(Team.name.ilike(clean_name), Team.id != team_id).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team with name '{clean_name}' already exists")
            team.name = clean_name

        if "department" in update_data and update_data["department"]:
            team.department = update_data["department"].strip()

        if "description" in update_data:
            team.description = update_data["description"].strip() if update_data["description"] else None

        if "is_active" in update_data and update_data["is_active"] is not None:
            team.is_active = update_data["is_active"]

        self.db.commit()
        self.db.refresh(team)
        return self._enrich_team(team)

    def delete_team(self, team_id: UUID) -> dict:
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        # Unassign users from this team
        self.db.query(User).filter(User.team_id == team_id).update({"team_id": None})
        self.db.delete(team)
        self.db.commit()
        return {"detail": f"Team '{team.name}' successfully deleted"}
