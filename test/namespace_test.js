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

console.log('\n🧪 Running Namespace Support Test Suite (Double Colon Syntax)\n');

// =============================================================================
// Basic Namespace Tests  
// =============================================================================

console.log('\n📦 Basic Namespace Tests\n');

// Test 1: Push with namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns");

  assertEqual(matcher.getCurrentTag(), "user", "Current tag should be 'user'");
  assertEqual(matcher.getCurrentNamespace(), "ns", "Current namespace should be 'ns'");
  assertEqual(matcher.toString(), "root.ns:user", "Path should include namespace");
}

// Test 2: Push without namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  assertEqual(matcher.getCurrentTag(), "user", "Current tag should be 'user'");
  assertEqual(matcher.getCurrentNamespace(), undefined, "Should have no namespace");
  assertEqual(matcher.toString(), "root.user", "Path should not include namespace");
}

// Test 3: Mixed namespaced and non-namespaced tags
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("item", null, "ns1");
  matcher.push("data");
  matcher.push("value", null, "ns2");

  assertEqual(matcher.toString(), "root.ns1:item.data.ns2:value", "Should handle mixed namespaces");
}

// Test 4: toString without namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns");

  assertEqual(matcher.toString('.', false), "root.user", "Should exclude namespace when requested");
  assertEqual(matcher.toString('.', true), "root.ns:user", "Should include namespace by default");
}

// =============================================================================
// Namespace Pattern Parsing Tests
// =============================================================================

console.log('\n📦 Namespace Pattern Parsing Tests (:: syntax)\n');

// Test 5: Parse simple namespace pattern
{
  const expr = new Expression("ns::user");
  assertEqual(expr.segments[0].namespace, "ns", "Should parse namespace");
  assertEqual(expr.segments[0].tag, "user", "Should parse tag name");
}

// Test 6: Parse pattern with namespace and attributes
{
  const expr = new Expression("ns::user[id]");
  assertEqual(expr.segments[0].namespace, "ns", "Should parse namespace");
  assertEqual(expr.segments[0].tag, "user", "Should parse tag");
  assertEqual(expr.segments[0].attrName, "id", "Should parse attribute");
}

// Test 7: Parse pattern with namespace and position
{
  const expr = new Expression("ns::user:first");
  assertEqual(expr.segments[0].namespace, "ns", "Should parse namespace");
  assertEqual(expr.segments[0].tag, "user", "Should parse tag");
  assertEqual(expr.segments[0].position, "first", "Should parse position");
}

// Test 8: Parse pattern with namespace, attributes, and position
{
  const expr = new Expression("ns::user[type=admin]:first");
  assertEqual(expr.segments[0].namespace, "ns", "Should parse namespace");
  assertEqual(expr.segments[0].tag, "user", "Should parse tag");
  assertEqual(expr.segments[0].attrName, "type", "Should parse attribute name");
  assertEqual(expr.segments[0].attrValue, "admin", "Should parse attribute value");
  assertEqual(expr.segments[0].position, "first", "Should parse position");
}

// Test 9: Parse complex pattern with multiple namespaces
{
  const expr = new Expression("ns1::root.ns2::items.ns3::item");
  assertEqual(expr.segments[0].namespace, "ns1", "First segment should have ns1");
  assertEqual(expr.segments[0].tag, "root", "First segment should be root");
  assertEqual(expr.segments[1].namespace, "ns2", "Second segment should have ns2");
  assertEqual(expr.segments[1].tag, "items", "Second segment should be items");
  assertEqual(expr.segments[2].namespace, "ns3", "Third segment should have ns3");
  assertEqual(expr.segments[2].tag, "item", "Third segment should be item");
}

// Test 10: Pattern without namespace should have undefined namespace
{
  const expr = new Expression("user");
  assertEqual(expr.segments[0].namespace, undefined, "Should have no namespace");
  assertEqual(expr.segments[0].tag, "user", "Should parse tag");
}

// Test 11: Mixed namespaced and non-namespaced in pattern
{
  const expr = new Expression("root.ns::items.item");
  assertEqual(expr.segments[0].namespace, undefined, "First should have no namespace");
  assertEqual(expr.segments[1].namespace, "ns", "Second should have namespace");
  assertEqual(expr.segments[2].namespace, undefined, "Third should have no namespace");
}

// Test 12: NO AMBIGUITY - ns::first is namespace + tag named "first"
{
  const expr = new Expression("ns::first");
  assertEqual(expr.segments[0].namespace, "ns", "Should parse namespace");
  assertEqual(expr.segments[0].tag, "first", "Should parse tag 'first'");
  assertEqual(expr.segments[0].position, undefined, "Should have NO position");
}

// =============================================================================
// Namespace Matching Tests
// =============================================================================

console.log('\n📦 Namespace Matching Tests\n');

