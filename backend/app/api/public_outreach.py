from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.services.tokens import validate_token, mark_token_used
from app.services.responses import record_response

router = APIRouter()


def _page(title: str, body: str, accent: str = "#dc143c") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title} — R.A.G.E.</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:Georgia,serif;background:#f4f4f0;display:flex;
          align-items:center;justify-content:center;min-height:100vh;padding:24px}}
    .card{{background:#fff;max-width:480px;width:100%;padding:48px 40px;
           border-top:3px solid {accent};}}
    .logo{{font-size:10px;letter-spacing:0.25em;text-transform:uppercase;
           color:{accent};margin-bottom:28px}}
    h1{{font-size:26px;font-weight:400;color:#111827;margin-bottom:16px;line-height:1.3}}
    p{{font-size:14px;color:#6b7280;line-height:1.75}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">R.A.G.E.</div>
    <h1>{title}</h1>
    <p>{body}</p>
  </div>
</body>
</html>"""


RESPONSE_COPY = {
    "accept": (
        "Thank you — we'll be in touch.",
        "You've indicated interest in this advisory opportunity. "
        "The RAGE team will follow up shortly with next steps.",
        "#dc143c",
    ),
    "decline": (
        "Noted — no problem.",
        "You've passed on this opportunity. "
        "We'll keep you in mind for future requests that may be a better fit.",
        "#374151",
    ),
    "need_context": (
        "Got it — we'll send more details.",
        "You've asked for more context. "
        "A member of the RAGE team will reach out with additional information before any commitment is needed.",
        "#374151",
    ),
}


@router.get("/public/outreach/respond", response_class=HTMLResponse)
def respond_to_outreach(token: str):
    token_doc, error = validate_token(token)

    if error == "invalid":
        return HTMLResponse(
            _page("Invalid link", "This link is not valid. Please check your email for the correct link."),
            status_code=404,
        )

    if error == "expired":
        return HTMLResponse(
            _page("Link expired", "This link has expired. Please contact the RAGE team if you still want to respond."),
            status_code=410,
        )

    if error == "used":
        action = token_doc.get("action_type", "accept")
        title, body, accent = RESPONSE_COPY.get(action, RESPONSE_COPY["accept"])
        return HTMLResponse(
            _page("Already recorded", f"Your response has already been recorded. {body}"),
            status_code=200,
        )

    # Valid token — record response and mark used
    action = token_doc["action_type"]
    response_doc, was_duplicate = record_response(token_doc)
    mark_token_used(token)

    title, body, accent = RESPONSE_COPY.get(action, RESPONSE_COPY["accept"])
    return HTMLResponse(_page(title, body, accent), status_code=200)
