"""
Podcast Invite Intelligence Layer — admin only.
Reads existing advisory + dinner data to rank potential podcast guests.
No public endpoints. No AI. Deterministic scoring, transparent breakdowns.
"""
import uuid
from datetime import datetime, timezone
from collections import Counter
from itertools import combinations
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()
_NOW = lambda: datetime.now(timezone.utc).isoformat()

# ─── Topic taxonomy ───────────────────────────────────────────────────────────

CATEGORIES = [
    "Finance & Fundraising",
    "Legal & Compliance",
    "Marketing & Brand",
    "Operations & Scale",
    "Technology & Product",
    "Strategy & Growth",
    "People & Culture",
    "Sales & Distribution",
    "Media & Communications",
    "International Expansion",
]

KEYWORD_MAP = {
    "Finance & Fundraising":  ["finance", "funding", "investor", "vc", "venture", "fundrais", "cfo", "investment", "capital", "equity", "fund", "banking", "pe", "angel"],
    "Legal & Compliance":     ["legal", "lawyer", "attorney", "compliance", "regulatory", "law", "counsel", "ip", "patent", "trademark", "contract", "advocate"],
    "Marketing & Brand":      ["marketing", "brand", "growth", "digital", "content", "social media", "cmo", "advertis", "pr", "communications", "campaign", "seo", "creative"],
    "Operations & Scale":     ["operations", "supply chain", "logistics", "process", "coo", "manufacturing", "scale", "procurement", "execution"],
    "Technology & Product":   ["technology", "tech", "product", "engineering", "software", "cto", "developer", "data", "ai", "ml", "saas", "platform", "architect"],
    "Strategy & Growth":      ["strategy", "consulting", "management", "ceo", "founder", "business development", "growth", "transformation", "advisory"],
    "People & Culture":       ["hr", "human resources", "people", "talent", "culture", "recrui", "organization", "dei", "inclusion"],
    "Sales & Distribution":   ["sales", "distribution", "retail", "b2b", "revenue", "channel", "partnership", "business development", "gtm"],
    "Media & Communications": ["media", "journalist", "editor", "film", "documentary", "publishing", "communications", "press", "television", "broadcast"],
    "International Expansion":["international", "global", "export", "overseas", "cross-border", "expansion", "foreign", "eu", "us", "uk"],
}

# ─── Pydantic models ──────────────────────────────────────────────────────────

class CandidateUpdate(BaseModel):
    status:            Optional[str]       = None
    admin_notes:       Optional[str]       = None
    admin_boost:       Optional[int]       = None   # 0–20
    suggested_formats: Optional[List[str]] = None
    suggested_topics:  Optional[List[str]] = None


class DecisionIn(BaseModel):
    candidate_id: str
    action:       str
    notes:        Optional[str] = ""


class TopicSignalIn(BaseModel):
    topic:       str
    source_type: str            = "manual"
    person_id:   Optional[str] = None
    weight:      Optional[int] = 1


class PairStatusUpdate(BaseModel):
    status: str


class PanelStatusUpdate(BaseModel):
    status: str
    title:  Optional[str] = None


VALID_CANDIDATE_STATUSES = {
    "candidate", "podcast_ready", "maybe_later", "not_fit_now",
    "already_invited", "invited", "booked", "declined",
}
VALID_PAIR_STATUSES  = {"suggested", "shortlisted", "rejected", "invited", "booked"}
VALID_PANEL_STATUSES = {"suggested", "shortlisted", "rejected", "invited", "booked"}


# ─── Scoring engine ───────────────────────────────────────────────────────────

