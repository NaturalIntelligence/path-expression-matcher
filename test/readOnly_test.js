import { Expression, Matcher } from '../src/index.js';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ ${message}`);
  }
  console.log(`✓ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

function assertThrows(fn, expectedMessage, message) {
  try {
    fn();
    throw new Error(`❌ ${message} — expected a TypeError to be thrown but nothing was thrown`);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw new Error(`❌ ${message} — expected TypeError but got ${err.constructor.name}: ${err.message}`);
    }
    if (expectedMessage && !err.message.includes(expectedMessage)) {
      throw new Error(`❌ ${message} — TypeError thrown but message did not include "${expectedMessage}"\n  Actual: ${err.message}`);
    }
    console.log(`✓ ${message}`);
  }
}

console.log('\n🧪 Running readOnly() API Test Suite\n');

// =============================================================================
// 1. Basic construction
// =============================================================================

console.log('\n📦 Construction Tests\n');

// Test 1: readOnly() returns an object
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assert(ro !== null && typeof ro === 'object', "readOnly() should return an object");
}

// Test 2: readOnly() returns a different reference (not the matcher itself)
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assert(ro !== matcher, "readOnly() should return a proxy, not the original instance");
}

// Test 3: Multiple calls to readOnly() each return a new proxy
{
  const matcher = new Matcher();
  const ro1 = matcher.readOnly();
  const ro2 = matcher.readOnly();

  assert(ro1 !== ro2, "Each readOnly() call should return a fresh proxy");
}

// =============================================================================
// 2. Read methods work correctly
// =============================================================================

console.log('\n📦 Read Method Tests\n');

// Test 4: separator is readable
{
  const matcher = new Matcher({ separator: '/' });
  const ro = matcher.readOnly();

  assertEqual(ro.separator, '/', "separator should be readable via read-only view");
}

// Test 5: getCurrentTag() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user", { id: "42" });

  const ro = matcher.readOnly();
  assertEqual(ro.getCurrentTag(), "user", "getCurrentTag() should work on read-only view");
}

// Test 6: getCurrentNamespace() works
{
  const matcher = new Matcher();
  matcher.push("element", {}, "ns");

  const ro = matcher.readOnly();
  assertEqual(ro.getCurrentNamespace(), "ns", "getCurrentNamespace() should work on read-only view");
}

// Test 7: getAttrValue() works
{
  const matcher = new Matcher();
  matcher.push("user", { id: "99", role: "editor" });

  const ro = matcher.readOnly();
  assertEqual(ro.getAttrValue("id"), "99", "getAttrValue() should work on read-only view");
  assertEqual(ro.getAttrValue("role"), "editor", "getAttrValue() should work for any attribute");
  assertEqual(ro.getAttrValue("missing"), undefined, "getAttrValue() should return undefined for missing key");
}

// Test 8: hasAttr() works
{
  const matcher = new Matcher();
  matcher.push("user", { id: "1" });

  const ro = matcher.readOnly();
  assert(ro.hasAttr("id"), "hasAttr() should return true for present attribute");
  assert(!ro.hasAttr("name"), "hasAttr() should return false for absent attribute");
}

// Test 9: getPosition() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("a"); matcher.pop();
  matcher.push("b"); matcher.pop();
  matcher.push("a"); // position = 2

  const ro = matcher.readOnly();
  assertEqual(ro.getPosition(), 2, "getPosition() should work on read-only view");
}

// Test 10: getCounter() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("item"); matcher.pop();
  matcher.push("item"); // counter = 1

  const ro = matcher.readOnly();
  assertEqual(ro.getCounter(), 1, "getCounter() should work on read-only view");
}

// Test 11: getIndex() works (deprecated alias)
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("a"); matcher.pop();
  matcher.push("b"); // position = 1

  const ro = matcher.readOnly();
  assertEqual(ro.getIndex(), 1, "getIndex() should work on read-only view (deprecated alias)");
}

// Test 12: getDepth() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user");

  const ro = matcher.readOnly();
  assertEqual(ro.getDepth(), 3, "getDepth() should work on read-only view");
}

// Test 13: toString() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user");

  const ro = matcher.readOnly();
  assertEqual(ro.toString(), "root.users.user", "toString() should work on read-only view");
  assertEqual(ro.toString('/'), "root/users/user", "toString() should accept custom separator");
}

// Test 14: toArray() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user");

  const ro = matcher.readOnly();
  const arr = ro.toArray();
  assertEqual(arr.length, 3, "toArray() should return correct length");
  assertEqual(arr[0], "root", "toArray() first element should be 'root'");
  assertEqual(arr[2], "user", "toArray() last element should be 'user'");
}

