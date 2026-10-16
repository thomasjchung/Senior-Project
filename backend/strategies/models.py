from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Condition:
    indicator: str
    params: dict
    operator: str
    value: Optional[float]


@dataclass
class StrategyConfig:
    name: str
    direction: str              # "long" | "short" | "both"
    position_size_pct: float    # % of capital per trade
    stop_loss_pct: Optional[float]
    take_profit_pct: Optional[float]
    logic: str                  # "AND" | "OR"
    entry_conditions: list[Condition]
    exit_conditions: list[Condition]
    # {"type": "symbol"} (the chart's symbol) or
    # {"type": "scanner", "criteria": {...}, "regular_hours_only": bool}
    universe: dict = field(default_factory=lambda: {"type": "symbol"})

    @classmethod
    def from_dict(cls, d: dict) -> "StrategyConfig":
        return cls(
            name=d["name"],
            direction=d.get("direction", "long"),
            position_size_pct=float(d.get("position_size_pct", 10.0)),
            stop_loss_pct=float(d["stop_loss_pct"]) if d.get("stop_loss_pct") else None,
            take_profit_pct=float(d["take_profit_pct"]) if d.get("take_profit_pct") else None,
            logic=d.get("logic", "AND"),
            entry_conditions=[
                Condition(
                    indicator=c["indicator"],
                    params=c.get("params", {}),
                    operator=c["operator"],
                    value=c.get("value"),
                )
                for c in d.get("entry_conditions", [])
            ],
            exit_conditions=[
                Condition(
                    indicator=c["indicator"],
                    params=c.get("params", {}),
                    operator=c["operator"],
                    value=c.get("value"),
                )
                for c in d.get("exit_conditions", [])
            ],
            universe=d.get("universe") or {"type": "symbol"},
        )
