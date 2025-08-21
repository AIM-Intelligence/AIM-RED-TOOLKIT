/**
 * Validate project ID format
 * @param projectId - The project ID to validate
 * @returns boolean indicating if the project ID is valid
 */
export function isValidProjectId(projectId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(projectId);
}

/**
 * Check if error is a 404 or network error
 * @param error - The error to check
 * @returns boolean indicating if it's a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("URI")) {
    return true;
  }
  if (error instanceof Error && error.message.includes("404")) {
    return true;
  }
  return false;
}