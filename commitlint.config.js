module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /^chore: bump \[.+]\(.+\) from .+ to .+\.$/m.test(message)],
}
