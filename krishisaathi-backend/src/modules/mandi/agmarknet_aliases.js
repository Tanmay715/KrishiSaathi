/**
 * AGMARKNET / data.gov.in sometimes uses alternate English spellings for states.
 * Always try the canonical name first, then these aliases.
 */
const STATE_QUERY_ALIASES = {
  Kerala: ['Keralam'],
  Odisha: ['Orissa'],
  'Andaman and Nicobar': ['Andaman & Nicobar'],
  Puducherry: ['Pondicherry'],
  Uttarakhand: ['Uttaranchal'],
};

/**
 * @param {string|null} state_name
 * @returns {string[]}
 */
function getAgmarknetStateQueries(state_name) {
  const primary = String(state_name || '').trim();
  if (!primary) {
    return [];
  }

  const aliases = STATE_QUERY_ALIASES[primary] || [];
  return [...new Set([primary, ...aliases])];
}

module.exports = {
  STATE_QUERY_ALIASES,
  getAgmarknetStateQueries,
};
