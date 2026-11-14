'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const registryMatch = html.match(/const BUSINESS_PROFILES=(\{[\s\S]*?\});\s*function businessKind/);
assert.ok(registryMatch, 'BUSINESS_PROFILES registry must exist before businessKind().');

const profiles = vm.runInNewContext('(' + registryMatch[1] + ')');
const kindMatch = html.match(/function businessKind\(raw=[^\n]*\}/);
assert.ok(kindMatch, 'businessKind() must be present as a single-line resolver.');

const context = { BUSINESS_PROFILES: profiles, store: null, $: () => ({ value: '' }) };
vm.runInNewContext(kindMatch[0] + '; globalThis.__businessKind = businessKind;', context);
const businessKind = context.__businessKind;

const expectedTypes = [
  'beverages',
  'grocery',
  'general_retail',
  'clothing',
  'electronics',
  'hardware',
  'motorcycles',
  'vehicles',
  'restaurant',
  'pharmacy',
  'auto_parts',
  'salon',
  'furniture',
  'stationery',
  'agriculture',
  'livestock',
  'construction',
  'services',
  'other'
];

test('all 19 supported business types have a profile', () => {
  assert.deepEqual(Object.keys(profiles).sort(), [...expectedTypes].sort());
});

test('every business profile has the shared product setup fields', () => {
  for (const type of expectedTypes) {
    const profile = profiles[type];
    assert.equal(typeof profile.label, 'string', type + ': label');
    assert.equal(typeof profile.base, 'string', type + ': base unit');
    assert.equal(typeof profile.pack, 'string', type + ': package name');
    assert.equal(typeof profile.product, 'string', type + ': product label');
    assert.equal(typeof profile.purchase, 'string', type + ': purchase label');
    assert.ok(Number.isFinite(profile.units) && profile.units > 0, type + ': units must be positive');
    assert.ok(profile.detailFields === undefined || Array.isArray(profile.detailFields), type + ': detailFields must be an array when provided');
  }
});

test('stored canonical business_type values resolve to their own profile', () => {
  for (const type of expectedTypes) {
    assert.equal(businessKind(type), type, type + ' must resolve without falling back to other');
  }
});

test('legacy business_type values used by main map to preview profiles', () => {
  assert.equal(businessKind('retail'), 'general_retail');
  assert.equal(businessKind('cars'), 'vehicles');
  assert.equal(businessKind('car'), 'vehicles');
});

test('vehicle profiles retain their identifying fields', () => {
  for (const type of ['motorcycles', 'vehicles']) {
    for (const field of ['brand', 'model', 'year', 'engine_no', 'chassis_no', 'registration']) {
      assert.ok(profiles[type].detailFields.includes(field), type + ': missing ' + field);
    }
  }
});

test('expiry-sensitive profiles expose batch and expiry fields', () => {
  for (const type of ['beverages', 'grocery', 'restaurant', 'pharmacy', 'agriculture', 'livestock']) {
    assert.ok(profiles[type].detailFields.includes('batch_number'), type + ': missing batch_number');
    assert.ok(profiles[type].detailFields.includes('expiry_date'), type + ': missing expiry_date');
  }
});

const workspaceMatch = html.match(/const BUSINESS_WORKSPACES=(\{[\s\S]*?\});\s*function businessKind/);
assert.ok(workspaceMatch, 'BUSINESS_WORKSPACES must exist before businessKind().');
const workspaces = vm.runInNewContext('(' + workspaceMatch[1] + ')');

test('all 19 business types have a dynamic workspace configuration', () => {
  assert.deepEqual(Object.keys(workspaces).sort(), [...expectedTypes].sort());
  for (const type of expectedTypes) {
    assert.equal(typeof workspaces[type].navLabel, 'string', type + ': navigation label');
    assert.equal(typeof workspaces[type].dashboardTitle, 'string', type + ': dashboard title');
    assert.ok(Array.isArray(workspaces[type].modules), type + ': module list');
    assert.ok(workspaces[type].modules.includes('suppliers'), type + ': shared supplier module');
  }
});

test('service and project modules are enabled only for mapped business types', () => {
  assert.ok(workspaces.salon.modules.includes('appointments'));
  assert.ok(workspaces.services.modules.includes('appointments'));
  assert.ok(workspaces.services.modules.includes('jobs'));
  assert.ok(workspaces.electronics.modules.includes('jobs'));
  assert.ok(workspaces.furniture.modules.includes('jobs'));
  assert.ok(workspaces.furniture.modules.includes('projects'));
  assert.ok(workspaces.agriculture.modules.includes('projects'));
  assert.ok(workspaces.construction.modules.includes('jobs'));
  assert.ok(workspaces.construction.modules.includes('projects'));
  assert.ok(!workspaces.grocery.modules.includes('appointments'));
  assert.ok(!workspaces.grocery.modules.includes('projects'));
});

test('dashboard module metrics are present and refreshed by the owner dashboard flow', () => {
  for (const id of ['dashboardCustomerCount', 'dashboardSupplierCount', 'dashboardAppointmentCount', 'dashboardJobCount', 'dashboardProjectCount']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /function applyBusinessWorkspace\(\)/);
  assert.match(html, /async function loadBusinessDashboardModules\(\)/);
  assert.match(html, /await loadBusinessDashboardModules\(\)/);
});