def _score_rager(rager_id: str) -> tuple:
    """
    Returns (score, breakdown, event_ids, source_signals).
    All factors are deterministic and human-readable.

    Score breakdown:
      dinner_attendance  : +5 per event attended, max 20
      rsvp_reliability   : ratio × 10, max 10
      preread_quality    : +3 per pre-read submitted (max 12) + depth bonus (max 10)
      advisory           : +8 per confirmed session (max 24) + reliability × 8 (max 8)
      cross_module       : +10 if 2+ dinners AND 1+ advisory
    Max raw score ≈ 84. Admin boost adds 0–20.
    """
    score      = 0
    breakdown  = {}
    event_ids  = []
    signals    = []

    # 1. Dinner attendance (rsvp=yes invites linked to this rager)
    dinner_invites = list(db.invites.find(
        {"rager_id": rager_id, "rsvp_status": "yes"}, {"_id": 0}
    ))
    dinner_count = len(dinner_invites)
    if dinner_count:
        d_pts = min(dinner_count * 5, 20)
        score += d_pts
        breakdown["dinner_attendance"] = {"count": dinner_count, "points": d_pts}
        signals.append("dinner_attendance")
        event_ids = list({i["event_id"] for i in dinner_invites})

    # 2. RSVP reliability (ratio of yes among all sent invites)
    sent_invites = list(db.invites.find(
        {"rager_id": rager_id, "invite_sent": True}, {"_id": 0}
    ))
    if sent_invites:
        yes_count = sum(1 for i in sent_invites if i.get("rsvp_status") == "yes")
        ratio     = yes_count / len(sent_invites)
        r_pts     = round(ratio * 10)
        score    += r_pts
        breakdown["rsvp_reliability"] = {"ratio": round(ratio, 2), "points": r_pts}
        if ratio >= 0.7:
            signals.append("reliable_rsvp")

    # 3. Pre-read quality
    invite_ids = [i["id"] for i in dinner_invites]
    if invite_ids:
        prereads  = list(db.prereads.find({"invite_id": {"$in": invite_ids}}, {"_id": 0}))
        pr_count  = len(prereads)
        if pr_count:
            pr_pts = min(pr_count * 3, 12)
            score += pr_pts
            signals.append("preread_submitted")

            depth_pts = 0
            for pr in prereads:
                total_len = sum(len(pr.get(f, "") or "") for f in [
                    "one_liner", "current_focus", "bring_to_table", "looking_for"
                ])
                if   total_len > 400: depth_pts += 5
                elif total_len > 200: depth_pts += 3
                elif total_len > 80:  depth_pts += 1
            depth_pts = min(depth_pts, 10)
            score    += depth_pts
            breakdown["preread_quality"] = {
                "count":        pr_count,
                "depth_points": depth_pts,
                "points":       pr_pts + depth_pts,
            }

    # 4. Advisory sessions (as advisor/member in Closed Table)
    #    Exclude allocations whose enquiry is archived — testing/junk must not distort scores.
    allocs     = list(db.allocations.find({"member_id": rager_id}, {"_id": 0}))
    conf_count = 0
    if allocs:
        enq_ids_for_allocs = [a.get("enquiry_id") for a in allocs if a.get("enquiry_id")]
        if enq_ids_for_allocs:
            archived_enq_ids = {
                e["id"] for e in db.enquiries.find(
                    {"id": {"$in": enq_ids_for_allocs}, "is_archived": True},
                    {"id": 1, "_id": 0},
                )
            }
            allocs = [a for a in allocs if a.get("enquiry_id") not in archived_enq_ids]
        conf_count = sum(1 for a in allocs if a.get("status") == "confirmed")
        if allocs:
            adv_pts = min(conf_count * 8, 24)
            rel     = conf_count / len(allocs)
            rel_pts = round(rel * 8)
            score  += adv_pts + rel_pts
            breakdown["advisory"] = {
                "offered":     len(allocs),
                "confirmed":   conf_count,
                "reliability": round(rel, 2),
                "points":      adv_pts + rel_pts,
            }
            if conf_count:
                signals.append("advisory_confirmed")

    # 5. Cross-module engagement bonus
    if dinner_count >= 2 and conf_count >= 1:
        score += 10
        breakdown["cross_module"] = {
            "points": 10,
            "note":   f"{dinner_count} dinners + {conf_count} advisory sessions",
        }
        signals.append("cross_module_engagement")

    return score, breakdown, event_ids, signals


