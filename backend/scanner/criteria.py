from dataclasses import dataclass, fields
from typing import Optional


@dataclass
class ScanCriteria:
    """User-defined stock filter. Every threshold is optional; None means "don't filter"."""
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_change_pct: Optional[float] = None   # % change vs the previous day's close
    min_rvol: Optional[float] = None         # day volume (so far) / average daily volume
    min_volume: Optional[float] = None       # day volume (so far), shares
    max_float: Optional[float] = None        # shares available to trade
    avg_volume_days: int = 30                # trading days in the relative-volume average
    include_unknown_float: bool = False      # keep stocks whose float can't be found

    @classmethod
    def from_dict(cls, d: dict | None) -> "ScanCriteria":
        d = d or {}
        kwargs = {}
        for f in fields(cls):
            if d.get(f.name) is None:
                continue
            if f.name == "include_unknown_float":
                kwargs[f.name] = bool(d[f.name])
            elif f.name == "avg_volume_days":
                kwargs[f.name] = int(d[f.name])
            else:
                kwargs[f.name] = float(d[f.name])
        return cls(**kwargs)

    def to_dict(self) -> dict:
        return {f.name: getattr(self, f.name) for f in fields(self)}

    def needs_float(self) -> bool:
        return self.max_float is not None

    def passes(self, price: float, change_pct: float, volume: float, rvol: float | None) -> bool:
        """Checks every criterion except float."""
        if self.min_price is not None and price < self.min_price:
            return False
        if self.max_price is not None and price > self.max_price:
            return False
        if self.min_change_pct is not None and change_pct < self.min_change_pct:
            return False
        if self.min_volume is not None and volume < self.min_volume:
            return False
        if self.min_rvol is not None and (rvol is None or rvol < self.min_rvol):
            return False
        return True

    def passes_float(self, float_shares: float | None) -> bool:
        if self.max_float is None:
            return True
        if float_shares is None:
            return self.include_unknown_float
        return float_shares <= self.max_float


def validate_criteria(d: dict | None) -> list[str]:
    errors = []
    try:
        c = ScanCriteria.from_dict(d)
    except (TypeError, ValueError):
        return ["criteria values must be numbers"]
    for name in ("min_price", "max_price", "min_rvol", "min_volume", "max_float"):
        v = getattr(c, name)
        if v is not None and v < 0:
            errors.append(f"{name} must not be negative")
    if c.min_price is not None and c.max_price is not None and c.min_price > c.max_price:
        errors.append("min_price must not exceed max_price")
    if not 1 <= c.avg_volume_days <= 250:
        errors.append("avg_volume_days must be between 1 and 250")
    return errors