// Test 13: Exact namespace match
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns");

  const expr = new Expression("root.ns::user");
  assert(matcher.matches(expr), "Should match exact namespace");
}

// Test 14: Namespace mismatch
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns1");

  const expr = new Expression("root.ns2::user");
  assert(!matcher.matches(expr), "Should not match different namespace");
}

// Test 15: Pattern without namespace matches any namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns");

  const expr = new Expression("root.user");
  assert(matcher.matches(expr), "Pattern without namespace should match any namespace");
}

// Test 16: Pattern without namespace matches tag without namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  const expr = new Expression("root.user");
  assert(matcher.matches(expr), "Should match when both have no namespace");
}

// Test 17: Pattern with namespace doesn't match tag without namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user");

  const expr = new Expression("root.ns::user");
  assert(!matcher.matches(expr), "Pattern with namespace should not match tag without namespace");
}

// Test 18: Wildcard namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns1");

  const expr = new Expression("root.*::user");
  assert(matcher.matches(expr), "Wildcard namespace should match any namespace");

  matcher.pop();
  matcher.push("user", null, "ns2");
  assert(matcher.matches(expr), "Wildcard namespace should match different namespace");
}

// Test 19: Namespace with attributes
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", { id: "123" }, "ns");

  const expr = new Expression("root.ns::user[id]");
  assert(matcher.matches(expr), "Should match namespace with attributes");
}

// Test 20: Namespace with position selector
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("user", null, "ns");  // counter = 0

  const expr = new Expression("root.ns::user:first");
  assert(matcher.matches(expr), "Should match namespace with position selector");

  matcher.pop();
  matcher.push("user", null, "ns");  // counter = 1
  assert(!matcher.matches(expr), "Should not match :first when counter = 1");
}

// Test 21: Deep wildcard with namespace
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("level1");
  matcher.push("level2");
  matcher.push("user", null, "ns");

  const expr1 = new Expression("..ns::user");
  assert(matcher.matches(expr1), "Should match namespaced tag anywhere");

  const expr2 = new Expression("root..ns::user");
  assert(matcher.matches(expr2), "Should match namespaced tag under root");
}

// Test 22: CRITICAL - Tag named "first" with namespace "ns"
{
  const matcher = new Matcher();
  matcher.push("root");
  matcher.push("first", null, "ns");  // Tag "first" with namespace "ns"

  const expr = new Expression("root.ns::first");
  assert(matcher.matches(expr), "Should match ns::first (NO AMBIGUITY!)");

  matcher.pop();
  matcher.push("first", null, "ns");  // counter = 1
  const expr2 = new Expression("root.ns::first:first");
  assert(!matcher.matches(expr2), "Should not match :first when counter = 1");
}

// =============================================================================
// Counter and Position with Namespaces
// =============================================================================

console.log('\n📦 Counter and Position with Namespaces\n');

// Test 23: Different namespaces have separate counters
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("item", null, "ns1");  // ns1::item counter = 0
  assertEqual(matcher.getCounter(), 0, "First ns1::item should have counter 0");
  matcher.pop();

  matcher.push("item", null, "ns2");  // ns2::item counter = 0 (different namespace)
  assertEqual(matcher.getCounter(), 0, "First ns2::item should have counter 0");
  matcher.pop();

  matcher.push("item", null, "ns1");  // ns1::item counter = 1
  assertEqual(matcher.getCounter(), 1, "Second ns1::item should have counter 1");
}

// Test 24: Namespace affects :first matching
{
  const matcher = new Matcher();
  matcher.push("root");

  matcher.push("item", null, "ns1");
  matcher.pop();
  matcher.push("item", null, "ns2");  // This is first ns2::item

  const expr = new Expression("root.ns2::item:first");
  assert(matcher.matches(expr), "Should match :first for ns2::item");

  const expr2 = new Expression("root.ns1::item:first");
  assert(!matcher.matches(expr2), "Should not match :first for ns1::item (counter=1)");
}

// =============================================================================
// SOAP/XML Real-World Example
// =============================================================================

console.log('\n📦 Real-World SOAP Example\n');

// Test 25: Complex SOAP scenario
{
  const matcher = new Matcher();

  matcher.push("Envelope", null, "soap");
  matcher.push("Body", null, "soap");
  matcher.push("GetUser", null, "ns");
  matcher.push("UserId", null, "ns");

  assertEqual(matcher.toString(), "soap:Envelope.soap:Body.ns:GetUser.ns:UserId",
    "Should build correct namespaced path");

  const expr = new Expression("soap::Envelope.soap::Body..ns::UserId");
  assert(matcher.matches(expr), "Should match SOAP-style namespaced pattern");
}

console.log('\n✅ All namespace tests passed with double-colon syntax!\n');