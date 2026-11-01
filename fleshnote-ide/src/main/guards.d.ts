export function isSafeExternalUrl(url: string): boolean
export function assetPathFromUrl(requestUrl: string): string | null
export function dialogStartPath(
  defaultPath: string | undefined,
  lastFolder: string | undefined,
  path: { isAbsolute(p: string): boolean; join(...parts: string[]): string }
): string | undefined
