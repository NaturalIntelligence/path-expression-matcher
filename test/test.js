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

console.log('\n🧪 Running fast-xml-tagger Test Suite\n');

// =============================================================================
// Basic Path Tracking Tests
// =============================================================================

console.log('\n📦 Basic Path Tracking Tests\n');

// Test 1: Basic push/pop with new API
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user", { id: "123" });

  assertEqual(matcher.getDepth(), 3, "Depth should be 3");
  assertEqual(matcher.getCurrentTag(), "user", "Current tag should be 'user'");
  assertEqual(matcher.toString(), "root.users.user", "Path string should match");

  matcher.pop();
  assertEqual(matcher.getDepth(), 2, "Depth should be 2 after pop");
  assertEqual(matcher.getCurrentTag(), "users", "Current tag should be 'users'");
}

// Test 2: Attribute access (current node only)
{
  const matcher = new Matcher();
  matcher.push("user", { id: "123", type: "admin" });

  assertEqual(matcher.getAttrValue("id"), "123", "Should get attribute value");
  assertEqual(matcher.getAttrValue("type"), "admin", "Should get attribute value");
  assert(matcher.hasAttr("id"), "Should have attribute 'id'");
  assert(matcher.hasAttr("type"), "Should have attribute 'type'");
  assert(!matcher.hasAttr("name"), "Should not have attribute 'name'");
}

// Test 3: Position and Counter auto-calculation
{
  const matcher = new Matcher();
  matcher.push("root");

  // First child
  matcher.push("b");
  assertEqual(matcher.getPosition(), 0, "First child position should be 0");
  assertEqual(matcher.getCounter(), 0, "First 'b' counter should be 0");
  matcher.pop();

  // Second child (different tag)
  matcher.push("c");
  assertEqual(matcher.getPosition(), 1, "Second child position should be 1");
  assertEqual(matcher.getCounter(), 0, "First 'c' counter should be 0");
  matcher.pop();

  // Third child (same tag as first)
  matcher.push("b");
  assertEqual(matcher.getPosition(), 2, "Third child position should be 2");
  assertEqual(matcher.getCounter(), 1, "Second 'b' counter should be 1");
  matcher.pop();

  // Fourth child
  matcher.push("c");
  assertEqual(matcher.getPosition(), 3, "Fourth child position should be 3");
  assertEqual(matcher.getCounter(), 1, "Second 'c' counter should be 1");
}

// Test 4: Update current attributes
{
  const matcher = new Matcher();
  matcher.push("user");
  matcher.updateCurrent({ id: "123", type: "admin" });

  assertEqual(matcher.getAttrValue("id"), "123", "Should have updated value");
  assertEqual(matcher.getAttrValue("type"), "admin", "Should have updated value");
}

// Test 5: Values removed from ancestors
{
  const matcher = new Matcher();
  matcher.push("root", { id: "1" });
  matcher.push("user", { type: "admin" });

  assertEqual(matcher.path[0].values, undefined, "Ancestor should not have values");
  assertEqual(matcher.path[1].values.type, "admin", "Current should have values");
}

// Test 6: Pop on empty path
{
  const matcher = new Matcher();
  const result = matcher.pop();
  assertEqual(result, undefined, "Pop on empty should return undefined");
  assertEqual(matcher.getDepth(), 0, "Depth should remain 0");
}

// Test 7: Reset clears everything
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");
  matcher.reset();

  assertEqual(matcher.getDepth(), 0, "Depth should be 0 after reset");
  assertEqual(matcher.siblingStacks.length, 0, "Sibling stacks should be cleared");
}

// =============================================================================
// Pattern Matching Tests
// =============================================================================

console.log('\n📦 Pattern Matching Tests\n');

// Test 8: Exact path match
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user");

  const expr = new Expression("root.users.user");
  assert(matcher.matches(expr), "Should match exact path");

  const expr2 = new Expression("root.users.admin");
  assert(!matcher.matches(expr2), "Should not match different path");
}

