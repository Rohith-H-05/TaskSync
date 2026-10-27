declare module 'graphql-depth-limit' {
  import { ValidationRule } from 'graphql';
  export default function depthLimit(
    maxDepth: number,
    options?: { ignore?: (string | RegExp)[] },
    callback?: (depths: Record<string, number>) => void
  ): ValidationRule;
}