def _extract_topics(rager: dict, invite_ids: list) -> list:
    """
    Extract up to 5 topic categories for a rager from all available signals.
    Uses keyword matching — no AI.
    """
    votes = []

    # Rager categories (explicit, weighted ×3)
    for cat in rager.get("categories", []):
        if cat in CATEGORIES:
            votes.extend([cat] * 3)

    # Rager profile text (title + bio + expertise)
    profile_text = " ".join([
        rager.get("title", ""),
        rager.get("bio", ""),
        " ".join(rager.get("expertise", [])),
    ]).lower()
    for cat, kws in KEYWORD_MAP.items():
        if any(kw in profile_text for kw in kws):
            votes.append(cat)

    # Pre-read text
    if invite_ids:
        for pr in db.prereads.find({"invite_id": {"$in": invite_ids}}, {"_id": 0}):
            text = " ".join([
                pr.get("bring_to_table", ""),
                pr.get("looking_for", ""),
                pr.get("current_focus", ""),
                pr.get("one_liner", ""),
            ]).lower()
            for cat, kws in KEYWORD_MAP.items():
                if any(kw in text for kw in kws):
                    votes.append(cat)

    # Dinner themes
    ev_invite = list(db.invites.find(
        {"rager_id": rager["id"], "rsvp_status": "yes"},
        {"event_id": 1, "_id": 0}
    ))
    ev_ids = [i["event_id"] for i in ev_invite]
    if ev_ids:
        for ev in db.events.find({"id": {"$in": ev_ids}}, {"theme": 1, "_id": 0}):
            theme = (ev.get("theme") or "").lower()
            for cat, kws in KEYWORD_MAP.items():
                if any(kw in theme for kw in kws):
                    votes.append(cat)

    # Advisory enquiry topics (archived enquiries excluded — must not pollute topic scores)
    allocs = list(db.allocations.find({"member_id": rager["id"]}, {"enquiry_id": 1, "_id": 0}))
    if allocs:
        enq_ids = [a["enquiry_id"] for a in allocs]
        for enq in db.enquiries.find({"id": {"$in": enq_ids}, "is_archived": {"$ne": True}}, {"_id": 0}):
            for field in ["topic", "description", "category", "tags"]:
                val = enq.get(field)
                if not val:
                    continue
                text = (" ".join(str(v) for v in val) if isinstance(val, list) else str(val)).lower()
                for cat, kws in KEYWORD_MAP.items():
                    if any(kw in text for kw in kws):
                        votes.append(cat)

    return [t for t, _ in Counter(votes).most_common(5)]


def _pair_compatibility(cand_a: dict, cand_b: dict) -> tuple:
    """Returns (score, reasons). Deterministic pairwise signal."""
    score   = 0
    reasons = []

    topics_a = set(cand_a.get("suggested_topics") or [])
    topics_b = set(cand_b.get("suggested_topics") or [])

    # Shared topics
    overlap = topics_a & topics_b
    if overlap:
        pts = min(len(overlap) * 5, 20)
        score += pts
        reasons.append(f"Shared topics: {', '.join(sorted(overlap)[:3])}")

    # Complementary angles (each brings something the other lacks)
    if (topics_a - topics_b) and (topics_b - topics_a):
        score += 5
        reasons.append("Complementary expertise angles")

    # Prior dinner chemistry (attended same event)
    events_a = set(cand_a.get("_event_ids") or [])
    events_b = set(cand_b.get("_event_ids") or [])
    shared   = events_a & events_b
    if shared:
        pts = min(len(shared) * 8, 16)
        score += pts
        reasons.append(f"Met at {len(shared)} Private Table dinner(s)")

    # Both individually strong
    if (cand_a.get("score") or 0) >= 30 and (cand_b.get("score") or 0) >= 30:
        score += 3
        reasons.append("Both highly engaged with the RAGE network")

    # Cross-module diversity
    sig_a = set(cand_a.get("source_signals") or [])
    sig_b = set(cand_b.get("source_signals") or [])
    if ("dinner_attendance" in sig_a and "advisory_confirmed" in sig_b) or \
       ("advisory_confirmed" in sig_a and "dinner_attendance" in sig_b):
        score += 4
        reasons.append("Different engagement modes — dinner vs. advisory")

    # Company diversity bonus / penalty
    co_a = (cand_a.get("company") or "").strip().lower()
    co_b = (cand_b.get("company") or "").strip().lower()
    if co_a and co_b and co_a == co_b:
        score -= 8
        reasons.append("⚠ Same organisation")
    elif co_a and co_b:
        score += 2

    if not reasons or all(r.startswith("⚠") for r in reasons):
        reasons.append("Potential network value — review manually")

    return score, reasons


