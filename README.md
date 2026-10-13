![GitHub package.json version](https://img.shields.io/github/package-json/v/SAP/cloud-foundry-tools-api)
[![CircleCI](https://circleci.com/gh/SAP/cloud-foundry-tools-api.svg?style=svg)](https://circleci.com/gh/SAP/cloud-foundry-tools-api)
[![Coverage Status](https://coveralls.io/repos/github/SAP/cloud-foundry-tools-api/badge.svg?branch=master)](https://coveralls.io/github/SAP/cloud-foundry-tools-api?branch=master)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![REUSE status](https://api.reuse.software/badge/github.com/SAP/cloud-foundry-tools-api)](https://api.reuse.software/info/github.com/SAP/cloud-foundry-tools-api)

# Overview

This package provides a set of APIs to help you develop applications in Cloud Foundry. You can use these APIs to manage apps, service instances, orgs, spaces, and users in your environment. Mostly, this is a wrapper of the CF command line client, which runs a particular command and parses the output to the suitable JSON file. Many operations reject with an Error on failure; cfLogin returns "OK" on success or failure output otherwise.

## API Reference Guide

[API guide](https://sap.github.io/cloud-foundry-tools-api)

## Prerequisite

Make sure you have installed the CF CLI [v8](https://github.com/cloudfoundry/cli#downloads) tool in your environment.

## Examples of usage

Example 1

```typescript
try {
  const result = await cfLogin({ endpoint: "https://api.cf.....com", user: "user", password: "password" });
  if (result === "OK") {
    // successful
  }
} catch (e) {
  // display or/and log error
}
```

Example 2

```typescript
try {
  const spaces = await cfGetAvailableSpaces("organization-guid");
  for (const space of spaces) {
    console.log("Space label is " + space.label + " guid is " + space.guid);
  }
} catch (e) {
  // display or/and log error
}
```

## Contributing

Contributing information can be found in the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Development and configuration

`src/index.ts` exports CF wrappers, types, the CLI layer and shared helpers.
`src/cf-local.ts` implements CF operations using `src/cli.ts` to spawn `cf` and parse
output; `src/cfServicesUtil.ts` supplies the high-level service helpers.
Use Node 24 to match CI. Run `npm install`, then `npm run compile` for TypeScript
output in `out/`, or `npm run build` for formatting, linting, tests and TypeDoc.
`npm test` compiles first, then runs Mocha/Chai/Sinon tests with Nyc coverage.
`npm run docs` regenerates `docs/`. CF CLI v8 must be on `PATH`; authenticate and
target the intended account before operations requiring CF state. Binding operations
can read/write environment files. The tag-triggered `.github/workflows/release.yml`
tests and packs the library, then uploads the tarball to GitHub Releases; it does
not publish to npm.