// Test 9: Wildcard match
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");
  matcher.push("user");

  const expr1 = new Expression("*.users.user");
  assert(matcher.matches(expr1), "Should match with wildcard at start");

  const expr2 = new Expression("root.*.user");
  assert(matcher.matches(expr2), "Should match with wildcard in middle");

  const expr3 = new Expression("root.users.*");
  assert(matcher.matches(expr3), "Should match with wildcard at end");

  const expr4 = new Expression("*.users");
  assert(!matcher.matches(expr4), "Should not match with wildcard when depth is not matching");
}

// Test 10: Deep wildcard match
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("level1");
  matcher.push("level2");
  matcher.push("user");

  const expr1 = new Expression("..user");
  assert(matcher.matches(expr1), "Should match user anywhere");

  const expr2 = new Expression("root..user");
  assert(matcher.matches(expr2), "Should match user under root");

  const expr3 = new Expression("..level2.user");
  assert(matcher.matches(expr3), "Should match level2.user anywhere");
}

// Test 11: Multiple deep wildcards
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("a");
  matcher.push("b");
  matcher.push("c");
  matcher.push("d");

  const expr = new Expression("root..b..d");
  assert(matcher.matches(expr), "Should match with multiple deep wildcards");
}

// Test 12: Attribute matching (current node only)
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", { id: "123", type: "admin" });

  const expr1 = new Expression("root.user[id]");
  assert(matcher.matches(expr1), "Should match with attribute present");

  const expr2 = new Expression("root.user[name]");
  assert(!matcher.matches(expr2), "Should not match with missing attribute");
}

// Test 13: Attribute value matching (current node only)
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", { type: "admin" });

  const expr1 = new Expression("root.user[type=admin]");
  assert(matcher.matches(expr1), "Should match with correct attribute value");

  const expr2 = new Expression("root.user[type=guest]");
  assert(!matcher.matches(expr2), "Should not match with wrong attribute value");
}

// Test 14: Ancestor attribute checking not possible
{
  const matcher = new Matcher();
  matcher.push("root", { lang: "en" });
  matcher.push("users");
  matcher.push("user");

  // Can't check ancestor attributes (values not stored)
  const expr = new Expression("root[lang].users.user");
  assert(!matcher.matches(expr), "Should not match ancestor attribute (not stored)");
}

// =============================================================================
// Position Selector Tests
// =============================================================================

console.log('\n📦 Position Selector Tests\n');

// Test 15: :first selector (counter = 0)
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("item");  // counter = 0

  const expr = new Expression("root.item:first");
  assert(matcher.matches(expr), "Should match :first with counter 0");

  matcher.pop();
  matcher.push("item");  // counter = 1
  assert(!matcher.matches(expr), "Should not match :first with counter 1");
}

// Test 16: :nth(n) selector
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("item");  // counter = 0
  matcher.pop();

  matcher.push("item");  // counter = 1
  const expr1 = new Expression("root.item:nth(1)");
  assert(matcher.matches(expr1), "Should match :nth(1) with counter 1");

  const expr0 = new Expression("root.item:nth(0)");
  assert(!matcher.matches(expr0), "Should not match :nth(0) with counter 1");
  matcher.pop();

  matcher.push("item");  // counter = 2
  const expr2 = new Expression("root.item:nth(2)");
  assert(matcher.matches(expr2), "Should match :nth(2) with counter 2");
}

// Test 17: :odd selector
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("item");  // counter = 0 (even)
  const oddExpr = new Expression("root.item:odd");
  assert(!matcher.matches(oddExpr), "Should not match :odd with counter 0");
  matcher.pop();

  matcher.push("item");  // counter = 1 (odd)
  assert(matcher.matches(oddExpr), "Should match :odd with counter 1");
  matcher.pop();

  matcher.push("item");  // counter = 2 (even)
  assert(!matcher.matches(oddExpr), "Should not match :odd with counter 2");
  matcher.pop();

  matcher.push("item");  // counter = 3 (odd)
  assert(matcher.matches(oddExpr), "Should match :odd with counter 3");
}

