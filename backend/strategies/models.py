from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Condition:
    indicator: str
    params: dict
    operator: str
    value: Optional[float]


@dataclass
class Rule:
    type: str       # a key of backtest.setups.RULE_PARAMS
    params: dict


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
    style: Optional[str] = None                      # template it was started from (display only)
    entry_rules: list[Rule] = field(default_factory=list)  # pattern rules, all must hold
    entry_trigger: str = "close"                     # "close" | "break_high" | "confirmed_break"
    stop_type: str = "percent"                       # "percent" | "pullback_low" | "signal_low"
    reward_risk: Optional[float] = None              # take profit at N× the risk; overrides take_profit_pct
    exit_end_of_day: bool = False                    # flat by each day's last candle (intraday)
    max_risk_pct: Optional[float] = None             # skip setups whose stop is further than this below entry

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
            style=d.get("style"),
            entry_rules=[Rule(type=r["type"], params=r.get("params") or {}) for r in d.get("entry_rules") or []],
            entry_trigger=d.get("entry_trigger") or "close",
            stop_type=d.get("stop_type") or "percent",
            reward_risk=float(d["reward_risk"]) if d.get("reward_risk") else None,
            exit_end_of_day=bool(d.get("exit_end_of_day", False)),
            max_risk_pct=float(d["max_risk_pct"]) if d.get("max_risk_pct") else None,
        )
