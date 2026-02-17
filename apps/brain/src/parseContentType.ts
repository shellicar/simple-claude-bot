export interface ParsedContentType {
  readonly baseType: string;
  readonly params: string | undefined;
}

export function parseContentType(contentType: string): ParsedContentType {
  const semicolonIndex = contentType.indexOf(';');
  if (semicolonIndex === -1) {
    return { baseType: contentType.trim(), params: undefined };
  }
  return {
    baseType: contentType.slice(0, semicolonIndex).trim(),
    params: contentType.slice(semicolonIndex + 1).trim(),
  };
}
