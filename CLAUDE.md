# Swap: notes for Claude

## Always update the Build Map

The owner tracks Swap's progress on the **Swap Build Map** artifact:
https://claude.ai/artifact/ENcfugtBFgLP8ovGSwTBJN

After every addition or change to Swap (a commit you push, a release, a Supabase
migration or function deploy, a step from the checklist finished), update it in the
same session, without being asked:

1. If a commit has no message body, add a short plain-language summary for it in
   `tools/build-map/notes.json` → `commitNotes` (keyed by the 7-character sha).
   Write good commit bodies ("- " bullet lines, optional group headings) and this is
   not needed.
2. Changes made outside git (Supabase migrations, Edge Function deploys, settings)
   go in `notes.json` → `liveChanges`, placed after the commit they belong to.
3. Keep `notes.json` → `project` current: the version testers have (`live`), the
   one being built (`next`), and the open branch (`branches[1]`; set `open: false`
   or remove it once merged).
4. Keep `tools/build-map/steps.json` (the "Next steps" checklist) in line with what
   is actually left to do. Ticks are stored in the artifact's database (`steps/<id>`
   documents, `{done, at}`); keep step ids stable so ticks survive.
5. Regenerate and republish to the **same** URL:
   `python3 tools/build-map/gen.py /tmp/swap-build-map.html`, then publish that file
   with the Artifact tool, passing `url` = the link above (read it first if this
   session has not published it).

## Releases

- Pushing to `main` builds an APK release and sends testers an "update available"
  notice. Work on a branch and merge only when the owner says so.
- Database tests: see README ("Developing on a computer"). Run them, plus
  `npm run typecheck`, before pushing.
- Never put the Supabase service_role key or any private key in the app or repo.
