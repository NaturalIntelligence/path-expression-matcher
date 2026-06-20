import { Expression, Matcher } from '../src/index.js';

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

console.log('\n🧪 Running keep-attribute / ancestor-attribute test suite\n');

// ---------------------------------------------------------------------------
// Basic keep + getAnyParentAttr / hasAnyParentAttr
// ---------------------------------------------------------------------------
console.log('\n📦 Basic keep + getAnyParentAttr/hasAnyParentAttr\n');
{
  const m = new Matcher();
  m.push('Envelope', null, 'soap');
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });

  assert(m.hasAnyParentAttr('version'), 'hasAnyParentAttr finds kept attr right after push');
  assertEqual(m.getAnyParentAttr('version'), '1.1', 'getAnyParentAttr returns kept value right after push');
  assert(!m.hasAnyParentAttr('missing'), 'hasAnyParentAttr false for never-kept attr');

  m.push('GetUserRequest', { id: '42' }, 'ns');
  m.push('UserId', null, 'ns');

  assert(m.hasAnyParentAttr('version'), 'kept attr survives multiple pushes past the owning node');
  assertEqual(m.getAnyParentAttr('version'), '1.1', 'kept attr value survives multiple pushes');
  assertEqual(m.getAttrValue('version'), undefined, 'getAttrValue (current-node-only) does not see ancestor attrs');
  assert(!m.hasAnyParentAttr('id'), 'attributes not listed in keep are not retained as parent attrs');
}

// ---------------------------------------------------------------------------
// keep does not change ordinary current-node attribute behavior
// ---------------------------------------------------------------------------
console.log('\n📦 keep does not interfere with normal attribute access\n');
{
  const m = new Matcher();
  m.push('Body', { version: '1.1', extra: 'x' }, 'soap', { keep: ['version'] });

  assertEqual(m.getAttrValue('version'), '1.1', 'current-node getAttrValue still works for kept attr');
  assertEqual(m.getAttrValue('extra'), 'x', 'current-node getAttrValue still works for non-kept attr');
  assert(m.hasAttr('extra'), 'current-node hasAttr still works for non-kept attr');
}

// ---------------------------------------------------------------------------
// pop() truncates kept attrs that belong to the popped subtree
// ---------------------------------------------------------------------------
console.log('\n📦 pop() truncates kept attrs scoped to popped subtree\n');
{
  const m = new Matcher();
  m.push('Envelope', null, 'soap');
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });
  m.push('Inner', { mode: 'strict' }, null, { keep: ['mode'] });

  assert(m.hasAnyParentAttr('version'), 'version kept before pop');
  assert(m.hasAnyParentAttr('mode'), 'mode kept before pop');

  m.pop(); // pop Inner

  assert(m.hasAnyParentAttr('version'), 'version still kept after popping Inner');
  assert(!m.hasAnyParentAttr('mode'), 'mode no longer kept after popping the node that declared it');

  m.pop(); // pop Body

  assert(!m.hasAnyParentAttr('version'), 'version no longer kept after popping Body');
}

// ---------------------------------------------------------------------------
// reset() clears kept attrs
// ---------------------------------------------------------------------------
console.log('\n📦 reset() clears kept attrs\n');
{
  const m = new Matcher();
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });
  assert(m.hasAnyParentAttr('version'), 'kept before reset');
  m.reset();
  assert(!m.hasAnyParentAttr('version'), 'cleared after reset');
}

// ---------------------------------------------------------------------------
// Nearest-ancestor wins when the same attr name is kept at multiple depths
// ---------------------------------------------------------------------------
console.log('\n📦 Nearest ancestor wins on name collision\n');
{
  const m = new Matcher();
  m.push('Outer', { version: 'A' }, null, { keep: ['version'] });
  m.push('Inner', { version: 'B' }, null, { keep: ['version'] });

  assertEqual(m.getAnyParentAttr('version'), 'B', 'nearest (innermost) kept value wins');

  m.pop();
  assertEqual(m.getAnyParentAttr('version'), 'A', 'falls back to outer value after popping inner');
}

// ---------------------------------------------------------------------------
// readOnly() view mirrors getAnyParentAttr/hasAnyParentAttr
// ---------------------------------------------------------------------------
console.log('\n📦 MatcherView mirrors ancestor-attr methods\n');
{
  const m = new Matcher();
  const view = m.readOnly();
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });
  m.push('Child');

  assert(view.hasAnyParentAttr('version'), 'view.hasAnyParentAttr works');
  assertEqual(view.getAnyParentAttr('version'), '1.1', 'view.getAnyParentAttr works');
  assert(!view.hasAnyParentAttr('nope'), 'view.hasAnyParentAttr false for unkept attr');
}

// ---------------------------------------------------------------------------
// snapshot()/restore() round-trips kept attrs
// ---------------------------------------------------------------------------
console.log('\n📦 snapshot()/restore() round-trips kept attrs\n');
{
  const m = new Matcher();
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });
  const snap = m.snapshot();

  m.push('Child');
  m.pop();
  m.pop(); // pop Body -> kept attr should be gone now
  assert(!m.hasAnyParentAttr('version'), 'kept attr gone after popping past snapshot point');

  m.restore(snap);
  assert(m.hasAnyParentAttr('version'), 'kept attr restored from snapshot');
  assertEqual(m.getAnyParentAttr('version'), '1.1', 'restored kept attr has correct value');
}

