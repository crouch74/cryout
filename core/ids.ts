export type CoreId = string;

export function asCoreId(value: string | number): CoreId {
  return String(value);
}

export function createScopedId(scope: string, value: string | number) {
  return `${scope}:${String(value)}`;
}