def _panel_score(members: list) -> tuple:
    """Returns (score, reasons) for a group of 3 candidates."""
    score   = 0
    reasons = []

    # Average pairwise compatibility
    pair_total = 0
    pair_count = 0
    for i in range(len(members)):
        for j in range(i + 1, len(members)):
            ps, _ = _pair_compatibility(members[i], members[j])
            pair_total += ps
            pair_count += 1
    if pair_count:
        score += pair_total // pair_count

    # Topic coverage
    all_topics: set = set()
    for m in members:
        all_topics.update(m.get("suggested_topics") or [])
    if len(all_topics) >= 3:
        score += 10
        reasons.append(f"Rich topic range: {', '.join(sorted(all_topics)[:4])}")
    elif all_topics:
        reasons.append(f"Topics: {', '.join(sorted(all_topics))}")

    # Company diversity
    companies = [m.get("company", "").strip().lower() for m in members if m.get("company")]
    if len(set(companies)) == len(companies):
        score += 5
        reasons.append("All from different organisations")
    elif len(set(companies)) < len(companies):
        score -= 5
        reasons.append("⚠ Duplicate organisations in panel")

    return score, reasons


# ─── Candidates ───────────────────────────────────────────────────────────────

@router.post("/admin/podcast/candidates/refresh")
def refresh_candidates(admin=Depends(require_admin)):
    """
    Regenerate candidate records from all ragers.
    Existing status / notes / boost are preserved.
    New ragers get a fresh candidate record.
    """
    ragers  = list(db.ragers.find({}, {"_id": 0}))
    created = updated = 0

    for rager in ragers:
        rager_id = rager["id"]
        score, breakdown, event_ids, signals = _score_rager(rager_id)

        invite_ids = [
            i["id"] for i in
            db.invites.find({"rager_id": rager_id}, {"id": 1, "_id": 0})
        ]
        topics = _extract_topics(rager, invite_ids)

        existing    = db.podcast_candidates.find_one({"person_id": rager_id}, {"_id": 0})
        admin_boost = (existing or {}).get("admin_boost") or 0
        final_score = score + admin_boost

        patch = {
            "person_id":       rager_id,
            "name":            rager.get("name", ""),
            "company":         rager.get("company", ""),
            "title":           rager.get("title", ""),
            "score":           final_score,
            "raw_score":       score,
            "score_breakdown": breakdown,
            "source_signals":  signals,
            "suggested_topics": topics,
            "_event_ids":      event_ids,   # internal — excluded from public list
            "updated_at":      _NOW(),
        }

        if existing:
            db.podcast_candidates.update_one({"person_id": rager_id}, {"$set": patch})
            updated += 1
        else:
            patch.update({
                "id":                        str(uuid.uuid4()),
                "status":                    "candidate",
                "admin_boost":               0,
                "suggested_formats":         [],
                "suggested_with_person_ids": [],
                "admin_notes":               "",
                "last_reviewed_at":          None,
                "created_at":                _NOW(),
            })
            db.podcast_candidates.insert_one(patch)
            created += 1

    total = db.podcast_candidates.count_documents({})
    return {"created": created, "updated": updated, "total": total}


@router.get("/admin/podcast/candidates")
def list_candidates(admin=Depends(require_admin)):
    return list(
        db.podcast_candidates.find({}, {"_id": 0, "_event_ids": 0}).sort("score", -1)
    )


