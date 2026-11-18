/** Parse a comma- or newline-separated list of logins, dropping blanks and duplicates. */
export function parseLogins(input: string): string[] {
  return [...new Set(input.split(/[,\n]/).map((login) => login.trim()).filter(Boolean))];
}