// Test 15: matches() works
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user", { id: "5" });

  const ro = matcher.readOnly();

  assert(ro.matches(new Expression("root.users.user")), "matches() exact path should work");
  assert(ro.matches(new Expression("..user")), "matches() deep wildcard should work");
  assert(ro.matches(new Expression("root.users.user[id]")), "matches() attribute check should work");
  assert(ro.matches(new Expression("root.users.user[id=5]")), "matches() attribute value check should work");
  assert(!ro.matches(new Expression("root.users.admin")), "matches() non-matching expression should return false");
}

// Test 16: snapshot() works and returns independent copy
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const ro = matcher.readOnly();
  const snap = ro.snapshot();

  // Push after snapshot via the real matcher
  matcher.push("user");

  assertEqual(snap.path.length, 2, "snapshot() should capture state at time of call");
  assertEqual(matcher.getDepth(), 3, "Original matcher should continue to change");
}

// =============================================================================
// 3. Read-only view is live (reflects current matcher state)
// =============================================================================

console.log('\n📦 Live View Tests\n');

// Test 17: Read-only view reflects subsequent pushes on the original matcher
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  matcher.push("root");
  assertEqual(ro.getDepth(), 1, "Read-only view should reflect push on original matcher");
  assertEqual(ro.getCurrentTag(), "root", "Read-only view should reflect new current tag");

  matcher.push("users");
  assertEqual(ro.getDepth(), 2, "Read-only view should reflect second push");
}

// Test 18: Read-only view reflects pops on the original matcher
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const ro = matcher.readOnly();

  matcher.pop();
  assertEqual(ro.getDepth(), 1, "Read-only view should reflect pop on original matcher");
  assertEqual(ro.getCurrentTag(), "root", "Read-only view current tag should update after pop");
}

// Test 19: Read-only view reflects reset on the original matcher
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const ro = matcher.readOnly();
  matcher.reset();

  assertEqual(ro.getDepth(), 0, "Read-only view should reflect reset on original matcher");
  assertEqual(ro.getCurrentTag(), undefined, "Read-only view getCurrentTag should be undefined after reset");
}

// Test 20: Read-only view reflects updateCurrent on the original matcher
{
  const matcher = new Matcher();
  matcher.push("user");

  const ro = matcher.readOnly();
  assert(!ro.hasAttr("id"), "Attribute should not exist before updateCurrent");

  matcher.updateCurrent({ id: "77" });
  assert(ro.hasAttr("id"), "Read-only view should reflect updateCurrent");
  assertEqual(ro.getAttrValue("id"), "77", "Read-only view should reflect updated attribute value");
}

// =============================================================================
// 4. Mutating methods are blocked
// =============================================================================

console.log('\n📦 Mutation Guard Tests\n');

// Test 21: push() throws TypeError
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assertThrows(
    () => ro.push("child", {}),
    "push",
    "push() should throw TypeError on read-only view"
  );
}

// Test 22: pop() throws TypeError
{
  const matcher = new Matcher();
  matcher.push("root");
  const ro = matcher.readOnly();

  assertThrows(
    () => ro.pop(),
    "pop",
    "pop() should throw TypeError on read-only view"
  );
}

// Test 23: reset() throws TypeError
{
  const matcher = new Matcher();
  matcher.push("root");
  const ro = matcher.readOnly();

  assertThrows(
    () => ro.reset(),
    "reset",
    "reset() should throw TypeError on read-only view"
  );
}

// Test 24: updateCurrent() throws TypeError
{
  const matcher = new Matcher();
  matcher.push("user");
  const ro = matcher.readOnly();

  assertThrows(
    () => ro.updateCurrent({ id: "1" }),
    "updateCurrent",
    "updateCurrent() should throw TypeError on read-only view"
  );
}

// Test 25: restore() throws TypeError
{
  const matcher = new Matcher();
  matcher.push("root");
  const snap = matcher.snapshot();
  const ro = matcher.readOnly();

  assertThrows(
    () => ro.restore(snap),
    "restore",
    "restore() should throw TypeError on read-only view"
  );
}

// Test 26: Blocked methods do NOT mutate state when called
{
  const matcher = new Matcher();
  matcher.push("root");
  const ro = matcher.readOnly();

  try { ro.push("child"); } catch (_) { }
  try { ro.pop(); } catch (_) { }
  try { ro.reset(); } catch (_) { }

  assertEqual(matcher.getDepth(), 1, "Original matcher state should be unchanged after blocked calls");
  assertEqual(matcher.getCurrentTag(), "root", "Original matcher current tag should be unchanged");
}

