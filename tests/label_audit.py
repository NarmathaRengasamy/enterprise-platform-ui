# -*- coding: utf-8 -*-
"""
Finds text a user reads that will NOT change when a section is renamed.

Run:  python tests/label_audit.py

Renaming "Conversations" to "Interactions" has to reach every place the word
is shown. It cannot, if a screen writes the word itself. This walks the source
and reports the ones that still do.

It looks only at strings a person actually reads:

  - JSX text between tags, on one line or spread over three
  - `title=`, `placeholder=`, `aria-label=`, `label:` values
  - toast bodies and validation messages

and deliberately ignores everything that must NOT be renamed:

  - identifiers, imports, types      ConversationsPage, conversationService
  - routes and module keys           '/conversations', 'conversations'
  - comments

A finding is not automatically a bug — "Conversation history" inside the
Conversations page may be intentional prose. It is a list to review, and the
count should only ever go down.
"""
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'src')

# The renameable sections and the words that mean them. The SINGULAR defaults
# matter as much as the plurals: "Create Article" is every bit as hardcoded as
# "Knowledge Base", and leaving those out let a whole modal slip through.
WORDS = {
    'dashboard': ['Dashboard'],
    'conversations': ['Conversations', 'Conversation'],
    'products': ['Products', 'Product'],
    'allProducts': ['All Products'],
    'categories': ['Categories', 'Category'],
    'schedule': ['Schedule', 'Appointments', 'Appointment'],
    'teams': ['Teams', 'Team Members', 'Team Member', 'Members', 'Member'],
    'knowledgeBase': ['Knowledge Base', 'Articles', 'Article'],
    'developer': ['Developer', 'Endpoints', 'Endpoint'],
}

# Files whose job is to DEFINE the defaults, so the words belong there.
EXEMPT_FILES = {
    os.path.join('services', 'settings.service.ts'),
    os.path.join('context', 'SiteSettingsContext.tsx'),
    os.path.join('pages', 'SettingsPage.tsx'),
}

# Nothing is exempt for being shown before sign-in any more.
#
# It used to be: the labels came from an authenticated endpoint, so the login
# and signup pages could not read them. That reasoning was wrong — a
# workspace's name and logo are not secret, they are exactly what belongs on a
# sign-in page. `GET /public/settings` now publishes branding and section
# names to anyone, while the legal name, the business category and the email
# of whoever last saved stay behind the authenticated read.
EXEMPT_PRE_AUTH: set = set()

# Sample data, not interface text. Renaming a section should not rewrite the
# body of a demo conversation.
EXEMPT_FIXTURES = {
    os.path.join('data', 'mockData.ts'),
}

# Generic stand-ins for a renameable thing.
#
# These are not the shipped label, so the word-list above never saw them — but
# they name the same entity, and they are worse than the default wording: the
# create form asked for a "Title / Service Name" while the sidebar said
# "Products", and after a rename it contradicted that too.
STAND_INS = {
    'products': ['Offering', 'Offerings', 'Service Name'],
}

# Text that names something other than the section.
EXEMPT_PHRASES = [
    'Product Catalogues 2026',        # an example in a placeholder, not a label
    'Healthcare &amp; Appointments',  # a business vertical in a category list
    'Developer Hub',                  # the product name of that area
    'Developer API',                  # already wired to the label
]

# "Product Name", "Product Code" and "Product Type" used to be exempt here as
# "fields on a product". That was wrong: a column headed PRODUCT NAME is
# naming the renameable thing as plainly as the menu item does, and the
# exemption is what let it keep saying "Product Name" on a page whose every
# other word read "My Car".

# Compiled once, so a bad escape shows up here rather than silently making
# every match fail. The word boundary must survive into the pattern: a
# backspace character looks almost identical in a diff and never matches
# anything, which is exactly how this audit spent a while reporting a clean
# codebase. The asserts below are the guard against that happening again.
for _key, _extra in STAND_INS.items():
    WORDS[_key] = WORDS[_key] + _extra

WORD_RE = {
    word: re.compile(r'\b' + re.escape(word) + r'\b', re.I)
    for words in WORDS.values()
    for word in words
}

assert WORD_RE['Products'].search('Search products, messages'), 'word matching is broken'
assert not WORD_RE['Product'].search('Productivity'), 'word matching is too loose'

# A line holding nothing but prose. Only counts as JSX text when the line
# before opens a tag and the line after closes one — see `main`.
BARE_TEXT = re.compile(r"""^\s*([A-Za-z][^<>{}=;:"'`]{2,80})\s*$""")

# `title="No {label.lower('products')} found"` renders the braces as text.
# Inside a quoted attribute JSX does not evaluate an expression, so this reads
# literally on screen — a silent, ugly failure that type-checking cannot catch
# because the value is still a valid string.
BRACES_IN_ATTR = re.compile(r'=\s*"[^"]*\{\s*label\.')

