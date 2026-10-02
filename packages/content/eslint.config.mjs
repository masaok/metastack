import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["coverage/**", "node_modules/**", "generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
