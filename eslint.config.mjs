import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    rules: {
      // Allow unused variables, so long as they are prefixed with `_`
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Because we need to call author-written functions, and JavaScript provides no way to check
      // function types at runtime, using the type `Function` is preferred.
      "@typescript-eslint/no-unsafe-function-type": "off",
      // This is a dumb rule. It is trivial to recognize when aliasing `this` is necessary,
      // but the rule instead chooses to raise an error no matter what.
      "@typescript-eslint/no-this-alias": "off",
    },
  },
  {
    ignores: ["bundle/", "storyformats/", "test/", "build.js", "test.js"],
  },
);