// Test 18: :even selector
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("item");  // counter = 0 (even)
  const evenExpr = new Expression("root.item:even");
  assert(matcher.matches(evenExpr), "Should match :even with counter 0");
  matcher.pop();

  matcher.push("item");  // counter = 1 (odd)
  assert(!matcher.matches(evenExpr), "Should not match :even with counter 1");
  matcher.pop();

  matcher.push("item");  // counter = 2 (even)
  assert(matcher.matches(evenExpr), "Should match :even with counter 2");
}

// Test 19: Position selectors with deep wildcard
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("data");
  matcher.push("items");

  matcher.push("item");  // counter = 0
  matcher.pop();
  matcher.push("item");  // counter = 1

  const expr = new Expression("..item:nth(1)");
  assert(matcher.matches(expr), "Should match ..item:nth(1) anywhere in tree");
}

// Test 20: Combined attribute and position
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("user", { type: "admin" });  // counter = 0
  const expr = new Expression("root.user[type=admin]:first");
  assert(matcher.matches(expr), "Should match combined attribute and position");
  matcher.pop();

  matcher.push("user", { type: "admin" });  // counter = 1
  assert(!matcher.matches(expr), "Should not match :first when counter = 1");
}

// =============================================================================
// Edge Cases
// =============================================================================

console.log('\n📦 Edge Case Tests\n');

// Test 21: Empty pattern
{
  const matcher = new Matcher();
  matcher.push("root");

  const expr = new Expression("");
  assert(!matcher.matches(expr), "Empty pattern should not match");
}

// Test 22: Path length mismatch
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  const expr1 = new Expression("root.users.user");
  assert(!matcher.matches(expr1), "Should not match when path too short");

  const expr2 = new Expression("root");
  assert(!matcher.matches(expr2), "Should not match when pattern too short");
}

// Test 23: Position vs Counter distinction
{
  const matcher = new Matcher();
  matcher.push("root");

  // Different tags interspersed
  matcher.push("a");  // position=0, counter=0
  matcher.pop();
  matcher.push("b");  // position=1, counter=0
  matcher.pop();
  matcher.push("a");  // position=2, counter=1

  assertEqual(matcher.getPosition(), 2, "Position should be 2");
  assertEqual(matcher.getCounter(), 1, "Counter should be 1");

  // :first checks counter, not position
  const expr = new Expression("root.a:first");
  assert(!matcher.matches(expr), ":first should use counter (1), not position (2)");
}

// Test 24: Snapshot and restore
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("users");

  const snapshot = matcher.snapshot();

  matcher.push("user", { id: "123" });
  assertEqual(matcher.getDepth(), 3, "Depth should be 3 before restore");

  matcher.restore(snapshot);
  assertEqual(matcher.getDepth(), 2, "Depth should be 2 after restore");
  assertEqual(matcher.getCurrentTag(), "users", "Should restore to 'users'");

  // Sibling counts should be restored too
  matcher.push("user");
  assertEqual(matcher.getCounter(), 0, "Counter should be 0 after restore");
}

// Test 25: Custom separator
{
  const matcher = new Matcher({ separator: '/' });
  matcher.push("root");
  matcher.push("users");

  assertEqual(matcher.toString(), "root/users", "Should use custom separator");
  assertEqual(matcher.toString('.'), "root.users", "Should allow override in toString");

  const expr = new Expression("root/users", { separator: '/' });
  assert(matcher.matches(expr), "Should match with custom separator");
}

// Test 26: Null and undefined attributes
{
  const matcher = new Matcher();
  matcher.push("user", null);
  assert(!matcher.hasAttr("id"), "Should handle null attributes");

  matcher.pop();
  matcher.push("user", undefined);
  assert(!matcher.hasAttr("id"), "Should handle undefined attributes");

  matcher.pop();
  matcher.push("user", {});
  assert(!matcher.hasAttr("id"), "Should handle empty attributes object");
}

