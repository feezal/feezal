# Contributing to feezal

Thank you for considering a contribution! Bug reports, feature ideas and pull requests
are all welcome.

## Bug reports and feature requests

Please use the [issue tracker](https://github.com/feezal/feezal/issues). For bugs,
include your feezal version, how you run it (Docker/npm), your browser, and steps to
reproduce.

## Development setup

See the [Development Guide](docs/development.md) for repo layout, dev setup, build
pipeline and testing. For building custom palette elements, see the
[Element Authoring Spec](docs/element-spec.md) — elements live in their own npm
packages and don't require changes to this repository at all.

## Contributor License Agreement (CLA)

Before we can merge your first pull request, you need to sign the feezal CLA — the
CLA-Assistant bot will ask you to post a short agreement comment on the pull request,
and that's it. It applies to all your future contributions too, so this is a one-time
step.

Our CLA is the [Fiduciary License Agreement (FLA-2.1)](CLA.md), the contributor
agreement recommended by the [Free Software Foundation Europe](https://fsfe.org/activities/fla/).
In short:

- **You keep your copyright** and immediately receive back a perpetual, unrestricted
  license to your own contribution — you can reuse your code anywhere, for anything.
- **You grant the maintainer the right to license the project as a whole.** This
  prevents the rights fragmentation that makes it impossible for projects with many
  contributors to ever adjust licensing (even, say, to adopt a newer license version).
- **The fiduciary promise:** the FLA contractually obliges the maintainer to always
  keep feezal available under a Free and Open Source license. If that promise is ever
  broken, the agreement terminates. Your contribution can never be taken proprietary-only.

Please read the [full agreement](CLA.md) — it's short. If you contribute as part of
your employment, your employer needs to approve it (see "How to use this FLA" in the
agreement).

## Licensing of the codebase

- The feezal **server and editor** are licensed under [AGPL-3.0-only](LICENSE).
- The **element SDK** (`@feezal/feezal-element`), all official **elements and themes**,
  and the **viewer runtime** (the code bundled into static dashboard exports — marked
  with `SPDX-License-Identifier: MIT` headers in `www/src/`) are licensed under MIT.
  Your exported dashboards and your own element packages are yours.

A CI gate (`node scripts/check-licenses.js`) verifies that every production dependency
carries an allowlisted license — if you add a dependency, it must pass.
