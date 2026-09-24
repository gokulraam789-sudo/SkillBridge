"""Semantic layer shared by extraction, matching and analytics.

Skill names are embedded as sparse character-trigram + token vectors and compared
by cosine similarity, so "postgres", "PostgreSQL" and "writing SQL queries" all
land on the same node without an exact keyword match. A curated adjacency map adds
transfer credit between genuinely related skills (PyTorch work counts partially
towards machine learning).

Kept dependency-free on purpose: it runs offline in a Codespace with no model
download. `services/llm.py` layers an LLM pass on top when a key is configured,
and the interfaces are identical, so swapping in a hosted embedding model later
only touches this file.
"""

import math
import re
from collections import Counter
from typing import Dict, Iterable, List, Tuple

_WORD = re.compile(r"[a-z0-9+#.]+")

# Transfer credit: having the key skill partially evidences the listed skills.
RELATED: Dict[str, Dict[str, float]] = {
    "deep-learning": {"ml": 0.6, "python": 0.3},
    "nlp": {"ml": 0.5, "deep-learning": 0.4},
    "ml": {"statistics": 0.4, "data-cleaning": 0.3},
    "big-data": {"data-cleaning": 0.4, "sql": 0.3},
    "data-viz": {"data-cleaning": 0.2, "communication": 0.2},
    "powerbi": {"data-viz": 0.6, "excel": 0.3},
    "tableau": {"data-viz": 0.6},
    "react": {"javascript": 0.6, "html-css": 0.4},
    "nodejs": {"javascript": 0.6, "rest-api": 0.4},
    "django": {"python": 0.5, "rest-api": 0.4},
    "typescript": {"javascript": 0.7},
    "kubernetes": {"docker": 0.6, "linux": 0.3},
    "terraform": {"aws": 0.3, "ci-cd": 0.3},
    "aws": {"linux": 0.3, "networking": 0.2},
    "azure": {"aws": 0.4, "linux": 0.2},
    "ci-cd": {"git": 0.4, "docker": 0.3},
    "mlops": {"docker": 0.4, "ci-cd": 0.3, "ml": 0.3},
    "siem": {"security-fundamentals": 0.5, "networking": 0.3},
    "threat-analysis": {"security-fundamentals": 0.6, "networking": 0.3},
    "incident-response": {"security-fundamentals": 0.5, "siem": 0.4},
    "cryptography": {"security-fundamentals": 0.4},
    "system-design": {"rest-api": 0.3, "dsa": 0.3},
    "oop": {"dsa": 0.3},
    "testing": {"problem-solving": 0.2},
    "excel": {"data-cleaning": 0.3},
    "business-analysis": {"communication": 0.3, "product-thinking": 0.4},
    "agile": {"teamwork": 0.4},
    "ownership": {"teamwork": 0.3},
}


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def tokens(text: str) -> List[str]:
    return _WORD.findall(normalise(text))


def _vector(text: str) -> Counter:
    t = normalise(text)
    vec = Counter()
    for tok in tokens(t):
        vec[f"w:{tok}"] += 2.0
    padded = f"  {t} "
    for i in range(len(padded) - 2):
        vec[f"g:{padded[i:i + 3]}"] += 1.0
    return vec


def cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    small, large = (a, b) if len(a) < len(b) else (b, a)
    dot = sum(v * large.get(k, 0.0) for k, v in small.items())
    if dot == 0:
        return 0.0
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb)


class SkillIndex:
    """Vector index over the skill vocabulary, rebuilt whenever an admin adds skills."""

    def __init__(self, entries: Iterable[Tuple[str, str, List[str]]]):
        # entries: (slug, name, aliases)
        self.vectors: Dict[str, List[Counter]] = {}
        self.surfaces: Dict[str, List[str]] = {}
        self.names: Dict[str, str] = {}
        self.postings: Dict[str, set] = {}  # token -> slugs, for fast candidate lookup
        for slug, name, aliases in entries:
            self.names[slug] = name
            surfaces = [name, slug.replace("-", " ")] + list(aliases or [])
            surfaces = [normalise(s) for s in surfaces if s]
            self.surfaces[slug] = surfaces
            self.vectors[slug] = [_vector(s) for s in surfaces]
            for surface in surfaces:
                for tok in tokens(surface):
                    self.postings.setdefault(tok, set()).add(slug)

    def score(self, phrase: str, slug: str) -> float:
        v = _vector(phrase)
        return max((cosine(v, sv) for sv in self.vectors.get(slug, [])), default=0.0)

    def resolve(self, phrase: str, threshold: float = 0.55) -> Tuple[str, float]:
        """Map a free-text phrase onto the closest skill node."""
        v = _vector(phrase)
        best, best_score = "", 0.0
        for slug, surfaces in self.vectors.items():
            s = max((cosine(v, sv) for sv in surfaces), default=0.0)
            if s > best_score:
                best, best_score = slug, s
        return (best, best_score) if best_score >= threshold else ("", best_score)

    def mentions(self, text: str, threshold: float = 0.78) -> Dict[str, Tuple[float, str]]:
        """Find every skill evidenced anywhere in a document.

        Two passes: an exact surface-form pass that catches a skill named inside a
        long sentence, then a fuzzy window pass over the remaining vocabulary that
        catches spelling and spacing variants the first pass misses.

        Returns slug -> (strength 0..1, the sentence it was found in).
        """
        found: Dict[str, Tuple[float, str]] = {}
        sentences = [s.strip() for s in re.split(r"[\n.;•·|]+", text or "") if s.strip()]

        for sentence in sentences:
            flat = normalise(sentence)
            sentence_tokens = set(tokens(flat))
            candidates = set()
            for tok in sentence_tokens:
                candidates |= self.postings.get(tok, set())

            # Pass 1 - exact surface form, respecting word boundaries.
            for slug in candidates:
                for i, surface in enumerate(self.surfaces[slug]):
                    if len(surface) <= 2 and surface not in sentence_tokens:
                        continue
                    pattern = r"(?<![a-z0-9])" + re.escape(surface) + r"(?![a-z0-9])"
                    if re.search(pattern, flat):
                        strength = 1.0 if i == 0 else 0.92
                        prev = found.get(slug)
                        if not prev or strength > prev[0]:
                            found[slug] = (strength, sentence[:220])
                        break

            # Pass 2 - fuzzy windows for candidates the exact pass did not resolve.
            unresolved = [c for c in candidates if c not in found]
            if not unresolved:
                continue
            words = tokens(flat)
            windows = set()
            for size in (1, 2, 3):
                for i in range(len(words) - size + 1):
                    windows.add(" ".join(words[i:i + size]))
            for window in windows:
                wv = _vector(window)
                for slug in unresolved:
                    score = max((cosine(wv, sv) for sv in self.vectors[slug]), default=0.0)
                    if score >= threshold:
                        prev = found.get(slug)
                        if not prev or score > prev[0]:
                            found[slug] = (score, sentence[:220])
        return found


def transfer_credit(held: Dict[str, int], target_slug: str) -> Tuple[float, str]:
    """Partial credit for a missing skill from adjacent skills the student does hold.

    Returns (0..1 fraction of expected level, human-readable reason).
    """
    best, reason = 0.0, ""
    for holder, level in held.items():
        weight = RELATED.get(holder, {}).get(target_slug, 0.0)
        if weight <= 0:
            continue
        credit = weight * min(level, 5) / 5.0
        if credit > best:
            best, reason = credit, holder
    return best, reason
