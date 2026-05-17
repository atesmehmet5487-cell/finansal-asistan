import httpx
import structlog
from datetime import date, datetime, timedelta, timezone

log = structlog.get_logger()


def _parse_dt(val) -> tuple[date, str, bool]:
    """(tarih, saat_str, tam_gun) döndürür."""
    if isinstance(val, datetime):
        if val.tzinfo:
            val = val.astimezone(timezone.utc).replace(tzinfo=None)
        return val.date(), val.strftime("%H:%M"), False
    return val, "", True


async def fetch_calendar_events(ical_url: str, days_ahead: int = 7) -> list[dict]:
    if not ical_url:
        return []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(ical_url)
            resp.raise_for_status()
            raw = resp.content

        import icalendar
        import recurring_ical_events

        cal = icalendar.Calendar.from_ical(raw)
        today = date.today()
        end = today + timedelta(days=days_ahead)

        raw_events = recurring_ical_events.of(cal).between(today, end)

        events = []
        for ev in raw_events:
            dtstart = ev.get("DTSTART")
            if dtstart is None:
                continue
            ev_date, time_str, all_day = _parse_dt(dtstart.dt)

            title = str(ev.get("SUMMARY", "")).strip()
            desc = str(ev.get("DESCRIPTION", "") or "").strip()
            days_from_now = (ev_date - today).days

            events.append({
                "date": ev_date.isoformat(),
                "time": time_str,
                "all_day": all_day,
                "title": title,
                "description": desc[:120] if desc else "",
                "days_from_now": days_from_now,
            })

        events.sort(key=lambda e: (e["date"], e["time"] or "00:00"))
        log.info("calendar_events_fetched", count=len(events))
        return events

    except Exception as e:
        log.error("calendar_fetch_failed", error=str(e))
        return []