// ---------------------------------------------------------------------------
// Multiple distinct kept attrs coexist correctly
// ---------------------------------------------------------------------------
console.log('\n📦 Multiple distinct kept attributes coexist\n');
{
  const m = new Matcher();
  m.push('Envelope', { version: '1.1', xmlns: 'soap-env' }, 'soap', { keep: ['version', 'xmlns'] });
  m.push('Body', { lang: 'en' }, null, { keep: ['lang'] });
  m.push('Deep');

  assertEqual(m.getAnyParentAttr('version'), '1.1', 'first kept attr from Envelope');
  assertEqual(m.getAnyParentAttr('xmlns'), 'soap-env', 'second kept attr from Envelope');
  assertEqual(m.getAnyParentAttr('lang'), 'en', 'kept attr from Body');
}

// ---------------------------------------------------------------------------
// keep with a name absent from attrValues is simply ignored (no crash, no entry)
// ---------------------------------------------------------------------------
console.log('\n📦 keep referencing a missing attribute name is a no-op\n');
{
  const m = new Matcher();
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version', 'doesNotExist'] });
  assert(m.hasAnyParentAttr('version'), 'existing kept attr still works');
  assert(!m.hasAnyParentAttr('doesNotExist'), 'non-existent attr name in keep list produces no entry');
}

// ---------------------------------------------------------------------------
// keep with null attrValues is a no-op (does not throw)
// ---------------------------------------------------------------------------
console.log('\n📦 keep with null attrValues does not throw\n');
{
  const m = new Matcher();
  m.push('Body', null, 'soap', { keep: ['version'] });
  assert(!m.hasAnyParentAttr('version'), 'no kept attr when attrValues is null, even with keep specified');
}

// ---------------------------------------------------------------------------
// Backward compatibility: push() still works with 2 or 3 args, no options
// ---------------------------------------------------------------------------
console.log('\n📦 Backward compatibility (push without options)\n');
{
  const m = new Matcher();
  m.push('root');
  m.push('child', { a: '1' });
  m.push('grandchild', { b: '2' }, 'ns');
  assertEqual(m.toString(), 'root.child.ns:grandchild', '3-arg push still builds correct path');
  assert(!m.hasAnyParentAttr('a'), 'attrs not kept unless explicitly requested via options.keep');
}

// ---------------------------------------------------------------------------
// Existing expression matching is wholly unaffected
// ---------------------------------------------------------------------------
console.log('\n📦 Expression matching unaffected (no new syntax introduced)\n');
{
  const m = new Matcher();
  m.push('Envelope', null, 'soap');
  m.push('Body', { version: '1.1' }, 'soap', { keep: ['version'] });
  m.push('UserId');

  const expr = new Expression('soap::Envelope.soap::Body.UserId');
  assert(m.matches(expr), 'ordinary exact-path expression still matches as before');

  const deepExpr = new Expression('..UserId');
  assert(m.matches(deepExpr), 'ordinary deep-wildcard expression still matches as before');

  // "[^version]" is NOT special syntax here - parsed as a literal attribute
  // name "^version" on the current node, which won't exist, so this
  // correctly does not match. Confirms no new syntax leaked in.
  const literalCaret = new Expression('UserId[^version]');
  assert(!m.matches(literalCaret), '"[^version]" treated as literal nonexistent attr, not ancestor syntax');
}


// ---------------------------------------------------------------------------
// Existing expression matching is wholly unaffected (Expression.js untouched)
// ---------------------------------------------------------------------------
console.log('\n📦 invalid and repeated keep\n');
{
  const m3 = new Matcher();
  m3.push('Envelope', null, 'soap');
  m3.push('Body', { version: '1.1' }, 'soap', { keep: ['lang'] });
  assertEqual(m3.getAnyParentAttr('lang'), undefined, 'non-existent kept attr returns undefined');
  m3.push('parent', { space: 'preserve' }, null, { keep: ['space'] });
  assertEqual(m3.getAnyParentAttr('space'), 'preserve', 'kept attr from parent');
  m3.push('child', { space: 'default' }, null, { keep: ['space'] });
  assertEqual(m3.getAnyParentAttr('space'), 'default', 'nearest kept attr wins');

  m3.push('GetUserRequest', { id: '42' }, 'ns');
  m3.pop();//GetUserRequest
  m3.pop();//child
  assertEqual(m3.getAnyParentAttr('space'), 'preserve', 'falls back to parent after child popped');
  m3.push('UserId', null, 'ns');
  assertEqual(m3.getAnyParentAttr('space'), 'preserve', 'still preserve after pushing UserId');
  m3.pop();//UserId
  assertEqual(m3.getAnyParentAttr('space'), 'preserve', 'still preserve after popping UserId');
  m3.pop();//parent
  assertEqual(m3.getAnyParentAttr('space'), undefined, 'undefined after popping parent');

}

console.log('\n✅ All keep-attribute tests passed!\n');
