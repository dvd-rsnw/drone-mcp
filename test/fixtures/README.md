# Test fixtures

Example Drone API responses used by `msw` to mock HTTP calls in unit tests.

These were originally captured from a real Drone server, then sanitized: real
repo names, owner names, author logins, emails, and avatar URLs were replaced
with placeholders (`octocat/example-repo`, `alice`, `bob`, `octocat`,
`test@example.com`, etc.). The shape of the responses is unchanged so the
fixtures still exercise real Drone API quirks.

## Files

- `builds-list.json` — `GET /api/repos/{owner}/{repo}/builds?per_page=N`
- `build-225.json` — `GET /api/repos/{owner}/{repo}/builds/{n}` (a known failed build with one failed step at stage 1, step 7)
- `logs-stage1-step7.json` — `GET /api/repos/{owner}/{repo}/builds/{n}/logs/{stage}/{step}`

## Capturing fresh fixtures from your own Drone server

If you want to regenerate against a real Drone instance you have access to, set
`DRONE_SERVER` and `DRONE_TOKEN` in your shell, then:

```bash
# Pick any repo + a known failed build number to capture:
REPO=your-org/your-repo
BUILD=42

curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/$REPO/builds?per_page=10" \
  | python3 -m json.tool > test/fixtures/builds-list.json

curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/$REPO/builds/$BUILD" \
  | python3 -m json.tool > test/fixtures/build-225.json

# Use the failed step's stage/step numbers from the build detail above:
curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/$REPO/builds/$BUILD/logs/1/7" \
  | python3 -m json.tool > test/fixtures/logs-stage1-step7.json
```

After capturing, scrub any sensitive data (emails, internal URLs) before
committing. The mock handlers in `test/helpers/msw.ts` reference the
placeholder repo `octocat/example-repo` — keep that path consistent or update
the handlers accordingly.
