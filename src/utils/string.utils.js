/**
 * Removes diacritics (accents) from a string to enable accent-insensitive search
 * Examples:
 * - "Athlético" -> "Athletico"
 * - "Göteborg" -> "Goteborg"
 * - "Vélez Sársfield" -> "Velez Sarsfield"
 * - "São Paulo" -> "Sao Paulo"
 * 
 * @param {string} str - The string to normalize
 * @returns {string} - The normalized string without diacritics
 */
export function removeDiacritics(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  // Use normalize with NFD (Canonical Decomposition) to separate base characters from diacritics
  // Then remove all diacritical marks using a regex
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a search string for accent-insensitive matching
 * This function:
 * 1. Removes diacritics
 * 2. Converts to lowercase
 * 3. Trims whitespace
 * 
 * @param {string} searchTerm - The search term to normalize
 * @returns {string} - The normalized search term
 */
export function normalizeSearchTerm(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return searchTerm;
  }
  
  return removeDiacritics(searchTerm.toLowerCase().trim());
}
