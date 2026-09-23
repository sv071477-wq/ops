import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.models.batch import Entity, Batch

def main():
    db = SessionLocal()
    try:
        # Check current entities
        entities = db.query(Entity).all()
        print("Existing entities:", [(e.id, e.name, e.is_active) for e in entities])

        # Remove "Default" entity if present
        default_entity = db.query(Entity).filter(Entity.name.ilike("default")).first()
        if default_entity:
            # Check if any batch references it
            ref_batches = db.query(Batch).filter(Batch.entity_id == default_entity.id).all()
            print(f"Batches referencing Default: {len(ref_batches)}")
            # Delete Default entity (or hard delete)
            db.delete(default_entity)
            db.commit()
            print("Successfully deleted 'Default' entity.")

        # Add "Unext" and "Unext BSFI"
        new_names = ["Unext", "Unext BSFI"]
        for name in new_names:
            existing = db.query(Entity).filter(Entity.name.ilike(name)).first()
            if not existing:
                new_entity = Entity(name=name, is_active=True, description="Legal Entity")
                db.add(new_entity)
                print(f"Added entity: {name}")
            else:
                existing.is_active = True
                print(f"Entity already exists: {name}")

        db.commit()

        final_entities = db.query(Entity).all()
        print("Final entities:", [(e.id, e.name, e.is_active) for e in final_entities])

    except Exception as e:
        db.rollback()
        print(f"Error updating entities: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
