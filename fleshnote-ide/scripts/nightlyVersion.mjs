// A nightly's version: the next release from package.json, with a build stamp.
//
// 2.0.0-nightly.202611011430 sorts after every 2.0.0-beta.N and before 2.0.0, so people on
// nightlies move to the stable release when it's out. That only works while package.json
// names an unreleased version, so a stable version there is refused: after releasing 2.0.0,
// set package.json to 2.1.0-dev (or whatever is next) before building another nightly.

const pad = (n) => String(n).padStart(2, '0')

export function nightlyVersion(packageVersion, date = new Date()) {
  const match = /^(\d+\.\d+\.\d+)-.+$/.exec(packageVersion)
  if (!match) {
    throw new Error(
      `package.json says ${packageVersion}, a released version. A nightly built from it would ` +
        'sort below that release and never be offered. Set package.json to the next version ' +
        'with a pre-release tag first, for example 2.1.0-dev.'
    )
  }
  const stamp =
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
  return `${match[1]}-nightly.${stamp}`
}
