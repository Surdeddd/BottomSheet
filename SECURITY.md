# Security policy

## Supported versions

The package is `0.x`. Only the latest minor line receives fixes — there are no
long-term support branches, and a security fix ships as a new minor or patch
release rather than a backport.

| Version | Supported |
| --- | --- |
| 0.14.x | yes |
| < 0.14 | no — upgrade first |

## Reporting a vulnerability

Report privately through GitHub's advisory flow:
[Report a vulnerability](https://github.com/Surdeddd/BottomSheet/security/advisories/new).
Please do not open a public issue for anything exploitable.

Include what the vulnerability lets an attacker do, the smallest reproduction
you have, affected versions, and which entry point is involved (main bundle, an
adapter, `/overlay`, `/webgl`, the custom element). A minimal repository or a
failing test is worth more than a description.

Expect an acknowledgement within a few days. There is no bounty programme.

## Threat model

This is a client-side UI library. It renders markup the host application gives
it, runs in the page's origin, and has no network layer, no storage beyond an
optional `localStorage` key for snap persistence, and no server component.

**In scope:**

- XSS reachable through the library's own API — an option, attribute, or
  adapter prop whose value ends up interpreted as markup or script rather than
  text.
- The custom element's attribute parsing (`snap-points`, `mode`, `allowed`,
  `drag-from`, …), which reads untrusted strings from the DOM.
- Prototype pollution through options objects or plugin registration.
- Focus-trap or `inert` handling that lets a modal sheet be bypassed in a way
  that defeats the host's own security UI.
- A dependency of the published package with a known advisory. Note that the
  runtime dependency count is zero — everything is `devDependencies` and does
  not ship.

**Out of scope:**

- Content the host application passes in. The library renders your markup as
  given; sanitising it is the application's job, exactly as with
  `innerHTML`.
- Denial of service from a host that mounts thousands of sheets, or supplies
  pathological snap-point definitions.
- Vulnerabilities in the demo site or fixtures under `demo/`, which are not
  published to npm.
- Anything requiring the attacker to already execute script in the page — at
  that point the sheet is not the weakest link.

## What ships

The published tarball contains `dist/` (without source maps), `README.md` and
`LICENSE`. No install scripts, no postinstall hooks, no binaries. Verify with
`npm pack --dry-run`.
