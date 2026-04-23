"""
Podcast Intelligence — cold-start capable, rebuilt.

Identity model
──────────────
  podcast_people  is a working layer, not a duplicate identity system.
  • rager_id set  → name / company / bio / linkedin always read live from ragers
  • rager_id null → all identity fields live in podcast_people directly
  • role always stored on podcast_people (ragers collection has no role field)

Collections
───────────
  NEW:       podcast_people, podcast_content, podcast_topics, podcast_tables
  UPDATED:   podcast_candidates (role + topic_ids + content_count fields added)
             podcast_pairs      (primary_topic + role_pairing + person roles added)
  UNCHANGED: podcast_invite_decisions
  RETIRED:   podcast_topic_signals, podcast_panels (data preserved, not queried)
"""

import os
import uuid
import json as _json
from datetime import datetime, timezone
from collections import Counter
from itertools import combinations
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()
_NOW = lambda: datetime.now(timezone.utc).isoformat()

# ── Constants ─────────────────────────────────────────────────────────────────

VALID_PERSON_ROLES    = {"founder", "investor", "operator", "expert", "advisor", "other"}
VALID_PERSON_SOURCES  = {"manual", "rager", "imported"}
VALID_PERSON_STATUSES = {"active", "archived"}
VALID_CAND_STATUSES   = {"candidate", "podcast_ready", "maybe_later", "not_fit_now",
                         "already_invited", "invited", "booked", "declined"}
VALID_PAIR_STATUSES   = {"suggested", "shortlisted", "rejected", "invited", "booked"}
VALID_TABLE_STATUSES  = {"suggested", "shortlisted", "rejected", "invited", "booked"}
VALID_CONTENT_TYPES   = {"note", "transcript", "article", "research"}
VALID_TOPIC_SOURCES   = {"manual", "ai", "both"}

ROLE_WEIGHT = {
    "founder": 10, "investor": 9, "operator": 8,
    "expert":   7, "advisor":  6, "other":    4,
}

ROLE_BONUS = {
    frozenset({"founder",  "investor"}): 15,
    frozenset({"founder",  "operator"}): 12,
    frozenset({"operator", "expert"}):   10,
    frozenset({"founder",  "expert"}):    8,
    frozenset({"investor", "expert"}):    8,
    frozenset({"advisor",  "founder"}):   8,
    frozenset({"operator", "investor"}):  6,
}

EXTRACT_PROMPT = """You are analyzing content to extract structured intelligence for a podcast guest research system.

Content:
{text}

Extract the following as a single JSON object:
{{
  "topics":     ["3 to 8 main topic areas, short noun phrases, e.g. fundraising, team building"],
  "subtopics":  ["5 to 12 specific sub-themes, e.g. pre-seed bridge financing, first engineering hire"],
  "viewpoints": ["3 to 8 distinct positions or opinions expressed, e.g. believes in bootstrapping before raising"],
  "keywords":   ["10 to 20 relevant keywords, sector terms, proper nouns, notable phrases"]
}}

Rules:
- topics: broad thematic areas
- subtopics: specific angles within topics
- viewpoints: actual stated or implied positions, not neutral facts
- keywords: useful for matching and search
- Return ONLY valid JSON. No markdown. No explanation.
"""


# ── Identity helpers ──────────────────────────────────────────────────────────

def _resolve_person(pp: dict) -> dict:
    """
    Merge podcast_people with ragers identity if rager_id is set.
    Identity fields (name, title, company, bio, linkedin, location) come from ragers.
    Podcast-specific fields (role, tags, expertise, admin_boost, viewpoints …) always
    come from pp — rager.expertise used as fallback if pp has none.
    """
    rager_id = pp.get("rager_id")
    if rager_id:
        rager = db.ragers.find_one({"id": rager_id}, {"_id": 0, "phone": 0}) or {}
        return {
            **pp,
            "name":      rager.get("name",     pp.get("name",     "")),
            "title":     rager.get("title",    pp.get("title",    "")),
            "company":   rager.get("company",  pp.get("company",  "")),
            "bio":       rager.get("bio",      pp.get("bio",      "")),
            "linkedin":  rager.get("linkedin", pp.get("linkedin", "")),
            "location":  rager.get("location", pp.get("location", "")),
            # Use rager's expertise as fallback only when none set on pp
            "expertise": pp.get("expertise") or rager.get("expertise") or [],
        }
    return pp


def _resolve_many(pps: list) -> list:
    """Batch-resolve identity for a list of podcast_people docs."""
    rager_ids = [p["rager_id"] for p in pps if p.get("rager_id")]
    ragers_map = {}
    if rager_ids:
        for r in db.ragers.find({"id": {"$in": rager_ids}}, {"_id": 0, "phone": 0}):
            ragers_map[r["id"]] = r
    result = []
    for pp in pps:
        rid = pp.get("rager_id")
        if rid and rid in ragers_map:
            r = ragers_map[rid]
            result.append({
                **pp,
                "name":      r.get("name",     pp.get("name",     "")),
                "title":     r.get("title",    pp.get("title",    "")),
                "company":   r.get("company",  pp.get("company",  "")),
                "bio":       r.get("bio",      pp.get("bio",      "")),
                "linkedin":  r.get("linkedin", pp.get("linkedin", "")),
                "location":  r.get("location", pp.get("location", "")),
                "expertise": pp.get("expertise") or r.get("expertise") or [],
            })
        else:
            result.append(pp)
    return result


def _get_person_viewpoints(person_id: str) -> set:
    """Inline viewpoints (from podcast_people) + extracted viewpoints (from content)."""
    pp = db.podcast_people.find_one({"id": person_id}, {"viewpoints": 1, "_id": 0}) or {}
    viewpoints = set(v.lower().strip() for v in (pp.get("viewpoints") or []))
    for c in db.podcast_content.find(
        {"person_id": person_id},
        {"extracted.viewpoints": 1, "_id": 0}
    ):
        for v in (c.get("extracted") or {}).get("viewpoints", []):
            viewpoints.add(v.lower().strip())
    return viewpoints


# ── Scoring engine ────────────────────────────────────────────────────────────