VISIBLE_PATTERNS = [
    # Messages the user reads but that live in plain strings rather than JSX:
    # toast bodies, validation errors, confirm prompts.
    (re.compile(r"""text:\s*['"`]([^'"`]{1,90})"""), 'toast'),
    (re.compile(r"""set\w*Error\(\s*['"`]([^'"`]{1,90})"""), 'error'),
    (re.compile(r"""(?:throw new Error|Error)\(\s*['"`]([^'"`]{1,90})"""), 'error'),
    # >Some text<   (a JSX text node with its tags on the same line)
    (re.compile(r'>\s*([^<>{}\n][^<>{}\n]{0,80}?)\s*<'), 'text'),
    # title="..."  placeholder="..."  aria-label="..."
    # Any attribute carrying words a user reads. Not just title/placeholder:
    # `itemLabel="products"` on the pagination footer printed "of 22 products"
    # on a screen where everything else said "My Cars", and the narrower
    # pattern never looked at it.
    (re.compile(
        r'(?:title|placeholder|aria-label|subtitle|heading|description|emptyText|\w*[Ll]abel)'
        r'\s*=\s*"([^"]{1,80})"'), 'attr'),
    # label: 'Some text'
    (re.compile(r"label\s*:\s*'([^']{1,80})'"), 'label'),
    # A quoted string that reads like a button or a dialog title, wherever it
    # sits — typically a JSX ternary, which none of the patterns above look
    # inside: `{saving ? 'Saving...' : 'Save Category'}`. Anchored on the verb
    # rather than matching every quoted string, because the broad version
    # reported sixty lines of service-layer errors and "Microsoft Teams
    # Meeting", and a report nobody acts on is no report.
    (re.compile(
        r"""['"]((?:Save|Update|Create|Add|Delete|Edit|Publish|Remove|New|Manage|View)"""
        r"""\s+[^'"]{2,40})['"]"""), 'action'),
]


def walk(root):
    for base, _dirs, files in os.walk(root):
        for name in files:
            if name.endswith(('.tsx', '.ts')):
                yield os.path.join(base, name)


def is_exempt(rel):
    return any(rel.endswith(e) for e in EXEMPT_FILES | EXEMPT_PRE_AUTH | EXEMPT_FIXTURES)


def match_words(text):
    """The first section this text names, or None."""
    if any(p in text for p in EXEMPT_PHRASES):
        return None
    for key, words in WORDS.items():
        for word in words:
            if WORD_RE[word].search(text):
                return key, word
    return None


def main():
    findings = []
    broken = []

    for path in walk(SRC):
        rel = os.path.relpath(path, SRC)
        if is_exempt(rel):
            continue

        all_lines = open(path, encoding='utf-8').read().splitlines()
        in_comment = False

        for number, line in enumerate(all_lines, 1):
            stripped = line.strip()

            # Comments explain the code; they are not read by a user, and one
            # that happens to mention a section name is not a finding.
            if in_comment:
                if '*/' in stripped:
                    in_comment = False
                continue
            if stripped.startswith('/*') and '*/' not in stripped:
                in_comment = True
                continue
            if stripped.startswith(('import ', 'export type', '//', '*', '/*')) or '*/' in stripped:
                continue
            # A label call stranded inside a quoted attribute. Caught before
            # the "already reading the label" skip below, which would
            # otherwise wave it straight through.
            if BRACES_IN_ATTR.search(line):
                broken.append((rel, number, stripped[:70]))

            # Already reading the label.
            if 'label.plural(' in line or 'label.singular(' in line or 'label.lower' in line:
                continue
            # An icon name is not prose: `<span ...>schedule</span>` renders a
            # clock, and renaming the Schedule section must not touch it.
            if 'material-symbols-outlined' in line:
                continue

            texts = []

            # A bare line of prose is only JSX text when it sits between an
            # opening and a closing tag. Without that check the pattern also
            # swallowed code (`conversations,`) and comment continuations,
            # which is noise that makes the whole report easy to ignore.
            bare = BARE_TEXT.match(line)
            if bare:
                before = next((l.strip() for l in reversed(all_lines[:number - 1]) if l.strip()), '')
                after = next((l.strip() for l in all_lines[number:] if l.strip()), '')
                if before.endswith('>') and after.startswith('</'):
                    texts.append(bare.group(1))

            for pattern, _kind in VISIBLE_PATTERNS:
                texts.extend(pattern.findall(line))

            for text in texts:
                hit = match_words(text)
                if hit:
                    findings.append((rel, number, hit[0], hit[1], text.strip()[:70]))

    by_file = {}
    for rel, number, key, word, text in findings:
        by_file.setdefault(rel, []).append((number, key, word, text))

    if broken:
        print('=' * 72)
        print('BROKEN LABEL CALLS')
        print('=' * 72)
        print('`{label...}` inside a quoted attribute renders as literal text.')
        print('Use a template literal instead:  title={`No ${label.lower(...)} found`}')
        print()
        for rel, number, text in broken:
            print('  %-38s %-5s %s' % (rel, number, text))
        print()

    print('=' * 72)
    print('HARDCODED SECTION NAMES')
    print('=' * 72)
    print('Text a user reads that a rename will not reach.')
    print()

    if not findings:
        print('  none — every visible section name comes from the settings')
        return 1 if broken else 0

    total = 0
    for rel in sorted(by_file):
        print(rel)
        seen = set()
        for number, key, word, text in by_file[rel]:
            if (number, text) in seen:
                continue
            seen.add((number, text))
            total += 1
            print('  %-5s %-14s %s' % (number, key, text))
        print()

    print('-' * 72)
    print('%d occurrence(s) across %d file(s)' % (total, len(by_file)))
    print()
    print('Each should either use `label.plural(key)` / `label.singular(key)`,')
    print('or be added to EXEMPT_PHRASES if the word is not naming that section.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
