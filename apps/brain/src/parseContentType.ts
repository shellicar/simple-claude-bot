export interface ParsedContentType {
  readonly baseType: string | null;
  readonly params: string | null;
}

export function parseContentType(contentType: string | null): ParsedContentType {
  if (contentType == null) {
    return {
      baseType: null,
      params: null,
    };
  }
  const semicolonIndex = contentType.indexOf(';');
  if (semicolonIndex === -1) {
    return {
      baseType: contentType.trim(),
      params: null,
    };
  }
  return {
    baseType: contentType.slice(0, semicolonIndex).trim(),
    params: contentType.slice(semicolonIndex + 1).trim(),
  };
}
