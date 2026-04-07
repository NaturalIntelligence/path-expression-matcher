import { Expression, ExpressionSet, Matcher } from '../src/index.js';

// ---------------------------------------------------------------------------
// Test utilities (same style as existing test suite)
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`❌ ${message}`);
  console.log(`✓ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
  console.log(`✓ ${message}`);
}

function assertThrows(fn, expectedMsg, message) {
  try {
    fn();
    throw new Error(`❌ ${message} — expected an error but none was thrown`);
  } catch (e) {
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      throw new Error(`❌ ${message} — wrong error: ${e.message}`);
    }
    console.log(`✓ ${message}`);
  }
}

// Helper: build a matcher at a given path
function matcherAt(...tags) {
  const m = new Matcher();
  for (const t of tags) m.push(t);
  return m;
}

// Helper: build a matcher with attrs on the last tag
function matcherAtWithAttrs(attrs, ...tags) {
  const m = new Matcher();
  for (let i = 0; i < tags.length - 1; i++) m.push(tags[i]);
  m.push(tags[tags.length - 1], attrs);
  return m;
}

console.log('\n🧪 ExpressionSet Test Suite\n');

// ===========================================================================
// 1. Construction & size
// ===========================================================================
console.log('\n── 1. Construction & size ──\n');

{
  const set = new ExpressionSet();
  assertEqual(set.size, 0, 'Empty set has size 0');
  assert(!set.isSealed, 'New set is not sealed');
}

// ===========================================================================
// 2. add() / has() / size
// ===========================================================================
console.log('\n── 2. add() / has() / size ──\n');

{
  const set = new ExpressionSet();
  const expr = new Expression('root.users.user');

  set.add(expr);
  assertEqual(set.size, 1, 'Size is 1 after one add');
  assert(set.has(expr), 'has() returns true for added expression');
  assert(!set.has(new Expression('root.other')), 'has() returns false for unknown expression');
}

{
  // Deduplication
  const set = new ExpressionSet();
  const e1 = new Expression('root.users.user');
  const e2 = new Expression('root.users.user'); // same pattern, different object

  set.add(e1).add(e2);
  assertEqual(set.size, 1, 'Duplicate patterns are silently ignored');
}

{
  // Chaining
  const set = new ExpressionSet();
  const result = set.add(new Expression('a.b'));
  assert(result === set, 'add() returns this for chaining');
}

// ===========================================================================
// 3. addAll()
// ===========================================================================
console.log('\n── 3. addAll() ──\n');

{
  const set = new ExpressionSet();
  set.addAll([
    new Expression('root.a'),
    new Expression('root.b'),
    new Expression('root.c'),
  ]);
  assertEqual(set.size, 3, 'addAll() adds all expressions');
  const result = new ExpressionSet().addAll([new Expression('x.y')]);
  assert(result instanceof ExpressionSet, 'addAll() returns this for chaining');
}

// ===========================================================================
// 4. seal()
// ===========================================================================
console.log('\n── 4. seal() ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.a'));
  set.seal();

  assert(set.isSealed, 'isSealed is true after seal()');
  assertThrows(
    () => set.add(new Expression('root.b')),
    'sealed',
    'add() throws after seal()'
  );
  assertThrows(
    () => set.addAll([new Expression('root.c')]),
    'sealed',
    'addAll() throws after seal()'
  );
  assertEqual(set.size, 1, 'Size unchanged after failed add on sealed set');
}

// ===========================================================================
// 5. matchesAny() — exact path expressions
// ===========================================================================
console.log('\n── 5. matchesAny() — exact paths ──\n');

{
  const set = new ExpressionSet();
  set.addAll([
    new Expression('root.users.user'),
    new Expression('root.config.setting'),
    new Expression('root.orders.order'),
  ]);

  assert(set.matchesAny(matcherAt('root', 'users', 'user')), 'Matches root.users.user');
  assert(set.matchesAny(matcherAt('root', 'config', 'setting')), 'Matches root.config.setting');
  assert(set.matchesAny(matcherAt('root', 'orders', 'order')), 'Matches root.orders.order');
  assert(!set.matchesAny(matcherAt('root', 'users')), 'Does not match partial path');
  assert(!set.matchesAny(matcherAt('root', 'users', 'admin')), 'Does not match different tag');
  assert(!set.matchesAny(matcherAt('other', 'users', 'user')), 'Does not match different root');
}

// ===========================================================================
// 6. matchesAny() — wildcard tag (*)
// ===========================================================================
console.log('\n── 6. matchesAny() — wildcard tag (*) ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.users.*'));

  assert(set.matchesAny(matcherAt('root', 'users', 'user')), 'Wildcard matches user');
  assert(set.matchesAny(matcherAt('root', 'users', 'admin')), 'Wildcard matches admin');
  assert(!set.matchesAny(matcherAt('root', 'users')), 'Wildcard does not match shorter path');
  assert(!set.matchesAny(matcherAt('root', 'other', 'user')), 'Wildcard does not match different parent');
}

// ===========================================================================
// 7. matchesAny() — deep wildcard (..)
// ===========================================================================
console.log('\n── 7. matchesAny() — deep wildcard (..) ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('..user'));

  // ..user requires at least one ancestor (the '..' consumes ≥1 levels before the tag)
  assert(set.matchesAny(matcherAt('root', 'user')), 'Deep wildcard matches at depth 2');
  assert(set.matchesAny(matcherAt('root', 'users', 'user')), 'Deep wildcard matches at depth 3');
  assert(set.matchesAny(matcherAt('a', 'b', 'c', 'user')), 'Deep wildcard matches at depth 4');
  assert(!set.matchesAny(matcherAt('user')), 'Deep wildcard does not match at depth 1 (no ancestor)');
  assert(!set.matchesAny(matcherAt('root', 'users', 'admin')), 'Deep wildcard does not match different tag');
}

// ===========================================================================
// 8. matchesAny() — attribute conditions
// ===========================================================================
console.log('\n── 8. matchesAny() — attribute conditions ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.users.user[type=admin]'));

  assert(
    set.matchesAny(matcherAtWithAttrs({ type: 'admin' }, 'root', 'users', 'user')),
    'Matches when attribute value matches'
  );
  assert(
    !set.matchesAny(matcherAtWithAttrs({ type: 'guest' }, 'root', 'users', 'user')),
    'Does not match when attribute value differs'
  );
  assert(
    !set.matchesAny(matcherAt('root', 'users', 'user')),
    'Does not match when attribute is absent'
  );
}

// ===========================================================================
// 9. matchesAny() — position selectors
// ===========================================================================
console.log('\n── 9. matchesAny() — position selectors ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.items.item:first'));

  const m = new Matcher();
  m.push('root');
  m.push('items');
  m.push('item'); // first item, counter=0
  assert(set.matchesAny(m), 'Matches :first item');
  m.pop();

  m.push('item'); // second item, counter=1
  assert(!set.matchesAny(m), 'Does not match second item with :first selector');
}

// ===========================================================================
// 10. matchesAny() — mixed expressions (realistic config scenario)
// ===========================================================================
console.log('\n── 10. matchesAny() — mixed realistic config ──\n');

{
  const stopNodes = new ExpressionSet();
  stopNodes.addAll([
    new Expression('root.users.user'),        // exact
    new Expression('root.config.*'),           // depth + wildcard tag
    new Expression('..script'),                // deep wildcard
    new Expression('root.data.item[id=42]'),   // attribute condition
  ]);

  assert(stopNodes.matchesAny(matcherAt('root', 'users', 'user')), 'Exact path matches');
  assert(stopNodes.matchesAny(matcherAt('root', 'config', 'setting')), 'Wildcard tag matches');
  assert(stopNodes.matchesAny(matcherAt('root', 'config', 'feature')), 'Wildcard tag matches any child');
  assert(stopNodes.matchesAny(matcherAt('root', 'head', 'script')), 'Deep wildcard matches');
  assert(!stopNodes.matchesAny(matcherAt('script')), 'Deep wildcard does not match at depth 1 (no ancestor)');
  assert(
    stopNodes.matchesAny(matcherAtWithAttrs({ id: '42' }, 'root', 'data', 'item')),
    'Attribute condition matches'
  );
  assert(
    !stopNodes.matchesAny(matcherAtWithAttrs({ id: '99' }, 'root', 'data', 'item')),
    'Attribute condition does not match wrong value'
  );
  assert(!stopNodes.matchesAny(matcherAt('root', 'users', 'admin')), 'Non-matching tag rejected');
}

// ===========================================================================
// 11. matchesAny() — empty set
// ===========================================================================
console.log('\n── 11. matchesAny() — empty set ──\n');

{
  const set = new ExpressionSet();
  assert(!set.matchesAny(matcherAt('root', 'users', 'user')), 'Empty set never matches');
}

// ===========================================================================
// 12. matchesAny() — works with matcher.readOnly()
// ===========================================================================
console.log('\n── 12. matchesAny() — readOnly matcher ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.users.user'));

  const m = new Matcher();
  m.push('root');
  m.push('users');
  m.push('user');

  assert(set.matchesAny(m.readOnly()), 'matchesAny works with readOnly matcher');
}

// ===========================================================================
// 13. Namespace expressions
// ===========================================================================
console.log('\n── 13. Namespace expressions ──\n');

{
  const set = new ExpressionSet();
  set.add(new Expression('root.ns::user'));

  const m = new Matcher();
  m.push('root');
  m.push('user', null, 'ns');

  assert(set.matchesAny(m), 'Matches namespaced tag');

  const m2 = new Matcher();
  m2.push('root');
  m2.push('user', null, 'other');

  assert(!set.matchesAny(m2), 'Does not match different namespace');
}

// ===========================================================================
// 14. Large expression set — correctness across 30 expressions
// ===========================================================================
console.log('\n── 14. Large expression set (30 expressions) ──\n');

{
  const set = new ExpressionSet();
  const tags = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa'];

  // 10 exact two-level paths
  for (const t of tags) set.add(new Expression(`root.${t}`));

  // 10 exact three-level paths
  for (const t of tags) set.add(new Expression(`root.items.${t}`));

  // 5 deep wildcards
  for (const t of tags.slice(0, 5)) set.add(new Expression(`..${t}`));

  // 5 wildcard-tag
  for (let i = 1; i <= 5; i++) set.add(new Expression(`root.level${i}.*`));

  assertEqual(set.size, 30, 'All 30 expressions added');

  // Spot checks
  assert(set.matchesAny(matcherAt('root', 'alpha')), '30-expr: root.alpha matches');
  assert(set.matchesAny(matcherAt('root', 'items', 'gamma')), '30-expr: root.items.gamma matches');
  assert(set.matchesAny(matcherAt('a', 'b', 'c', 'beta')), '30-expr: deep wildcard ..beta matches');
  assert(set.matchesAny(matcherAt('root', 'level3', 'anything')), '30-expr: wildcard tag matches');
  assert(!set.matchesAny(matcherAt('root', 'unknown')), '30-expr: unknown tag not matched');
  assert(!set.matchesAny(matcherAt('root', 'items', 'unknown')), '30-expr: unknown deep tag not matched');
}

console.log('\n✅ All ExpressionSet tests passed\n');
