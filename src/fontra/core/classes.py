from __future__ import annotations

from dataclasses import dataclass, field, fields, is_dataclass
from functools import partial
from typing import Optional, get_args, get_type_hints
import sys
import dacite
from .packedpath import PackedPath, PointType


@dataclass(kw_only=True)
class Transformation:
    translateX: float = 0
    translateY: float = 0
    rotation: float = 0
    scaleX: float = 1
    scaleY: float = 1
    skewX: float = 0
    skewY: float = 0
    tCenterX: float = 0
    tCenterY: float = 0


Location = dict[str, float]


@dataclass
class Component:
    name: str
    transformation: Transformation = field(default_factory=Transformation)
    location: Location = field(default_factory=Location)


@dataclass
class StaticGlyph:
    path: PackedPath = field(default_factory=PackedPath)
    components: list[Component] = field(default_factory=list)
    xAdvance: Optional[float] = None
    yAdvance: Optional[float] = None
    verticalOrigin: Optional[float] = None


@dataclass
class Source:
    name: str
    layerName: str
    location: Location = field(default_factory=Location)


@dataclass
class Layer:
    name: str
    glyph: StaticGlyph


@dataclass
class LocalAxis:
    name: str
    minValue: float
    defaultValue: float
    maxValue: float


@dataclass
class VariableGlyph:
    name: str
    axes: list[LocalAxis] = field(default_factory=list)
    unicodes: list[int] = field(default_factory=list)
    sources: list[Source] = field(default_factory=list)
    layers: list[Layer] = field(default_factory=list)


@dataclass
class GlobalAxis:
    name: str
    tag: str
    minValue: float
    defaultValue: float
    maxValue: float
    mapping: list[tuple[int, int]] = field(default_factory=list)


def makeSchema(*classes, schema=None):
    if schema is None:
        schema = {}
    for cls in classes:
        if cls in schema:
            continue
        cls_globals = vars(sys.modules[cls.__module__])
        classFields = {}
        schema[cls] = classFields
        for name, tp in get_type_hints(cls, cls_globals).items():
            fieldDef = dict(type=tp)
            if is_dataclass(tp):
                makeSchema(tp, schema=schema)
            elif tp.__name__ == "Optional":
                [subtype, _] = get_args(tp)
                fieldDef["type"] = subtype
                fieldDef["optional"] = True
                if is_dataclass(subtype):
                    makeSchema(subtype, schema=schema)
            elif tp.__name__ == "list":
                [subtype] = get_args(tp)
                fieldDef["subtype"] = subtype
                if is_dataclass(subtype):
                    makeSchema(subtype, schema=schema)
            classFields[name] = fieldDef
    return schema


def classesToStrings(schema):
    return {
        cls.__name__: {
            fieldName: {
                k: v.__name__ if hasattr(v, "__name__") else v
                for k, v in fieldDef.items()
            }
            for fieldName, fieldDef in classFields.items()
        }
        for cls, classFields in schema.items()
    }


classesSchema = makeSchema(VariableGlyph)


_castConfig = dacite.Config(cast=[PointType])
from_dict = partial(dacite.from_dict, config=_castConfig)


if __name__ == "__main__":
    import json

    schema = classesToStrings(classesSchema)
    print("// This file is generated, don't edit!")
    print("const classesSchema =", json.dumps(schema, indent=2))