@router.get("/admin/podcast/candidates/{candidate_id}")
def get_candidate(candidate_id: str, admin=Depends(require_admin)):
    cand = db.podcast_candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    rager_id = cand["person_id"]
    rager    = db.ragers.find_one({"id": rager_id}, {"_id": 0, "phone": 0}) or {}

    # Dinner history
    dinner_invites = list(db.invites.find({"rager_id": rager_id}, {"_id": 0}))
    event_ids = [i["event_id"] for i in dinner_invites]
    events_map = {
        ev["id"]: ev for ev in
        db.events.find({"id": {"$in": event_ids}}, {"_id": 0})
    } if event_ids else {}

    dinner_history = [
        {
            "event_title":       events_map.get(inv["event_id"], {}).get("title", "—"),
            "event_date":        events_map.get(inv["event_id"], {}).get("date"),
            "event_theme":       events_map.get(inv["event_id"], {}).get("theme", ""),
            "rsvp_status":       inv.get("rsvp_status"),
            "preread_submitted": inv.get("preread_submitted", False),
            "guest_type":        inv.get("guest_type", ""),
        }
        for inv in dinner_invites
    ]

    # Advisory history — exclude allocations linked to archived enquiries
    allocs = list(db.allocations.find({"member_id": rager_id}, {"_id": 0}))
    advisory_history = []
    for a in allocs:
        enq = db.enquiries.find_one(
            {"id": a.get("enquiry_id"), "is_archived": {"$ne": True}},
            {"_id": 0},
        ) or {}
        if not enq and a.get("enquiry_id"):
            # enquiry is archived or missing — skip from advisory history view
            continue
        topic = enq.get("topic") or enq.get("category") or enq.get("description", "")[:60] or "—"
        advisory_history.append({"status": a.get("status"), "topic": topic})

    # Decision log
    decisions = list(
        db.podcast_invite_decisions.find(
            {"candidate_id": candidate_id}, {"_id": 0}
        ).sort("created_at", -1)
    )

    # Top pairs for this person
    suggested_pairs = list(
        db.podcast_pairs.find(
            {
                "$or": [{"person_1_id": rager_id}, {"person_2_id": rager_id}],
                "status": {"$ne": "rejected"},
            },
            {"_id": 0},
        ).sort("compatibility_score", -1).limit(5)
    )
    for pair in suggested_pairs:
        other_id = pair["person_2_id"] if pair["person_1_id"] == rager_id else pair["person_1_id"]
        other    = db.ragers.find_one(
            {"id": other_id}, {"_id": 0, "name": 1, "company": 1, "title": 1}
        ) or {}
        pair["other_person"] = other

    return {
        **{k: v for k, v in cand.items() if k != "_event_ids"},
        "rager":            rager,
        "dinner_history":   dinner_history,
        "advisory_history": advisory_history,
        "decisions":        decisions,
        "suggested_pairs":  suggested_pairs,
    }


@router.patch("/admin/podcast/candidates/{candidate_id}")
def update_candidate(candidate_id: str, data: CandidateUpdate, admin=Depends(require_admin)):
    cand = db.podcast_candidates.find_one({"id": candidate_id})
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if data.status and data.status not in VALID_CANDIDATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")

    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")

    if "admin_boost" in patch:
        raw          = cand.get("raw_score", cand.get("score", 0))
        patch["score"] = raw + max(0, min(20, patch["admin_boost"]))

    if patch.get("status"):
        patch["last_reviewed_at"] = _NOW()

    patch["updated_at"] = _NOW()
    db.podcast_candidates.update_one({"id": candidate_id}, {"$set": patch})
    return db.podcast_candidates.find_one({"id": candidate_id}, {"_id": 0})


# ─── Decision log ─────────────────────────────────────────────────────────────

@router.post("/admin/podcast/decisions")
def add_decision(data: DecisionIn, admin=Depends(require_admin)):
    if not db.podcast_candidates.find_one({"id": data.candidate_id}):
        raise HTTPException(status_code=404, detail="Candidate not found")
    doc = {
        "id":           str(uuid.uuid4()),
        "candidate_id": data.candidate_id,
        "action":       data.action,
        "notes":        data.notes,
        "created_by":   admin.get("id"),
        "created_at":   _NOW(),
    }
    db.podcast_invite_decisions.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─── Topic signals ────────────────────────────────────────────────────────────