// =============================================================================
// 5. Property assignment and deletion are blocked
// =============================================================================

console.log('\n📦 Property Write Guard Tests\n');

// Test 27: Direct property assignment throws TypeError
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assertThrows(
    () => { ro.separator = '/'; },
    "read-only",
    "Setting a property on read-only view should throw TypeError"
  );
}

// Test 28: Property deletion throws TypeError
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assertThrows(
    () => { delete ro.separator; },
    "read-only",
    "Deleting a property from read-only view should throw TypeError"
  );
}

// Test 29: Original matcher is not affected by attempted property write
{
  const matcher = new Matcher({ separator: '.' });
  const ro = matcher.readOnly();

  try { ro.separator = '/'; } catch (_) { }

  assertEqual(matcher.separator, '.', "Original matcher separator should be unaffected");
}

// =============================================================================
// 6. path property is a frozen copy (cannot mutate internal state)
// =============================================================================

console.log('\n📦 Frozen path Property Tests\n');

// Test 30: ro.path is frozen (direct mutation throws in strict mode / is silently ignored)
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  const ro = matcher.readOnly();
  const roPath = ro.path;

  assert(Object.isFrozen(roPath), "ro.path should be frozen");
}

// Test 31: Mutating ro.path does not affect the original matcher's path
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  const ro = matcher.readOnly();

  // Attempt to push directly on the returned path array (should be silently ignored or throw)
  try { ro.path.push({ tag: 'injected', position: 99, counter: 99 }); } catch (_) { }

  assertEqual(matcher.getDepth(), 2, "Original matcher depth should be unaffected by ro.path mutation attempt");
  assertEqual(matcher.getCurrentTag(), "user", "Original matcher current tag should be unaffected");
}

// Test 32: Node objects inside ro.path are frozen
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", { id: "1" });

  const ro = matcher.readOnly();
  const node = ro.path[1];

  assert(Object.isFrozen(node), "Node objects inside ro.path should be frozen");
}

// Test 33: Mutating a node from ro.path does not affect original matcher
{
  const matcher = new Matcher();
  matcher.push("user", { id: "1" });

  const ro = matcher.readOnly();

  // Attempt to modify the node object (should be silently ignored or throw)
  try { ro.path[0].tag = 'hacked'; } catch (_) { }

  assertEqual(matcher.getCurrentTag(), "user", "Original matcher current tag should be unaffected");
}

// =============================================================================
// 7. Edge cases
// =============================================================================

console.log('\n📦 Edge Case Tests\n');

// Test 34: readOnly() on an empty matcher
{
  const matcher = new Matcher();
  const ro = matcher.readOnly();

  assertEqual(ro.getDepth(), 0, "Empty matcher read-only view should report depth 0");
  assertEqual(ro.getCurrentTag(), undefined, "Empty matcher read-only getCurrentTag should be undefined");
  assertEqual(ro.getPosition(), -1, "Empty matcher read-only getPosition should be -1");
  assertEqual(ro.getCounter(), -1, "Empty matcher read-only getCounter should be -1");
  assert(!ro.hasAttr("id"), "Empty matcher read-only hasAttr should return false");
}

// Test 35: readOnly() can call snapshot(), result can restore the real matcher
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const ro = matcher.readOnly();
  const snap = ro.snapshot();

  matcher.push("user", { id: "1" });
  assertEqual(matcher.getDepth(), 3, "Depth should be 3 before restore");

  // Restore on the real matcher using the snapshot obtained from the read-only view
  matcher.restore(snap);
  assertEqual(matcher.getDepth(), 2, "Depth should be 2 after restoring with snapshot from read-only view");
  assertEqual(matcher.getCurrentTag(), "users", "Current tag should be 'users' after restore");
}

// Test 36: readOnly() of a matcher with namespace
{
  const matcher = new Matcher();
  matcher.push("root", {}, "ns1");
  matcher.push("child", {}, "ns2");

  const ro = matcher.readOnly();
  assertEqual(ro.getCurrentNamespace(), "ns2", "getCurrentNamespace() should work with namespace");
  assertEqual(ro.toString('.', true), "ns1:root.ns2:child", "toString() with namespace should work via read-only view");
}

// Test 37: readOnly() matches() returns false correctly for deep wildcard
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const ro = matcher.readOnly();

  assert(!ro.matches(new Expression("..user")), "Should not match '..user' when current tag is 'users'");
  assert(ro.matches(new Expression("..users")), "Should match '..users' when current tag is 'users'");
}

console.log('\n✅ All readOnly() tests passed!\n');