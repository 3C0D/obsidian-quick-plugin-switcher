import * as typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import "eslint-import-resolver-typescript";
import type {
  Linter
} from "eslint";

const configs: Linter.Config[] = [
  {
    ignores: ["eslint.config.mts"]
  },
  {
    files: ["**/*.ts"],
    ignores: [
      "dist/**",
      "node_modules/**",
      "main.js"
    ],
    languageOptions: {
      parser: typescriptEslintParser,
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2023
      }
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin as any // Type assertion to bypass type checking
    },
    rules: {
      // Base rules
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",

      // Useful rules but not too strict
      "semi": "error",
      "@typescript-eslint/explicit-function-return-type": ["warn", { "allowExpressions": true }],

      // Disable overly strict rules
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off"
    }
  }
];

export default configs;