def _score_person(person_id: str):
    """
    Returns (raw_score, breakdown, topic_ids, signals, activity_bonus, content_count).

    raw_score max = 100.  activity_bonus is additive (optional layer).
    Admin boost applied separately at candidate upsert time.

    Components
      topic_relevance  : topics assigned to this person × 8,  max 40
      content_quantity : content pieces × 5,                  max 15
      content_quality  : total extracted signals (all fields), max 15
      role_weight      : founder 10 … other 4,                max 10
      bio_completeness : presence + length + linkedin,         max 10
      tag_richness     : tags × 2,                            max 10
    Activity (only if rager_id set and data exists)
      dinner_attendance: dinners × 5,                         max 20
      advisory         : confirmed sessions × 8,              max 24
      cross_module     : both dinner≥2 + advisory≥1,          +10
    """
    pp = db.podcast_people.find_one({"id": person_id, "status": "active"})
    if not pp:
        return 0, {}, [], [], 0, 0

    resolved = _resolve_person(pp)

    # Topic relevance
    topic_docs = list(db.podcast_topics.find(
        {"people_ids": person_id, "merged_into": None},
        {"id": 1, "_id": 0}
    ))
    topic_ids       = [t["id"] for t in topic_docs]
    topic_relevance = min(len(topic_ids) * 8, 40)

    # Content
    content_docs     = list(db.podcast_content.find({"person_id": person_id}, {"_id": 0}))
    content_count    = len(content_docs)
    content_quantity = min(content_count * 5, 15)
    total_signals    = 0
    for c in content_docs:
        ext = c.get("extracted") or {}
        total_signals += len(ext.get("topics",    []))
        total_signals += len(ext.get("viewpoints", []))
        total_signals += len(ext.get("keywords",   []))
        total_signals += len(ext.get("subtopics",  []))
    content_quality = min(total_signals, 15)

    # Role
    role        = pp.get("role", "other")
    role_weight = ROLE_WEIGHT.get(role, 4)

    # Bio completeness (uses resolved identity + inline profile fields)
    bio           = resolved.get("bio", "") or ""
    linkedin      = resolved.get("linkedin", "") or ""
    known_for     = pp.get("known_for", "") or ""
    current_focus = pp.get("current_focus", "") or ""
    bio_completeness = min(
        (3 if bio else 0) +
        (2 if len(bio) > 200 else 0) +
        (2 if linkedin else 0) +
        (2 if known_for else 0) +
        (1 if current_focus else 0),
        10
    )

    # Tag richness — broad tags + specific expertise combined
    tags      = pp.get("tags") or []
    expertise = resolved.get("expertise") or []
    all_tags  = list(set(tags + expertise))
    tag_richness = min(len(all_tags) * 2, 10)

    # Inline viewpoints count as a content signal (before any uploads)
    inline_viewpoints = len(pp.get("viewpoints") or [])
    if inline_viewpoints:
        content_quality = min(content_quality + min(inline_viewpoints * 2, 6), 15)

    raw_score = (
        topic_relevance + content_quantity + content_quality +
        role_weight + bio_completeness + tag_richness
    )

    breakdown = {
        "topic_relevance":  {"topics":   len(topic_ids),   "points": topic_relevance},
        "content_quantity": {"pieces":   content_count,    "points": content_quantity},
        "content_quality":  {"signals":  total_signals + inline_viewpoints, "points": content_quality},
        "role_weight":      {"role":     role,              "points": role_weight},
        "bio_completeness": {                               "points": bio_completeness},
        "tag_richness":     {"tags":     len(all_tags),     "points": tag_richness},
    }

    # ── Activity layer (additive, only for rager-linked people) ───────────────
    activity_bonus    = 0
    activity_breakdown = {}
    dinner_count      = 0
    conf_count        = 0

    rager_id = pp.get("rager_id")
    if rager_id:
        dinner_invites = list(db.invites.find(
            {"rager_id": rager_id, "rsvp_status": "yes"}, {"_id": 0}
        ))
        dinner_count = len(dinner_invites)
        if dinner_count:
            d_pts            = min(dinner_count * 5, 20)
            activity_bonus  += d_pts
            activity_breakdown["dinner_attendance"] = {"count": dinner_count, "points": d_pts}

        allocs = list(db.allocations.find({"member_id": rager_id}, {"_id": 0}))
        if allocs:
            enq_ids = [a.get("enquiry_id") for a in allocs if a.get("enquiry_id")]
            if enq_ids:
                archived = {
                    e["id"] for e in db.enquiries.find(
                        {"id": {"$in": enq_ids}, "is_archived": True},
                        {"id": 1, "_id": 0}
                    )
                }
                allocs = [a for a in allocs if a.get("enquiry_id") not in archived]
            conf_count = sum(1 for a in allocs if a.get("status") == "confirmed")
            if allocs:
                adv_pts           = min(conf_count * 8, 24)
                activity_bonus   += adv_pts
                activity_breakdown["advisory"] = {"confirmed": conf_count, "points": adv_pts}

        if dinner_count >= 2 and conf_count >= 1:
            activity_bonus += 10
            activity_breakdown["cross_module"] = {"points": 10}

    if activity_breakdown:
        breakdown["activity"] = activity_breakdown

    signals = []
    if topic_ids:    signals.append("has_topics")
    if content_count: signals.append("has_content")
    if activity_breakdown.get("dinner_attendance"): signals.append("dinner_attendance")
    if activity_breakdown.get("advisory"):          signals.append("advisory_confirmed")
    if dinner_count >= 2 and conf_count >= 1:       signals.append("cross_module_engagement")

    return raw_score, breakdown, topic_ids, signals, activity_bonus, content_count


# ── Pair compatibility ────────────────────────────────────────────────────────

def _pair_compat(ca: dict, cb: dict, topics_map: dict = None, viewpoints_map: dict = None):
    """
    Returns (score, reasons, primary_topic_name, role_pairing_str).
    ca / cb are podcast_candidate docs (with topic_ids, role, company, content_count).

    topics_map     : {topic_id: topic_doc}  — pre-loaded by caller; falls back to DB if None
    viewpoints_map : {person_id: set[str]}  — pre-loaded by caller; falls back to DB if None
    """
    score   = 0
    reasons = []

    def _topic(tid):
        if topics_map is not None:
            return topics_map.get(tid)
        return db.podcast_topics.find_one({"id": tid}, {"name": 1, "people_ids": 1, "_id": 0})

    def _views(person_id):
        if viewpoints_map is not None:
            return viewpoints_map.get(person_id, set())
        return _get_person_viewpoints(person_id)

    # Topic overlap
    shared = set(ca.get("topic_ids") or []) & set(cb.get("topic_ids") or [])
    if shared:
        pts = min(len(shared) * 8, 24)
        score += pts
        names = [t["name"] for tid in list(shared)[:3] if (t := _topic(tid))]
        reasons.append(f"Shared topics: {', '.join(names)}" if names else "Shared topics")
    else:
        # No penalty — pairs can form before topics are assigned; topic overlap is a bonus not a gate
        reasons.append("No shared topics yet — assign topics to surface stronger pairs")

    # Role compatibility
    ra  = ca.get("role", "other")
    rb  = cb.get("role", "other")
    rpt = ROLE_BONUS.get(frozenset({ra, rb}), 5 if ra != rb else 0)
    score += rpt
    if rpt >= 10:
        reasons.append(f"Strong pairing: {ra.title()} + {rb.title()}")
    elif rpt > 0:
        reasons.append(f"Complementary roles: {ra.title()} + {rb.title()}")

    # Viewpoint contrast
    views_a = _views(ca["person_id"])
    views_b = _views(cb["person_id"])
    if views_a & views_b:
        score += min(len(views_a & views_b) * 4, 12)
        reasons.append("Common thematic ground")
    if (views_a - views_b) and (views_b - views_a):
        score += 5
        reasons.append("Different perspectives on shared themes")

    # Both have documented content
    if ca.get("content_count", 0) > 0 and cb.get("content_count", 0) > 0:
        score += 5
        reasons.append("Both have documented viewpoints")

    # Company diversity
    co_a = (ca.get("company") or "").strip().lower()
    co_b = (cb.get("company") or "").strip().lower()
    if co_a and co_b and co_a == co_b:
        score -= 15
        reasons.append("⚠ Same organisation")
    elif co_a and co_b:
        score += 5

    # Primary topic (largest people_count among shared)
    primary_topic = ""
    if shared:
        best, best_n = "", -1
        for tid in shared:
            t = _topic(tid)
            if t and len(t.get("people_ids") or []) > best_n:
                best   = t["name"]
                best_n = len(t.get("people_ids") or [])
        primary_topic = best

    role_pairing = f"{ra.title()} × {rb.title()}"
    return score, reasons, primary_topic, role_pairing


# ── Table scoring ─────────────────────────────────────────────────────────────

