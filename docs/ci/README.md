# CI workflows, ready to switch on

GitHub only accepts files under `.github/workflows/` from a token with the
`workflow` permission, and the automated session that wrote these did not have
it, so they live here instead. To switch them on:

```bash
mkdir -p .github/workflows
cp docs/ci/ci.yml docs/ci/security-review.yml .github/workflows/
git add .github && git commit -m "Add CI and security review" && git push
```

- `ci.yml`: build, the route, auth, UI and Tailwind checks, and an audit of
  production dependencies. The browser journeys (`npm run test:e2e`) need the
  backend and a database, so they are run by hand before shipping.
- `security-review.yml`: Anthropic's `claude-code-security-review` on every pull
  request. It needs a repository secret named `CLAUDE_API_KEY` (Settings, Secrets
  and variables, Actions). That key is yours to create and paste; it is never put
  in the repository.
