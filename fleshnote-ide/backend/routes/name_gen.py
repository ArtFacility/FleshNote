import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from tools.name_gen import (
    generate_name,
    list_presets,
    list_origins,
    NameGenConfig
)
from tools.name_gen.locations import generate_location_name, LocationNameGenConfig

router = APIRouter(prefix="/api/name-gen", tags=["name_gen"])

class NameGenRequest(BaseModel):
    project_path: str
    count: int = 5
    config: dict

class SimpleRequest(BaseModel):
    project_path: str

@router.post("/generate")
def generate_names(request: NameGenRequest):
    try:
        cfg = NameGenConfig.from_dict(request.config)
        names = []
        count = max(1, min(request.count, 20))
        
        # Always generate 2 names without special characters at the end (if generating enough)
        simple_count = 2 if count >= 3 else 0
        normal_count = count - simple_count

        for _ in range(normal_count):
            name = generate_name(cfg)
            names.append(name)
            
        if simple_count > 0:
            import dataclasses
            simple_cfg = NameGenConfig.from_dict(dataclasses.asdict(cfg))
            simple_cfg.disable_specials = True
            simple_cfg.allow_special_vowels = False
            simple_cfg.allow_special_consonants = False
            for _ in range(simple_count):
                names.append(generate_name(simple_cfg))
            
        return {"status": "success", "names": names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-location")
def generate_location_names(request: NameGenRequest):
    try:
        cfg = LocationNameGenConfig(**request.config)
        names = set()
        # Generate requested number of names, use a set to ensure uniqueness since permutations can overlap easily
        attempts = 0
        while len(names) < request.count and attempts < 50:
            name = generate_location_name(cfg)
            if name and name != "Unknown":
                names.add(name)
            attempts += 1
            
        return {"status": "success", "names": list(names)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/presets")
def get_presets(request: SimpleRequest):
    try:
        presets = list_presets()
        return {"status": "success", "presets": presets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/origins")
def get_origins(request: SimpleRequest):
    try:
        origins = list_origins()
        return {"status": "success", "origins": origins}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