def _table_score(combo: list, topic_id: str, topics_map: dict = None, viewpoints_map: dict = None):
    """
    Returns (total, breakdown, reasons, why_it_works, role_composition).
    combo = list of 4 podcast_candidate dicts.

    topics_map     : {topic_id: topic_doc}  — pre-loaded by caller
    viewpoints_map : {person_id: set[str]}  — pre-loaded by caller
    """
    def _views(person_id):
        if viewpoints_map is not None:
            return viewpoints_map.get(person_id, set())
        return _get_person_viewpoints(person_id)

    # Topic coherence
    on_topic        = sum(1 for m in combo if topic_id in (m.get("topic_ids") or []))
    topic_coherence = round((on_topic / 4) * 30)

    # Perspective diversity
    all_views = set()
    for m in combo:
        all_views |= _views(m["person_id"])
    perspective_diversity = min(len(all_views) * 2, 20)

    # Role diversity
    roles        = [m.get("role", "other") for m in combo]
    unique_roles = set(roles)
    role_diversity = 15 if len(unique_roles) == 4 else round((len(unique_roles) / 4) * 15)

    # Company diversity
    companies         = [m.get("company", "").strip().lower() for m in combo]
    unique_companies  = set(c for c in companies if c)
    company_diversity = round((len(unique_companies) / 4) * 15)

    # Overall strength
    avg_raw          = sum(m.get("raw_score", 0) for m in combo) / 4
    overall_strength = round((avg_raw / 100) * 20)

    total = (
        topic_coherence + perspective_diversity +
        role_diversity  + company_diversity + overall_strength
    )

    breakdown = {
        "topic_coherence":       topic_coherence,
        "perspective_diversity": perspective_diversity,
        "role_diversity":        role_diversity,
        "company_diversity":     company_diversity,
        "overall_strength":      overall_strength,
    }

    # Reasons
    reasons = []
    if on_topic == 4:
        reasons.append("All 4 anchored to primary topic")
    elif on_topic >= 3:
        reasons.append(f"{on_topic}/4 anchored to primary topic")

    if len(unique_roles) == 4:
        reasons.append("Full role diversity: " + " + ".join(r.title() for r in sorted(unique_roles)))
    elif len(unique_roles) >= 3:
        reasons.append(f"{len(unique_roles)} distinct roles")

    if len(unique_companies) == 4:
        reasons.append("All from different organisations")
    elif len(unique_companies) >= 3:
        reasons.append(f"{len(unique_companies)} different organisations")

    if all_views:
        reasons.append(f"{len(all_views)} distinct perspectives in evidence")

    # Role composition
    role_comp = {}
    for r in roles:
        role_comp[r] = role_comp.get(r, 0) + 1

    # why_it_works
    t_doc      = (topics_map or {}).get(topic_id) or db.podcast_topics.find_one({"id": topic_id}, {"name": 1, "_id": 0})
    topic_name = t_doc["name"] if t_doc else "shared topic"
    why        = f"{topic_name} focus"
    if len(unique_roles) >= 3:
        why += f". {' + '.join(r.title() for r in sorted(unique_roles))}"
    if len(unique_companies) >= 3:
        why += ". Diverse organisations"

    return total, breakdown, reasons, why, role_comp


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class PersonIn(BaseModel):
    # ── Identity (stored only when source=manual / no rager_id) ──────────────
    name:             Optional[str]       = ""
    title:            Optional[str]       = ""   # job title / role at company
    company:          Optional[str]       = ""
    location:         Optional[str]       = ""
    linkedin:         Optional[str]       = ""
    # ── Description ───────────────────────────────────────────────────────────
    bio:              Optional[str]       = ""
    known_for:        Optional[str]       = ""   # 1-2 sentence hook
    current_focus:    Optional[str]       = ""   # what they're working on now
    # ── Classification (always stored on podcast_people) ─────────────────────
    role:             str                 = "other"
    tags:             Optional[List[str]] = []   # broad sectors / themes
    expertise:        Optional[List[str]] = []   # specific domains
    viewpoints:       Optional[List[str]] = []   # stated positions / opinions
    # ── System ────────────────────────────────────────────────────────────────
    source:           Optional[str]       = "manual"
    admin_boost:      Optional[int]       = 0
    rager_id:         Optional[str]       = None

class PersonUpdate(BaseModel):
    # Identity — only applied for manual (no rager_id) records in the endpoint
    name:             Optional[str]       = None
    title:            Optional[str]       = None
    company:          Optional[str]       = None
    location:         Optional[str]       = None
    linkedin:         Optional[str]       = None
    # Description — always applied
    bio:              Optional[str]       = None
    known_for:        Optional[str]       = None
    current_focus:    Optional[str]       = None
    # Classification — always applied
    role:             Optional[str]       = None
    tags:             Optional[List[str]] = None
    expertise:        Optional[List[str]] = None
    viewpoints:       Optional[List[str]] = None
    # System
    admin_boost:      Optional[int]       = None
    status:           Optional[str]       = None

class PersonLink(BaseModel):
    rager_id: str   # link a manual person to a rager record

class ContentIn(BaseModel):
    person_id:    Optional[str] = None
    title:        str
    content_type: str           = "note"
    raw_text:     str

class TopicIn(BaseModel):
    name:      str
    subtopics: Optional[List[str]] = []

class TopicUpdate(BaseModel):
    name:      Optional[str]       = None
    subtopics: Optional[List[str]] = None

class TopicMerge(BaseModel):
    keep_id:     str
    absorb_ids:  List[str]

class CandidateUpdate(BaseModel):
    status:      Optional[str] = None
    admin_boost: Optional[int] = None
    admin_notes: Optional[str] = None

class DecisionIn(BaseModel):
    candidate_id: str
    action:       str
    notes:        Optional[str] = ""

class PairStatusUpdate(BaseModel):
    status: str

class TableStatusUpdate(BaseModel):
    status: str


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 1 — PEOPLE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/people")
def list_people(
    role:   Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    admin=Depends(require_admin),
):
    q = {}
    if role:   q["role"]   = role
    if source: q["source"] = source
    q["status"] = status or "active"
    pps      = list(db.podcast_people.find(q, {"_id": 0}))
    resolved = _resolve_many(pps)
    if not resolved:
        return resolved

    person_ids     = [p["id"] for p in resolved]
    person_id_set  = set(person_ids)

    # Batch topic counts — 1 query, count memberships in Python
    topic_counts: dict = {}
    for t in db.podcast_topics.find(
        {"people_ids": {"$in": person_ids}, "merged_into": None},
        {"people_ids": 1, "_id": 0}
    ):
        for pid in (t.get("people_ids") or []):
            if pid in person_id_set:
                topic_counts[pid] = topic_counts.get(pid, 0) + 1

    # Batch content counts — 1 aggregation
    content_counts: dict = {}
    for row in db.podcast_content.aggregate([
        {"$match":  {"person_id": {"$in": person_ids}}},
        {"$group":  {"_id": "$person_id", "n": {"$sum": 1}}},
    ]):
        content_counts[row["_id"]] = row["n"]

    for p in resolved:
        p["topic_count"]   = topic_counts.get(p["id"], 0)
        p["content_count"] = content_counts.get(p["id"], 0)
    return resolved


