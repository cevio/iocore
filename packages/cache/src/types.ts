export type ExtractParams<Template extends string> =
  Template extends `${string}{${infer Key}:${infer Type}}${infer Rest}`
  ? {
    [K in Key]: Type extends "string"
    ? string
    : Type extends "number"
    ? number
    : Type extends "boolean"
    ? boolean
    : never
  } & ExtractParams<Rest>
  : {};