@router.get("/admin/podcast/topics")
def get_topics(admin=Depends(require_admin)):
    """Aggregate topic coverage across all candidates + manual signals."""
    candidates = list(db.podcast_candidates.find(
        {}, {"_id": 0, "suggested_topics": 1, "name": 1, "person_id": 1}
    ))

    counter:  Counter         = Counter()
    by_topic: dict            = {}
    for c in candidates:
        for t in (c.get("suggested_topics") or []):
            counter[t] += 1
            by_topic.setdefault(t, []).append({"name": c["name"], "person_id": c["person_id"]})

    aggregated = [
        {"topic": t, "count": n, "people": by_topic.get(t, [])}
        for t, n in counter.most_common()
    ]
    manual = list(
        db.podcast_topic_signals.find({"source_type": "manual"}, {"_id": 0}).sort("created_at", -1)
    )
    return {"aggregated": aggregated, "manual": manual}


@router.post("/admin/podcast/topics")
def add_topic_signal(data: TopicSignalIn, admin=Depends(require_admin)):
    doc = {
        "id":            str(uuid.uuid4()),
        "topic":         data.topic,
        "source_type":   data.source_type,
        "source_ref_id": None,
        "person_id":     data.person_id,
        "weight":        data.weight,
        "created_at":    _NOW(),
    }
    db.podcast_topic_signals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/admin/podcast/topics/{signal_id}")