// Test 27: Attribute with whitespace in pattern
{
  const matcher = new Matcher();
  matcher.push("user", { id: "123", type: "admin" });

  const expr = new Expression("user[ id ]");
  assert(matcher.matches(expr), "Should trim whitespace in attribute names");

  const expr2 = new Expression("user[ type = admin ]");
  assert(matcher.matches(expr2), "Should trim whitespace in attribute values");
}

// Test 28: String coercion for attribute values
{
  const matcher = new Matcher();
  matcher.push("user", { id: "123", count: 5 });

  // Even though count is number 5, pattern expects string "5"
  const expr = new Expression("user[count=5]");
  assert(matcher.matches(expr), "Should coerce numbers to strings for comparison");
}

// =============================================================================
// Performance / Caching Tests
// =============================================================================

console.log('\n📦 Performance Tests\n');

// Test 29: Expression analysis is cached
{
  const expr = new Expression("root..user[id]:first");

  // These should return cached values (not recalculate)
  assert(expr.hasDeepWildcard(), "Should have deep wildcard");
  assert(expr.hasAttributeCondition(), "Should have attribute condition");
  assert(expr.hasPositionSelector(), "Should have position selector");

  // Verify they're using cached values by checking the properties exist
  assert(expr._hasDeepWildcard !== undefined, "Should have cached _hasDeepWildcard");
  assert(expr._hasAttributeCondition !== undefined, "Should have cached _hasAttributeCondition");
  assert(expr._hasPositionSelector !== undefined, "Should have cached _hasPositionSelector");
}

// =============================================================================
// Complex Real-World Scenarios
// =============================================================================

console.log('\n📦 Complex Real-World Scenarios\n');

// Test 30: XML document simulation
{
  const matcher = new Matcher();

  // <html>
  matcher.push("html", { lang: "en" });

  //   <head>
  matcher.push("head");
  matcher.push("title");
  matcher.pop();
  matcher.pop();

  //   <body>
  matcher.push("body");

  //     <div class="container">
  matcher.push("div", { class: "container" });

  //       <p>First paragraph</p>
  matcher.push("p");
  assertEqual(matcher.toString(), "html.body.div.p", "Path should be correct");
  assertEqual(matcher.getCounter(), 0, "First p should have counter 0");
  matcher.pop();

  //       <p>Second paragraph</p>
  matcher.push("p");
  assertEqual(matcher.getCounter(), 1, "Second p should have counter 1");

  const expr = new Expression("..p:nth(1)");
  assert(matcher.matches(expr), "Should match second paragraph anywhere");
}

// Test 31: Nested repeated elements
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("items");

  // <item><item><item>nested</item></item></item>
  matcher.push("item");  // counter=0
  matcher.push("item");  // counter=0 (different level)
  matcher.push("item");  // counter=0 (different level)

  assertEqual(matcher.getDepth(), 5, "Should handle nested same-named tags");
  assertEqual(matcher.getCounter(), 0, "Innermost item should have counter 0");

  const expr = new Expression("..item.item.item:first");
  assert(matcher.matches(expr), "Should match nested items with :first");
}

// Test 32: Mixed content simulation
{
  const matcher = new Matcher();
  matcher.push("data");

  matcher.push("user", { id: "1" });
  matcher.pop();

  matcher.push("post", { id: "1" });
  matcher.pop();

  matcher.push("user", { id: "2" });

  assertEqual(matcher.getPosition(), 2, "Should track position across different tags");
  assertEqual(matcher.getCounter(), 1, "Should track counter per tag name");

  const expr = new Expression("data.user:nth(1)");
  assert(matcher.matches(expr), "Should match second user");
}

console.log('\n✅ All tests passed!\n');