@router.post("/admin/podcast/people")
def create_person(data: PersonIn, admin=Depends(require_admin)):
    if data.role not in VALID_PERSON_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(VALID_PERSON_ROLES)}")
    if data.source not in VALID_PERSON_SOURCES:
        raise HTTPException(400, f"Invalid source. Must be one of: {', '.join(VALID_PERSON_SOURCES)}")

    # If rager_id provided, verify the rager exists
    if data.rager_id:
        if not db.ragers.find_one({"id": data.rager_id}):
            raise HTTPException(404, "Rager not found")
        # Check not already imported
        if db.podcast_people.find_one({"rager_id": data.rager_id}):
            raise HTTPException(409, "This rager is already in the podcast people pool")

    doc = {
        "id":             str(uuid.uuid4()),
        "rager_id":       data.rager_id,
        "role":           data.role,
        "tags":           data.tags or [],
        # Classification fields always stored on podcast_people
        "expertise":      data.expertise or [],
        "viewpoints":     data.viewpoints or [],
        "known_for":      data.known_for or "",
        "current_focus":  data.current_focus or "",
        "source":         data.source,
        "admin_boost":    max(0, min(20, data.admin_boost or 0)),
        "status":         "active",
        "created_at":     _NOW(),
        "updated_at":     _NOW(),
    }
    # Identity fields only stored when source=manual (no rager_id)
    # For rager-linked records these are always read live from ragers collection
    if not data.rager_id:
        doc["name"]     = data.name or ""
        doc["title"]    = data.title or ""
        doc["company"]  = data.company or ""
        doc["location"] = data.location or ""
        doc["bio"]      = data.bio or ""
        doc["linkedin"] = data.linkedin or ""

    db.podcast_people.insert_one(doc)
    doc.pop("_id", None)
    return _resolve_person(doc)


@router.get("/admin/podcast/people/{person_id}")
def get_person(person_id: str, admin=Depends(require_admin)):
    pp = db.podcast_people.find_one({"id": person_id}, {"_id": 0})
    if not pp:
        raise HTTPException(404, "Person not found")
    resolved = _resolve_person(pp)

    # Attach topics, content, candidate record
    topics  = list(db.podcast_topics.find(
        {"people_ids": person_id, "merged_into": None},
        {"_id": 0, "id": 1, "name": 1, "source": 1}
    ))
    content = list(db.podcast_content.find(
        {"person_id": person_id},
        {"_id": 0, "raw_text": 0}   # exclude raw_text from list view
    ))
    cand    = db.podcast_candidates.find_one({"person_id": person_id}, {"_id": 0}) or {}

    return {**resolved, "topics": topics, "content": content, "candidate": cand}


@router.patch("/admin/podcast/people/{person_id}")
def update_person(person_id: str, data: PersonUpdate, admin=Depends(require_admin)):
    pp = db.podcast_people.find_one({"id": person_id})
    if not pp:
        raise HTTPException(404, "Person not found")

    raw = data.model_dump()

    # Identity fields may only be written for manual (no rager_id) records.
    # For rager-linked people these fields are always read live from ragers.
    IDENTITY_FIELDS = {"name", "title", "company", "location", "linkedin", "bio"}
    is_manual = not pp.get("rager_id")

    patch = {}
    for k, v in raw.items():
        if v is None:
            continue
        if k in IDENTITY_FIELDS and not is_manual:
            continue   # silently ignore — identity comes from rager
        patch[k] = v

    if not patch:
        raise HTTPException(400, "Nothing to update")

    if "role" in patch and patch["role"] not in VALID_PERSON_ROLES:
        raise HTTPException(400, "Invalid role")
    if "status" in patch and patch["status"] not in VALID_PERSON_STATUSES:
        raise HTTPException(400, "Invalid status")
    if "admin_boost" in patch:
        patch["admin_boost"] = max(0, min(20, patch["admin_boost"]))

    patch["updated_at"] = _NOW()
    db.podcast_people.update_one({"id": person_id}, {"$set": patch})
    updated = db.podcast_people.find_one({"id": person_id}, {"_id": 0})
    return _resolve_person(updated)


