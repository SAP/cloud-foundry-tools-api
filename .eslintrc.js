/*
 * SPDX-FileCopyrightText: 2020 AG <ag@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** @type {import("eslint").Linter.Config} */
module.exports = {
    root: true,
    plugins: ["@typescript-eslint"],
    env: {
      browser: true,
      node: true
    },
    // Based on https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin#recommended-configs
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@typescript-eslint/recommended-requiring-type-checking",
      // prettier must be last because it turns off previous rules
      "prettier"
    ],
    parserOptions: {
      sourceType: "module",
      ecmaVersion: 6,
      project: ["./tsconfig.json"],
      tsconfigRootDir: __dirname
    },
    rules: {
      "semi": "error",
      "no-extra-semi": "error",
      "no-eval": "error",
      "@typescript-eslint/prefer-readonly": "error",
      // TODO review each exclusion and fix issues if needed
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
    }
  };
  