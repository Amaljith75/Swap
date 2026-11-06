# Builds the Swap Build Map page (https://claude.ai/artifact/ENcfugtBFgLP8ovGSwTBJN)
# from git history + GitHub releases and CI runs.
#
#   python3 tools/build-map/gen.py OUT.html
#
# Hand-written parts live in this folder:
#   notes.json   short summaries for commits with no message body, changes made
#                outside git (e.g. Supabase deploys), live/next version, branches
#   steps.json   the checklist of next steps shown at the end of the flow
#   template.html the page itself
# Needs `git` and an authenticated `gh` CLI with read access to Amaljith75/Swap.
import json, os, subprocess, sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
GH = 'Amaljith75/swap'

def sh(*a): return subprocess.run(a, cwd=REPO, capture_output=True, text=True, check=True).stdout
def gh(path): return json.loads(subprocess.run(['gh', 'api', path], capture_output=True, text=True, check=True).stdout)

def area(path):
    if path.startswith(('app/', 'src/', 'assets/')): return 'app'
    if path.startswith('supabase/'): return 'backend'
    if path.startswith(('docs/', 'README', 'CLAUDE.md', 'tools/')): return 'docs'
    return 'build'

notes = json.load(open(os.path.join(HERE, 'notes.json')))
steps = json.load(open(os.path.join(HERE, 'steps.json')))
proj = notes['project']

subprocess.run(['git', 'fetch', '-q', 'origin'], cwd=REPO)
main_shas = set(sh('git', 'rev-list', 'origin/main').split())
releases = {r['tag_name']: r for r in gh(f'repos/{GH}/releases?per_page=100')}
tags = {t['object']['sha']: t['ref'].split('/')[-1] for t in gh(f'repos/{GH}/git/matching-refs/tags')}
ci = {}
for r in gh(f'repos/{GH}/actions/runs?per_page=100')['workflow_runs']:
    if r['status'] != 'completed': continue
    ci.setdefault(r['head_sha'], []).append({'name': r['name'], 'ok': r['conclusion'] == 'success',
                                             'run': r['run_number'], 'url': r['html_url']})

events = []
refs = ['origin/main'] + ['origin/' + b['name'] for b in proj['branches'] if b['name'] != 'main']
log = sh('git', 'log', *refs, '--reverse', '--topo-order', '--format=%H%x1f%P%x1f%aI%x1f%s%x1f%b%x1e')
for rec in log.strip('\x1e\n').split('\x1e'):
    sha, parents, date, subject, body = [x.strip('\n') for x in rec.split('\x1f')]
    short = sha[:7]
    body = '\n'.join(l for l in body.splitlines() if not l.startswith(('Co-Authored-By', 'Claude-Session')))
    groups, cur = [], None
    for line in body.splitlines():
        if not line.strip(): continue
        if line.startswith('- '):
            if cur is None: cur = {'label': '', 'items': []}; groups.append(cur)
            cur['items'].append(line[2:].strip())
        elif line.startswith('  ') and cur and cur['items']:
            cur['items'][-1] += ' ' + line.strip()
        else:
            cur = {'label': line.strip(), 'items': []}; groups.append(cur)
    groups = [g for g in groups if g['items']]
    if not groups and short in notes['commitNotes']:
        groups = [{'label': '', 'items': notes['commitNotes'][short]}]
    files, adds, dels = {}, 0, 0
    for l in sh('git', 'show', '--numstat', '--format=', sha).splitlines():
        a, d, p = l.split('\t')
        if a != '-': adds += int(a); dels += int(d)
        files.setdefault(area(p), []).append(p)
    tag = tags.get(sha)
    rel = releases.get(tag) if tag else None
    events.append({
        'kind': 'commit', 'sha': sha, 'short': short, 'parents': [p[:7] for p in parents.split()],
        'branch': 'main' if sha in main_shas else proj['branches'][1]['name'],
        'date': date, 'title': subject, 'groups': groups,
        'add': adds, 'del': dels, 'files': {k: len(v) for k, v in files.items()},
        'fileList': {k: v[:12] for k, v in files.items()},
        'release': {'tag': tag, 'name': rel['name'], 'url': rel['html_url']} if rel else None,
        'ci': ci.get(sha, []),
        'url': f'https://github.com/Amaljith75/Swap/commit/{sha}',
    })

for x in notes['liveChanges']:
    ev = {'kind': 'deploy', 'short': 'live-' + x['after'], 'branch': x['branch'], 'date': x['date'],
          'title': x['title'], 'groups': [{'label': '', 'items': x['items']}]}
    idx = next((i for i, e in enumerate(events) if e['short'] == x['after']), len(events) - 1)
    events.insert(idx + 1, ev)

doc = {
    'name': 'Swap', 'repo': 'Amaljith75/Swap', 'url': 'https://github.com/Amaljith75/Swap',
    'tagline': 'Swap items with people near you. No money involved.',
    'live': proj['live'], 'next': proj['next'], 'branches': proj['branches'], 'events': events,
    'updatedAt': datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat(timespec='seconds'),
}
enc = lambda o: json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
page = open(os.path.join(HERE, 'template.html')).read()
page = page.replace('/*DATA*/null', enc(doc)).replace('/*STEPS*/[]', enc(steps))
open(sys.argv[1], 'w').write(page)
print(f'{len(events)} events, {len(steps)} steps -> {sys.argv[1]}')
