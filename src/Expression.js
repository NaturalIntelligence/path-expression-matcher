/**
 * Expression - Parses and stores a tag pattern expression
 * 
 * Patterns are parsed once and stored in an optimized structure for fast matching.
 * 
 * @example
 * const expr = new Expression("root.users.user");
 * const expr2 = new Expression("..user[id]:first");
 * const expr3 = new Expression("root/users/user", { separator: '/' });
 */
export default class Expression {
  /**
   * Create a new Expression
   * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
   * @param {Object} options - Configuration options
   * @param {string} options.separator - Path separator (default: '.')
   */
  constructor(pattern, options = {}) {
    this.pattern = pattern;
    this.separator = options.separator || '.';
    this.segments = this._parse(pattern);

    // Cache expensive checks for performance (O(1) instead of O(n))
    this._hasDeepWildcard = this.segments.some(seg => seg.type === 'deep-wildcard');
    this._hasAttributeCondition = this.segments.some(seg => seg.attrName !== undefined);
    this._hasPositionSelector = this.segments.some(seg => seg.position !== undefined);
  }

  /**
   * Parse pattern string into segments
   * @private
   * @param {string} pattern - Pattern to parse
   * @returns {Array} Array of segment objects
   */
  _parse(pattern) {
    const segments = [];

    // Split by separator but handle ".." specially
    let i = 0;
    let currentPart = '';

    while (i < pattern.length) {
      if (pattern[i] === this.separator) {
        // Check if next char is also separator (deep wildcard)
        if (i + 1 < pattern.length && pattern[i + 1] === this.separator) {
          // Flush current part if any
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
            currentPart = '';
          }
          // Add deep wildcard
          segments.push({ type: 'deep-wildcard' });
          i += 2; // Skip both separators
        } else {
          // Regular separator
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
          }
          currentPart = '';
          i++;
        }
      } else {
        currentPart += pattern[i];
        i++;
      }
    }

    // Flush remaining part
    if (currentPart.trim()) {
      segments.push(this._parseSegment(currentPart.trim()));
    }

    return segments;
  }

  /**
   * Parse a single segment
   * @private
   * @param {string} part - Segment string (e.g., "user", "user[id]", "user:first")
   * @returns {Object} Segment object
   */
  _parseSegment(part) {
    const segment = { type: 'tag' };

    // Match pattern: tagname[attr] or tagname[attr=value] or tagname:position
    // Examples: user, user[id], user[type=admin], user:first, user[id]:first, user:nth(2)
    const match = part.match(/^([^[\]:]+)(?:\[([^\]]+)\])?(?::(\w+(?:\(\d+\))?))?$/);

    if (!match) {
      throw new Error(`Invalid segment pattern: ${part}`);
    }

    segment.tag = match[1].trim();

    // Parse attribute condition [attr] or [attr=value]
    if (match[2]) {
      const attrExpr = match[2];

      if (attrExpr.includes('=')) {
        const eqIndex = attrExpr.indexOf('=');
        const attrName = attrExpr.substring(0, eqIndex).trim();
        const attrValue = attrExpr.substring(eqIndex + 1).trim();

        segment.attrName = attrName;
        segment.attrValue = attrValue;
      } else {
        segment.attrName = attrExpr.trim();
      }
    }

    // Parse position selector :first, :nth(n), :odd, :even
    if (match[3]) {
      const posExpr = match[3];

      // Check for :nth(n) pattern
      const nthMatch = posExpr.match(/^nth\((\d+)\)$/);
      if (nthMatch) {
        segment.position = 'nth';
        segment.positionValue = parseInt(nthMatch[1], 10);
      } else if (['first', 'odd', 'even'].includes(posExpr)) {
        segment.position = posExpr;
      } else {
        throw new Error(`Invalid position selector: :${posExpr}`);
      }
    }

    return segment;
  }

  /**
   * Get the number of segments
   * @returns {number}
   */
  get length() {
    return this.segments.length;
  }

  /**
   * Check if expression contains deep wildcard
   * @returns {boolean}
   */
  hasDeepWildcard() {
    return this._hasDeepWildcard;
  }

  /**
   * Check if expression has attribute conditions
   * @returns {boolean}
   */
  hasAttributeCondition() {
    return this._hasAttributeCondition;
  }

  /**
   * Check if expression has position selectors
   * @returns {boolean}
   */
  hasPositionSelector() {
    return this._hasPositionSelector;
  }

  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.pattern;
  }
}