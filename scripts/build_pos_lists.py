#!/usr/bin/env python3
"""
Build POS-categorized word lists for Chomsky.

Approach: a flat input word list is matched against four reference word lists
(ref-adv.txt, ref-adj.txt, ref-verb.txt, ref-noun.txt). A word is placed into a
POS list iff it appears in that POS's reference file.

Nouns are emitted in PLURAL form: an input noun (singular) is looked up in
ref-noun-plurals.json (singular -> plural) and the plural is added. Words with no
plural entry are skipped. This keeps subject-verb agreement under the fixed
template (plural noun + base verb).

Input : plain-text word list, one word per line (default scripts/words-longlist.txt)
Output: words-noun.js / words-verb.js / words-adj.js / words-adv.js  (repo root)

Usage:
    python3 scripts/build_pos_lists.py
    python3 scripts/build_pos_lists.py --source path/to/input.txt
"""

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
DEFAULT_SOURCE = SCRIPTS_DIR / "words-longlist.txt"

REF_FILES = {
    "adv": SCRIPTS_DIR / "ref-adv.txt",
    "adj": SCRIPTS_DIR / "ref-adj.txt",
    "verb": SCRIPTS_DIR / "ref-verb.txt",
    "noun": SCRIPTS_DIR / "ref-noun.txt",
}
NOUN_PLURALS = SCRIPTS_DIR / "ref-noun-plurals.json"


def load_ref_set(path):
    """Load a reference file: one word per line -> set of lowercase words."""
    words = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            w = line.strip().lower()
            if w:
                words.add(w)
    return words


def load_input(path):
    """Load the input word list: one word per line."""
    words = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            w = line.strip().lower()
            if w:
                words.append(w)
    return words


def load_noun_plurals(path):
    """Load singular -> plural map from JSON."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Build POS-categorized word lists for Chomsky by matching "
                    "an input list against reference POS lists."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to the input word-list .txt file "
             "(default: scripts/words-longlist.txt)",
    )
    args = parser.parse_args()

    print("Loading reference lists ...")
    refs = {pos: load_ref_set(p) for pos, p in REF_FILES.items()}
    for pos, s in refs.items():
        print(f"  ref-{pos}: {len(s):,} words")

    print("Loading noun plurals map ...")
    noun_plurals = load_noun_plurals(NOUN_PLURALS)
    print(f"  {len(noun_plurals):,} singular->plural entries")

    print("Loading input word list ...")
    input_words = load_input(args.source)
    print(f"  {len(input_words):,} input words (from {args.source})")

    lists = {"noun": set(), "verb": set(), "adj": set(), "adv": set()}
    stats = {
        "total_input": len(input_words),
        "matched": 0,
        "dropped_no_match": 0,
        "noun_no_plural": 0,
        "counts": {"noun": 0, "verb": 0, "adj": 0, "adv": 0},
    }

    for word in input_words:
        matched_any = False

        if word in refs["adv"]:
            lists["adv"].add(word)
            matched_any = True
        if word in refs["adj"]:
            lists["adj"].add(word)
            matched_any = True
        if word in refs["verb"]:
            lists["verb"].add(word)
            matched_any = True
        if word in refs["noun"]:
            plural = noun_plurals.get(word)
            if plural:
                lists["noun"].add(plural)
                matched_any = True
            else:
                # Singular noun matched the ref but has no plural entry.
                stats["noun_no_plural"] += 1

        if matched_any:
            stats["matched"] += 1
        else:
            stats["dropped_no_match"] += 1

    print("Writing output files ...")
    for name in ("noun", "verb", "adj", "adv"):
        path = REPO_ROOT / f"words-{name}.js"
        ordered = sorted(lists[name])
        with open(path, "w", encoding="utf-8") as f:
            f.write(f'var WORDS_{name.upper()} = [\n')
            for i, w in enumerate(ordered):
                f.write(f'  "{w}"')
                f.write("," if i < len(ordered) - 1 else "")
                f.write("\n")
            f.write("];\n")
        stats["counts"][name] = len(ordered)
        print(f"  {path.name}: {len(ordered):,} words")

    print("\nSummary:")
    print(f"  Input words        : {stats['total_input']:,}")
    print(f"  Matched (>=1 POS)  : {stats['matched']:,}")
    print(f"  Dropped (no match) : {stats['dropped_no_match']:,}")
    print(f"  Noun, no plural    : {stats['noun_no_plural']:,}")
    for k in ("noun", "verb", "adj", "adv"):
        print(f"  {k:5}: {stats['counts'][k]:,}")
    print("\nDone!")


if __name__ == "__main__":
    main()