@router.delete("/admin/podcast/people/{person_id}")
def archive_person(person_id: str, admin=Depends(require_admin)):
    """Soft delete — sets status to archived."""
    r = db.podcast_people.update_one(
        {"id": person_id},
        {"$set": {"status": "archived", "updated_at": _NOW()}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Person not found")
    return {"archived": True}


@router.post("/admin/podcast/people/import-ragers")
def import_ragers(admin=Depends(require_admin)):
    """
    Bulk-import all ragers not yet in the podcast people pool.
    Creates a lean record: rager_id + source=rager.
    Identity (name/bio/company/linkedin) is always read live from ragers.
    Role defaults to 'other' — admin should update per person.
    """
    existing_rager_ids = {
        p["rager_id"]
        for p in db.podcast_people.find({"rager_id": {"$ne": None}}, {"rager_id": 1, "_id": 0})
    }
    ragers  = list(db.ragers.find({}, {"_id": 0, "id": 1}))
    created = 0
    for r in ragers:
        if r["id"] in existing_rager_ids:
            continue
        db.podcast_people.insert_one({
            "id":          str(uuid.uuid4()),
            "rager_id":    r["id"],
            "role":        "other",
            "tags":        [],
            "source":      "rager",
            "admin_boost": 0,
            "status":      "active",
            "created_at":  _NOW(),
            "updated_at":  _NOW(),
        })
        created += 1
    return {"created": created, "skipped": len(ragers) - created}


@router.post("/admin/podcast/people/{person_id}/link-rager")
def link_rager(person_id: str, data: PersonLink, admin=Depends(require_admin)):
    """
    Merge path: a manually added person later becomes a rager.
    Attaches rager_id to the existing podcast_people record.
    Podcast-specific fields (role, tags, boost, content, topic assignments) are preserved.
    Identity will now be read live from ragers instead of podcast_people.
    """
    pp = db.podcast_people.find_one({"id": person_id})
    if not pp:
        raise HTTPException(404, "Person not found")
    if pp.get("rager_id"):
        raise HTTPException(409, "Person already linked to a rager")
    if not db.ragers.find_one({"id": data.rager_id}):
        raise HTTPException(404, "Rager not found")
    if db.podcast_people.find_one({"rager_id": data.rager_id, "id": {"$ne": person_id}}):
        raise HTTPException(409, "That rager is already linked to a different person record")

    db.podcast_people.update_one(
        {"id": person_id},
        {"$set": {
            "rager_id":   data.rager_id,
            "source":     "rager",
            "updated_at": _NOW(),
        }}
    )
    updated = db.podcast_people.find_one({"id": person_id}, {"_id": 0})
    return _resolve_person(updated)


@router.post("/admin/podcast/people/{person_id}/topics/{topic_id}")
def assign_topic(person_id: str, topic_id: str, admin=Depends(require_admin)):
    if not db.podcast_people.find_one({"id": person_id}):
        raise HTTPException(404, "Person not found")
    if not db.podcast_topics.find_one({"id": topic_id}):
        raise HTTPException(404, "Topic not found")
    db.podcast_topics.update_one(
        {"id": topic_id},
        {"$addToSet": {"people_ids": person_id}, "$set": {"updated_at": _NOW()}}
    )
    return {"assigned": True}


@router.delete("/admin/podcast/people/{person_id}/topics/{topic_id}")
def unassign_topic(person_id: str, topic_id: str, admin=Depends(require_admin)):
    db.podcast_topics.update_one(
        {"id": topic_id},
        {"$pull": {"people_ids": person_id}, "$set": {"updated_at": _NOW()}}
    )
    return {"unassigned": True}


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 2 — CONTENT INGESTION
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/content")
def list_content(person_id: Optional[str] = None, admin=Depends(require_admin)):
    q = {}
    if person_id:
        q["person_id"] = person_id
    docs = list(db.podcast_content.find(q, {"_id": 0, "raw_text": 0}).sort("created_at", -1))
    return docs


@router.post("/admin/podcast/content")
def create_content(data: ContentIn, admin=Depends(require_admin)):
    if data.content_type not in VALID_CONTENT_TYPES:
        raise HTTPException(400, f"Invalid content_type. Must be one of: {', '.join(VALID_CONTENT_TYPES)}")
    if data.person_id and not db.podcast_people.find_one({"id": data.person_id}):
        raise HTTPException(404, "Person not found")
    if not data.raw_text.strip():
        raise HTTPException(400, "raw_text is required")

    doc = {
        "id":                str(uuid.uuid4()),
        "person_id":         data.person_id,
        "title":             data.title,
        "content_type":      data.content_type,
        "raw_text":          data.raw_text,
        "extracted":         {"topics": [], "subtopics": [], "viewpoints": [], "keywords": []},
        "extraction_status": "pending",
        "created_at":        _NOW(),
    }
    db.podcast_content.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("raw_text", None)   # don't echo large text back
    return doc


@router.post("/admin/podcast/content/{content_id}/extract")
def extract_content(content_id: str, admin=Depends(require_admin)):
    """Run Gemini extraction on this content piece."""
    content = db.podcast_content.find_one({"id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(404, "Content not found")

    raw_text = content.get("raw_text", "").strip()
    if not raw_text:
        raise HTTPException(400, "Content has no text to extract from")

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(500, "GEMINI_API_KEY not configured")

    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model  = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    prompt = EXTRACT_PROMPT.format(text=raw_text[:8000])   # cap at 8k chars

    extracted = {"topics": [], "subtopics": [], "viewpoints": [], "keywords": []}
    for attempt in range(2):
        try:
            response = model.generate_content(prompt)
            raw      = response.text.strip().strip("```json").strip("```").strip()
            parsed   = _json.loads(raw)
            extracted = {
                "topics":     [str(x) for x in (parsed.get("topics")     or [])[:10]],
                "subtopics":  [str(x) for x in (parsed.get("subtopics")  or [])[:15]],
                "viewpoints": [str(x) for x in (parsed.get("viewpoints") or [])[:10]],
                "keywords":   [str(x) for x in (parsed.get("keywords")   or [])[:25]],
            }
            break
        except Exception as e:
            if attempt == 1:
                db.podcast_content.update_one(
                    {"id": content_id},
                    {"$set": {"extraction_status": "failed"}}
                )
                raise HTTPException(500, f"Extraction failed: {str(e)}")

    db.podcast_content.update_one(
        {"id": content_id},
        {"$set": {"extracted": extracted, "extraction_status": "done"}}
    )

    # Auto-suggest new topics from extraction into podcast_topics (source=ai, no people assigned)
    existing_topic_names = {
        t["name"].lower()
        for t in db.podcast_topics.find({}, {"name": 1, "_id": 0})
    }
    for topic_name in extracted["topics"]:
        if topic_name.lower() not in existing_topic_names:
            db.podcast_topics.insert_one({
                "id":          str(uuid.uuid4()),
                "name":        topic_name,
                "subtopics":   [],
                "source":      "ai",
                "people_ids":  [],
                "merged_into": None,
                "created_at":  _NOW(),
                "updated_at":  _NOW(),
            })
            existing_topic_names.add(topic_name.lower())

    result = db.podcast_content.find_one({"id": content_id}, {"_id": 0, "raw_text": 0})
    return result


@router.delete("/admin/podcast/content/{content_id}")
def delete_content(content_id: str, admin=Depends(require_admin)):
    r = db.podcast_content.delete_one({"id": content_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Content not found")
    return {"deleted": True}


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 3 — TOPICS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/topics")
def list_topics(admin=Depends(require_admin)):
    topics = list(db.podcast_topics.find({"merged_into": None}, {"_id": 0}).sort("name", 1))
    for t in topics:
        t["people_count"] = len(t.get("people_ids") or [])
    return topics


@router.post("/admin/podcast/topics")
def create_topic(data: TopicIn, admin=Depends(require_admin)):
    if not data.name.strip():
        raise HTTPException(400, "Topic name is required")
    if db.podcast_topics.find_one({"name": {"$regex": f"^{data.name.strip()}$", "$options": "i"}, "merged_into": None}):
        raise HTTPException(409, "A topic with this name already exists")
    doc = {
        "id":          str(uuid.uuid4()),
        "name":        data.name.strip(),
        "subtopics":   data.subtopics or [],
        "source":      "manual",
        "people_ids":  [],
        "merged_into": None,
        "created_at":  _NOW(),
        "updated_at":  _NOW(),
    }
    db.podcast_topics.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/admin/podcast/topics/{topic_id}")
def update_topic(topic_id: str, data: TopicUpdate, admin=Depends(require_admin)):
    topic = db.podcast_topics.find_one({"id": topic_id})
    if not topic:
        raise HTTPException(404, "Topic not found")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "Nothing to update")
    patch["updated_at"] = _NOW()
    db.podcast_topics.update_one({"id": topic_id}, {"$set": patch})
    return db.podcast_topics.find_one({"id": topic_id}, {"_id": 0})


@router.delete("/admin/podcast/topics/{topic_id}")
def delete_topic(topic_id: str, admin=Depends(require_admin)):
    topic = db.podcast_topics.find_one({"id": topic_id})
    if not topic:
        raise HTTPException(404, "Topic not found")
    if topic.get("people_ids"):
        raise HTTPException(409, "Cannot delete — people are assigned to this topic. Unassign first.")
    db.podcast_topics.delete_one({"id": topic_id})
    return {"deleted": True}


@router.post("/admin/podcast/topics/merge")
def merge_topics(data: TopicMerge, admin=Depends(require_admin)):
    """
    Merge one or more topics into a single keeper.
    All people_ids from absorbed topics are moved to the keeper.
    Absorbed topics are marked merged_into=keep_id (preserved, not deleted).
    """
    keeper = db.podcast_topics.find_one({"id": data.keep_id})
    if not keeper:
        raise HTTPException(404, "Keep topic not found")
    if data.keep_id in data.absorb_ids:
        raise HTTPException(400, "keep_id cannot be in absorb_ids")

    all_people = set(keeper.get("people_ids") or [])
    absorbed   = []
    for aid in data.absorb_ids:
        t = db.podcast_topics.find_one({"id": aid})
        if not t:
            continue
        all_people.update(t.get("people_ids") or [])
        db.podcast_topics.update_one(
            {"id": aid},
            {"$set": {"merged_into": data.keep_id, "people_ids": [], "updated_at": _NOW()}}
        )
        absorbed.append(aid)

    # Update source to "both" if keeper was manual and absorbed topics existed
    new_source = keeper.get("source", "manual")
    if new_source == "manual" and absorbed:
        new_source = "both"

    db.podcast_topics.update_one(
        {"id": data.keep_id},
        {"$set": {"people_ids": list(all_people), "source": new_source, "updated_at": _NOW()}}
    )
    return {
        "kept":     data.keep_id,
        "absorbed": absorbed,
        "total_people": len(all_people),
    }


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 4 — CANDIDATES
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/candidates")
def list_candidates(
    status: Optional[str] = None,
    role:   Optional[str] = None,
    admin=Depends(require_admin),
):
    q = {}
    if status: q["status"] = status
    if role:   q["role"]   = role
    return list(db.podcast_candidates.find(q, {"_id": 0}).sort("score", -1))


@router.post("/admin/podcast/candidates/refresh")
def refresh_candidates(admin=Depends(require_admin)):
    """
    Rescore all active podcast_people and upsert podcast_candidates.
    Existing status / admin_notes / admin_boost are preserved.
    Fully batched — O(10) queries regardless of pool size.
    """
    from pymongo import UpdateOne, InsertOne

    people = list(db.podcast_people.find({"status": "active"}, {"_id": 0}))
    if not people:
        return {"created": 0, "updated": 0, "total": 0}

    person_ids   = [p["id"] for p in people]
    person_id_set = set(person_ids)

    # ── Batch 1: rager identity ───────────────────────────────────────────────
    rager_ids  = [p["rager_id"] for p in people if p.get("rager_id")]
    ragers_map = {}
    if rager_ids:
        for r in db.ragers.find({"id": {"$in": rager_ids}}, {"_id": 0, "phone": 0}):
            ragers_map[r["id"]] = r

    # ── Batch 2: topics — build person→[topic_ids] and topic→name maps ───────
    all_topics    = list(db.podcast_topics.find({"merged_into": None}, {"_id": 0}))
    topic_name    = {t["id"]: t["name"] for t in all_topics}
    person_topics: dict = {}   # person_id → [topic_id]
    for t in all_topics:
        for pid in (t.get("people_ids") or []):
            if pid in person_id_set:
                person_topics.setdefault(pid, []).append(t["id"])

    # ── Batch 3: content grouped by person_id ─────────────────────────────────
    content_by_person: dict = {}
    for doc in db.podcast_content.find(
        {"person_id": {"$in": person_ids}}, {"_id": 0}
    ):
        content_by_person.setdefault(doc["person_id"], []).append(doc)

    # ── Batch 4: activity (rager-linked only) ─────────────────────────────────
    dinner_count_map: dict = {}
    allocs_by_rager:  dict = {}
    archived_enq_ids: set  = set()

    if rager_ids:
        for inv in db.invites.find(
            {"rager_id": {"$in": rager_ids}, "rsvp_status": "yes"},
            {"rager_id": 1, "_id": 0}
        ):
            rid = inv["rager_id"]
            dinner_count_map[rid] = dinner_count_map.get(rid, 0) + 1

        for alloc in db.allocations.find(
            {"member_id": {"$in": rager_ids}}, {"_id": 0}
        ):
            allocs_by_rager.setdefault(alloc["member_id"], []).append(alloc)

        all_enq_ids = list({
            a.get("enquiry_id")
            for allocs in allocs_by_rager.values()
            for a in allocs
            if a.get("enquiry_id")
        })
        if all_enq_ids:
            archived_enq_ids = {
                e["id"] for e in db.enquiries.find(
                    {"id": {"$in": all_enq_ids}, "is_archived": True},
                    {"id": 1, "_id": 0}
                )
            }

    # ── Batch 5: existing candidates ─────────────────────────────────────────
    existing_cands = {
        c["person_id"]: c
        for c in db.podcast_candidates.find(
            {"person_id": {"$in": person_ids}}, {"_id": 0}
        )
    }

    # ── Score each person entirely in Python ─────────────────────────────────
    ops     = []
    created = updated = 0
    now     = _NOW()

    for pp in people:
        person_id = pp["id"]
        rager_id  = pp.get("rager_id")

        # Resolve identity
        resolved = dict(pp)
        if rager_id and rager_id in ragers_map:
            r = ragers_map[rager_id]
            resolved.update({
                "name":      r.get("name",     pp.get("name",     "")),
                "title":     r.get("title",    pp.get("title",    "")),
                "company":   r.get("company",  pp.get("company",  "")),
                "bio":       r.get("bio",      pp.get("bio",      "")),
                "linkedin":  r.get("linkedin", pp.get("linkedin", "")),
                "location":  r.get("location", pp.get("location", "")),
                "expertise": pp.get("expertise") or r.get("expertise") or [],
            })

        # Topic relevance
        topic_ids       = person_topics.get(person_id, [])
        topic_relevance = min(len(topic_ids) * 8, 40)

        # Content
        content_docs     = content_by_person.get(person_id, [])
        content_count    = len(content_docs)
        content_quantity = min(content_count * 5, 15)
        total_signals    = 0
        for c in content_docs:
            ext = c.get("extracted") or {}
            total_signals += len(ext.get("topics",    []))
            total_signals += len(ext.get("viewpoints", []))
            total_signals += len(ext.get("keywords",   []))
            total_signals += len(ext.get("subtopics",  []))
        content_quality = min(total_signals, 15)

        # Role
        role        = pp.get("role", "other")
        role_weight = ROLE_WEIGHT.get(role, 4)

        # Bio completeness
        bio           = resolved.get("bio", "") or ""
        linkedin      = resolved.get("linkedin", "") or ""
        known_for     = pp.get("known_for", "") or ""
        current_focus = pp.get("current_focus", "") or ""
        bio_completeness = min(
            (3 if bio else 0) + (2 if len(bio) > 200 else 0) +
            (2 if linkedin else 0) + (2 if known_for else 0) +
            (1 if current_focus else 0),
            10
        )

        # Tag richness
        all_tags     = list(set((pp.get("tags") or []) + (resolved.get("expertise") or [])))
        tag_richness = min(len(all_tags) * 2, 10)

        # Inline viewpoints
        inline_vp = len(pp.get("viewpoints") or [])
        if inline_vp:
            content_quality = min(content_quality + min(inline_vp * 2, 6), 15)

        raw_score = (
            topic_relevance + content_quantity + content_quality +
            role_weight + bio_completeness + tag_richness
        )

        breakdown = {
            "topic_relevance":  {"topics":  len(topic_ids),  "points": topic_relevance},
            "content_quantity": {"pieces":  content_count,   "points": content_quantity},
            "content_quality":  {"signals": total_signals + inline_vp, "points": content_quality},
            "role_weight":      {"role":    role,             "points": role_weight},
            "bio_completeness": {                             "points": bio_completeness},
            "tag_richness":     {"tags":    len(all_tags),   "points": tag_richness},
        }

        # Activity layer
        activity_bonus     = 0
        activity_breakdown = {}
        d_count = conf_count = 0

        if rager_id:
            d_count = dinner_count_map.get(rager_id, 0)
            if d_count:
                d_pts = min(d_count * 5, 20)
                activity_bonus += d_pts
                activity_breakdown["dinner_attendance"] = {"count": d_count, "points": d_pts}

            allocs = [
                a for a in allocs_by_rager.get(rager_id, [])
                if a.get("enquiry_id") not in archived_enq_ids
            ]
            if allocs:
                conf_count = sum(1 for a in allocs if a.get("status") == "confirmed")
                adv_pts    = min(conf_count * 8, 24)
                activity_bonus += adv_pts
                activity_breakdown["advisory"] = {"confirmed": conf_count, "points": adv_pts}

            if d_count >= 2 and conf_count >= 1:
                activity_bonus += 10
                activity_breakdown["cross_module"] = {"points": 10}

        if activity_breakdown:
            breakdown["activity"] = activity_breakdown

        signals = []
        if topic_ids:  signals.append("has_topics")
        if content_count: signals.append("has_content")
        if activity_breakdown.get("dinner_attendance"):   signals.append("dinner_attendance")
        if activity_breakdown.get("advisory"):            signals.append("advisory_confirmed")
        if d_count >= 2 and conf_count >= 1:              signals.append("cross_module_engagement")

        existing    = existing_cands.get(person_id)
        admin_boost = (existing or {}).get("admin_boost", pp.get("admin_boost", 0)) or 0
        final_score = raw_score + admin_boost + activity_bonus

        patch = {
            "person_id":        person_id,
            "name":             resolved.get("name", ""),
            "company":          resolved.get("company", ""),
            "role":             role,
            "score":            final_score,
            "raw_score":        raw_score,
            "score_breakdown":  breakdown,
            "source_signals":   signals,
            "topic_ids":        topic_ids,
            "content_count":    content_count,
            "activity_bonus":   activity_bonus,
            "updated_at":       now,
            "suggested_topics": [topic_name[tid] for tid in topic_ids if tid in topic_name],
        }

        if existing:
            ops.append(UpdateOne({"person_id": person_id}, {"$set": patch}))
            updated += 1
        else:
            patch.update({
                "id":               str(uuid.uuid4()),
                "status":           "candidate",
                "admin_boost":      admin_boost,
                "admin_notes":      "",
                "last_reviewed_at": None,
                "created_at":       now,
            })
            ops.append(InsertOne(patch))
            created += 1

    if ops:
        db.podcast_candidates.bulk_write(ops, ordered=False)

    return {
        "created": created,
        "updated": updated,
        "total":   db.podcast_candidates.count_documents({}),
    }


@router.get("/admin/podcast/candidates/{candidate_id}")
def get_candidate(candidate_id: str, admin=Depends(require_admin)):
    cand = db.podcast_candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not cand:
        raise HTTPException(404, "Candidate not found")

    person_id = cand["person_id"]
    pp        = db.podcast_people.find_one({"id": person_id}, {"_id": 0}) or {}
    resolved  = _resolve_person(pp)

    # Topics
    topics = list(db.podcast_topics.find(
        {"id": {"$in": cand.get("topic_ids") or []}, "merged_into": None},
        {"_id": 0, "id": 1, "name": 1, "subtopics": 1}
    ))

    # Content (no raw_text)
    content = list(db.podcast_content.find(
        {"person_id": person_id},
        {"_id": 0, "raw_text": 0}
    ))

    # Decisions log
    decisions = list(
        db.podcast_invite_decisions.find(
            {"candidate_id": candidate_id}, {"_id": 0}
        ).sort("created_at", -1)
    )

    # Top pairs
    pairs = list(db.podcast_pairs.find(
        {
            "$or": [{"person_1_id": person_id}, {"person_2_id": person_id}],
            "status": {"$ne": "rejected"},
        },
        {"_id": 0}
    ).sort("compatibility_score", -1).limit(5))
    for pair in pairs:
        other_id = pair["person_2_id"] if pair["person_1_id"] == person_id else pair["person_1_id"]
        other_pp = db.podcast_people.find_one({"id": other_id}, {"_id": 0})
        if other_pp:
            pair["other_person"] = _resolve_person(other_pp)

    # Activity data (if rager-linked)
    rager_id       = pp.get("rager_id")
    dinner_history = []
    advisory_history = []
    if rager_id:
        dinner_invites = list(db.invites.find({"rager_id": rager_id}, {"_id": 0}))
        event_ids      = [i["event_id"] for i in dinner_invites]
        events_map     = {
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
            }
            for inv in dinner_invites
        ]
        allocs = list(db.allocations.find({"member_id": rager_id}, {"_id": 0}))
        if allocs:
            enq_ids = [a["enquiry_id"] for a in allocs if a.get("enquiry_id")]
            enq_map = {
                e["id"]: e for e in db.enquiries.find(
                    {"id": {"$in": enq_ids}, "is_archived": {"$ne": True}},
                    {"_id": 0, "id": 1, "topic": 1, "category": 1}
                )
            } if enq_ids else {}
            for a in allocs:
                enq = enq_map.get(a.get("enquiry_id"))
                if not enq:
                    continue
                topic = enq.get("topic") or enq.get("category") or "—"
                advisory_history.append({"status": a.get("status"), "topic": topic})

    return {
        **cand,
        "person":           resolved,
        "topics":           topics,
        "content":          content,
        "decisions":        decisions,
        "top_pairs":        pairs,
        "dinner_history":   dinner_history,
        "advisory_history": advisory_history,
    }


@router.patch("/admin/podcast/candidates/{candidate_id}")
def update_candidate(candidate_id: str, data: CandidateUpdate, admin=Depends(require_admin)):
    cand = db.podcast_candidates.find_one({"id": candidate_id})
    if not cand:
        raise HTTPException(404, "Candidate not found")
    if data.status and data.status not in VALID_CAND_STATUSES:
        raise HTTPException(400, f"Invalid status")

    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "Nothing to update")

    if "admin_boost" in patch:
        boost          = max(0, min(20, patch["admin_boost"]))
        patch["admin_boost"] = boost
        patch["score"] = cand.get("raw_score", 0) + boost + cand.get("activity_bonus", 0)

    if "status" in patch:
        patch["last_reviewed_at"] = _NOW()

    patch["updated_at"] = _NOW()
    db.podcast_candidates.update_one({"id": candidate_id}, {"$set": patch})
    return db.podcast_candidates.find_one({"id": candidate_id}, {"_id": 0})


# ─────────────────────────────────────────────────────────────────────────────
# DECISION LOG (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/admin/podcast/decisions")
def add_decision(data: DecisionIn, admin=Depends(require_admin)):
    if not db.podcast_candidates.find_one({"id": data.candidate_id}):
        raise HTTPException(404, "Candidate not found")
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


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 5 — PAIRS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/pairs")
def list_pairs(
    status: Optional[str] = None,
    topic:  Optional[str] = None,
    admin=Depends(require_admin),
):
    q = {}
    if status: q["status"] = status
    if topic:  q["primary_topic"] = {"$regex": topic, "$options": "i"}
    return list(db.podcast_pairs.find(q, {"_id": 0}).sort("compatibility_score", -1))


@router.post("/admin/podcast/pairs/generate")
def generate_pairs(admin=Depends(require_admin)):
    """
    Regenerate pairs from top 50 non-excluded candidates.
    Auto-generated pairs are replaced. Manually set pairs (source=manual) are preserved.
    """
    candidates = list(db.podcast_candidates.find(
        {"status": {"$nin": ["not_fit_now", "declined"]}},
        {"_id": 0}
    ).sort("score", -1).limit(50))

    if len(candidates) < 2:
        raise HTTPException(400, "Need at least 2 candidates to generate pairs")

    # ── Pre-load shared data — eliminates N+1 inside the combo loop ──────────
    topics_map: dict = {
        t["id"]: t
        for t in db.podcast_topics.find({"merged_into": None}, {"_id": 0})
    }

    person_ids      = [c["person_id"] for c in candidates]
    viewpoints_map: dict = {}
    for pp in db.podcast_people.find(
        {"id": {"$in": person_ids}}, {"id": 1, "viewpoints": 1, "_id": 0}
    ):
        viewpoints_map[pp["id"]] = set(
            v.lower().strip() for v in (pp.get("viewpoints") or [])
        )
    for doc in db.podcast_content.find(
        {"person_id": {"$in": person_ids}},
        {"person_id": 1, "extracted.viewpoints": 1, "_id": 0}
    ):
        pid = doc["person_id"]
        for v in (doc.get("extracted") or {}).get("viewpoints", []):
            viewpoints_map.setdefault(pid, set()).add(v.lower().strip())
    # ─────────────────────────────────────────────────────────────────────────

    db.podcast_pairs.delete_many({"source": "auto"})

    created = 0
    for ca, cb in combinations(candidates, 2):
        score, reasons, primary_topic, role_pairing = _pair_compat(ca, cb, topics_map, viewpoints_map)
        if score < 5:
            continue
        db.podcast_pairs.insert_one({
            "id":                  str(uuid.uuid4()),
            "person_1_id":         ca["person_id"],
            "person_1_name":       ca.get("name", ""),
            "person_1_company":    ca.get("company", ""),
            "person_1_role":       ca.get("role", "other"),
            "person_2_id":         cb["person_id"],
            "person_2_name":       cb.get("name", ""),
            "person_2_company":    cb.get("company", ""),
            "person_2_role":       cb.get("role", "other"),
            "compatibility_score": score,
            "primary_topic":       primary_topic,
            "role_pairing":        role_pairing,
            "reasons":             reasons,
            "status":              "suggested",
            "source":              "auto",
            "created_at":          _NOW(),
            "updated_at":          _NOW(),
        })
        created += 1

    return {"pairs_created": created}


@router.patch("/admin/podcast/pairs/{pair_id}")
def update_pair(pair_id: str, data: PairStatusUpdate, admin=Depends(require_admin)):
    if data.status not in VALID_PAIR_STATUSES:
        raise HTTPException(400, f"Invalid status")
    r = db.podcast_pairs.update_one(
        {"id": pair_id},
        {"$set": {"status": data.status, "updated_at": _NOW()}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Pair not found")
    return db.podcast_pairs.find_one({"id": pair_id}, {"_id": 0})


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 6 — 4-PERSON TABLES
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/tables")
def list_tables(
    status: Optional[str] = None,
    topic:  Optional[str] = None,
    admin=Depends(require_admin),
):
    q = {}
    if status: q["status"] = status
    if topic:  q["primary_topic"] = {"$regex": topic, "$options": "i"}
    return list(db.podcast_tables.find(q, {"_id": 0}).sort("score", -1))


@router.post("/admin/podcast/tables/generate")
def generate_tables(admin=Depends(require_admin)):
    """
    Generate 4-person Sunday Table suggestions, grouped by topic.
    Pool: top 40 non-excluded candidates.
    Per topic: try all C(pool, 4) combinations; store top 5 per topic.

    Hard reject:
      - any two people from same company
      - fewer than 2 distinct roles
      - fewer than 2 people anchored to this topic
      - score < 25
    """
    candidates = list(db.podcast_candidates.find(
        {"status": {"$nin": ["not_fit_now", "declined"]}},
        {"_id": 0}
    ).sort("score", -1).limit(40))

    if len(candidates) < 4:
        raise HTTPException(400, "Need at least 4 candidates to generate tables")

    # ── Pre-load shared data — eliminates N+1 inside the combo loops ─────────
    topics_map: dict = {
        t["id"]: t
        for t in db.podcast_topics.find({"merged_into": None}, {"_id": 0})
    }

    person_ids       = [c["person_id"] for c in candidates]
    viewpoints_map: dict = {}
    for pp in db.podcast_people.find(
        {"id": {"$in": person_ids}}, {"id": 1, "viewpoints": 1, "_id": 0}
    ):
        viewpoints_map[pp["id"]] = set(
            v.lower().strip() for v in (pp.get("viewpoints") or [])
        )
    for doc in db.podcast_content.find(
        {"person_id": {"$in": person_ids}},
        {"person_id": 1, "extracted.viewpoints": 1, "_id": 0}
    ):
        pid = doc["person_id"]
        for v in (doc.get("extracted") or {}).get("viewpoints", []):
            viewpoints_map.setdefault(pid, set()).add(v.lower().strip())
    # ─────────────────────────────────────────────────────────────────────────

    db.podcast_tables.delete_many({"source": "auto"})

    # Group candidates by topic_id
    topic_groups: dict = {}
    for c in candidates:
        for tid in (c.get("topic_ids") or []):
            topic_groups.setdefault(tid, []).append(c)

    seen_combos: set = set()
    created          = 0

    for topic_id, pool in topic_groups.items():
        if len(pool) < 4:
            continue

        best_for_topic = []   # (score, doc)

        for combo in combinations(pool[:20], 4):
            ids = tuple(sorted(m["person_id"] for m in combo))
            if ids in seen_combos:
                continue

            # Hard reject: duplicate company
            companies = [m.get("company", "").strip().lower() for m in combo if m.get("company")]
            if len(companies) != len(set(companies)):
                continue

            # Hard reject: fewer than 2 distinct roles
            if len(set(m.get("role", "other") for m in combo)) < 2:
                continue

            # Hard reject: fewer than 2 people on primary topic
            on_topic = sum(1 for m in combo if topic_id in (m.get("topic_ids") or []))
            if on_topic < 2:
                continue

            score, breakdown, reasons, why, role_comp = _table_score(
                list(combo), topic_id, topics_map, viewpoints_map
            )
            if score < 25:
                continue

            seen_combos.add(ids)
            best_for_topic.append((score, breakdown, reasons, why, role_comp, list(combo)))

        # Keep top 5 for this topic
        best_for_topic.sort(key=lambda x: x[0], reverse=True)
        topic_name = (topics_map.get(topic_id) or {}).get("name", topic_id)

        for score, breakdown, reasons, why, role_comp, combo in best_for_topic[:5]:
            db.podcast_tables.insert_one({
                "id":            str(uuid.uuid4()),
                "title":         f"Table: {topic_name}",
                "primary_topic": topic_name,
                "topic_id":      topic_id,
                "person_ids":    [m["person_id"] for m in combo],
                "member_summaries": [
                    {
                        "person_id": m["person_id"],
                        "name":      m.get("name", ""),
                        "company":   m.get("company", ""),
                        "role":      m.get("role", "other"),
                    }
                    for m in combo
                ],
                "score":            score,
                "score_breakdown":  breakdown,
                "role_composition": role_comp,
                "why_it_works":     why,
                "reasons":          reasons,
                "status":           "suggested",
                "source":           "auto",
                "created_at":       _NOW(),
                "updated_at":       _NOW(),
            })
            created += 1

    return {"tables_created": created}


@router.patch("/admin/podcast/tables/{table_id}")
def update_table(table_id: str, data: TableStatusUpdate, admin=Depends(require_admin)):
    if data.status not in VALID_TABLE_STATUSES:
        raise HTTPException(400, "Invalid status")
    r = db.podcast_tables.update_one(
        {"id": table_id},
        {"$set": {"status": data.status, "updated_at": _NOW()}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Table not found")
    return db.podcast_tables.find_one({"id": table_id}, {"_id": 0})


@router.delete("/admin/podcast/tables/{table_id}")
def delete_table(table_id: str, admin=Depends(require_admin)):
    r = db.podcast_tables.delete_one({"id": table_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Table not found")
    return {"deleted": True}


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 7 — ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/podcast/analytics")
def podcast_analytics(admin=Depends(require_admin)):
    # Candidate funnel
    by_status = {
        s: db.podcast_candidates.count_documents({"status": s})
        for s in VALID_CAND_STATUSES
    }

    # People breakdown
    by_source = {
        s: db.podcast_people.count_documents({"source": s, "status": "active"})
        for s in VALID_PERSON_SOURCES
    }
    by_role = {
        r: db.podcast_people.count_documents({"role": r, "status": "active"})
        for r in VALID_PERSON_ROLES
    }

    # Topic coverage (topics with people assigned)
    topics = list(db.podcast_topics.find(
        {"merged_into": None},
        {"_id": 0, "name": 1, "people_ids": 1}
    ))
    topic_coverage = sorted(
        [{"topic": t["name"], "count": len(t.get("people_ids") or [])} for t in topics],
        key=lambda x: x["count"],
        reverse=True
    )

    # Tables readiness: topics with 4+ active candidates
    table_ready_topics = [t for t in topic_coverage if t["count"] >= 4]

    # Content stats
    total_content  = db.podcast_content.count_documents({})
    extracted_count = db.podcast_content.count_documents({"extraction_status": "done"})

    return {
        "total_people":        db.podcast_people.count_documents({"status": "active"}),
        "by_source":           by_source,
        "by_role":             by_role,
        "total_topics":        len(topics),
        "topic_coverage":      topic_coverage[:15],
        "table_ready_topics":  table_ready_topics,
        "total_content":       total_content,
        "extracted_content":   extracted_count,
        "total_candidates":    db.podcast_candidates.count_documents({}),
        "by_status":           by_status,
        "shortlisted_pairs":   db.podcast_pairs.count_documents({"status": "shortlisted"}),
        "total_tables":        db.podcast_tables.count_documents({}),
        "shortlisted_tables":  db.podcast_tables.count_documents({"status": "shortlisted"}),
    }