def delete_topic_signal(signal_id: str, admin=Depends(require_admin)):
    r = db.podcast_topic_signals.delete_one({"id": signal_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"deleted": True}


# ─── Pairs ────────────────────────────────────────────────────────────────────

@router.post("/admin/podcast/pairs/generate")
def generate_pairs(admin=Depends(require_admin)):
    """
    Regenerate pair suggestions from the top 50 non-excluded candidates.
    Replaces all auto-generated pairs; manually created pairs are preserved.
    Only pairs with score > 0 are stored.
    """
    candidates = list(db.podcast_candidates.find(
        {"status": {"$nin": ["not_fit_now", "declined"]}},
        {"_id": 0},
    ).sort("score", -1).limit(50))

    if len(candidates) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 candidates to generate pairs")

    db.podcast_pairs.delete_many({"source": "auto"})

    created = 0
    for ca, cb in combinations(candidates, 2):
        compat, reasons = _pair_compatibility(ca, cb)
        if compat <= 0:
            continue
        db.podcast_pairs.insert_one({
            "id":                  str(uuid.uuid4()),
            "person_1_id":         ca["person_id"],
            "person_1_name":       ca.get("name", ""),
            "person_1_company":    ca.get("company", ""),
            "person_2_id":         cb["person_id"],
            "person_2_name":       cb.get("name", ""),
            "person_2_company":    cb.get("company", ""),
            "compatibility_score": compat,
            "reasons":             reasons,
            "status":              "suggested",
            "source":              "auto",
            "created_at":          _NOW(),
            "updated_at":          _NOW(),
        })
        created += 1

    return {"pairs_created": created}


@router.get("/admin/podcast/pairs")
def list_pairs(admin=Depends(require_admin)):
    return list(db.podcast_pairs.find({}, {"_id": 0}).sort("compatibility_score", -1))


@router.patch("/admin/podcast/pairs/{pair_id}")
def update_pair(pair_id: str, data: PairStatusUpdate, admin=Depends(require_admin)):
    if data.status not in VALID_PAIR_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    r = db.podcast_pairs.update_one(
        {"id": pair_id}, {"$set": {"status": data.status, "updated_at": _NOW()}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pair not found")
    return db.podcast_pairs.find_one({"id": pair_id}, {"_id": 0})


# ─── Panels ───────────────────────────────────────────────────────────────────

@router.post("/admin/podcast/panels/generate")
def generate_panels(admin=Depends(require_admin)):
    """
    Generate 3-person panel suggestions grouped by top topic.
    Uses top 40 non-excluded candidates.
    Replaces all auto-generated panels.
    """
    candidates = list(db.podcast_candidates.find(
        {"status": {"$nin": ["not_fit_now", "declined"]}},
        {"_id": 0},
    ).sort("score", -1).limit(40))

    if len(candidates) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 candidates to generate panels")

    db.podcast_panels.delete_many({"source": "auto"})

    # Group by top topic
    topic_groups: dict = {}
    for c in candidates:
        for t in (c.get("suggested_topics") or [])[:2]:
            topic_groups.setdefault(t, []).append(c)

    seen_combos: set = set()
    created          = 0

    for topic, pool in topic_groups.items():
        if len(pool) < 3:
            continue
        for combo in combinations(pool[:8], 3):
            ids = tuple(sorted(c["person_id"] for c in combo))
            if ids in seen_combos:
                continue
            seen_combos.add(ids)

            # Reject same-company panels
            companies = [c.get("company", "").strip().lower() for c in combo if c.get("company")]
            if len(companies) != len(set(companies)):
                continue

            panel_score, reasons = _panel_score(list(combo))
            if panel_score <= 0:
                continue

            db.podcast_panels.insert_one({
                "id":    str(uuid.uuid4()),
                "title": f"Panel: {topic}",
                "topic": topic,
                "person_ids": [c["person_id"] for c in combo],
                "member_summaries": [
                    {"person_id": c["person_id"], "name": c.get("name"), "company": c.get("company")}
                    for c in combo
                ],
                "score":      panel_score,
                "reasons":    reasons,
                "status":     "suggested",
                "source":     "auto",
                "created_at": _NOW(),
                "updated_at": _NOW(),
            })
            created += 1

    return {"panels_created": created}


@router.get("/admin/podcast/panels")
def list_panels(admin=Depends(require_admin)):
    return list(db.podcast_panels.find({}, {"_id": 0}).sort("score", -1))


@router.patch("/admin/podcast/panels/{panel_id}")
def update_panel(panel_id: str, data: PanelStatusUpdate, admin=Depends(require_admin)):
    if data.status not in VALID_PANEL_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    patch = {"status": data.status, "updated_at": _NOW()}
    if data.title:
        patch["title"] = data.title
    r = db.podcast_panels.update_one({"id": panel_id}, {"$set": patch})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Panel not found")
    return db.podcast_panels.find_one({"id": panel_id}, {"_id": 0})


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/analytics")
def podcast_analytics(admin=Depends(require_admin)):
    by_status = {s: db.podcast_candidates.count_documents({"status": s})
                 for s in VALID_CANDIDATE_STATUSES}

    from_adv    = db.podcast_candidates.count_documents({"source_signals": "advisory_confirmed"})
    from_dinner = db.podcast_candidates.count_documents({"source_signals": "dinner_attendance"})
    from_both   = db.podcast_candidates.count_documents(
        {"source_signals": {"$all": ["advisory_confirmed", "dinner_attendance"]}}
    )

    candidates = list(db.podcast_candidates.find({}, {"_id": 0, "suggested_topics": 1}))
    topic_counter: Counter = Counter()
    for c in candidates:
        for t in (c.get("suggested_topics") or []):
            topic_counter[t] += 1

    return {
        "total_candidates":  db.podcast_candidates.count_documents({}),
        "by_status":         by_status,
        "source_breakdown": {
            "from_advisory_only": from_adv - from_both,
            "from_dinner_only":   from_dinner - from_both,
            "from_both_modules":  from_both,
        },
        "top_topics":        [{"topic": t, "count": n} for t, n in topic_counter.most_common(10)],
        "total_pairs":       db.podcast_pairs.count_documents({}),
        "shortlisted_pairs": db.podcast_pairs.count_documents({"status": "shortlisted"}),
        "total_panels":      db.podcast_panels.count_documents({}),
        "shortlisted_panels":db.podcast_panels.count_documents({"status": "shortlisted"}),
    }
