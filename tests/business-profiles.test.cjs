'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const registryMatch = html.match(/const BUSINESS_PROFILES=(\{[\s\S]*?\});\s*const BUSINESS_WORKSPACES=/);
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

test('customer register is shared across all business workspaces and store-scoped', () => {
  assert.match(html, /data-business-module="customers"/);
  assert.match(html, /el\.dataset\.businessModule!=='customers'/);
  assert.match(html, /db\.from\('customers'\)\.select\('id,full_name,phone,email,address,notes'\)\.eq\('store_id',store\.id\)/);
  assert.match(html, /db\.from\('customers'\)\.insert\(payload\)/);
});

test('business-specific records are queried only when enabled for the selected type', () => {
  assert.match(html, /cfg\.modules\.includes\('appointments'\)\?db\.from\('service_appointments'\)/);
  assert.match(html, /cfg\.modules\.includes\('jobs'\)\?db\.from\('service_jobs'\)/);
  assert.match(html, /cfg\.modules\.includes\('projects'\)\?db\.from\('business_projects'\)/);
});

test('customer editing is owner-guarded and scoped to the active store', () => {
  assert.match(html, /data-edit-customer=/);
  assert.match(html, /requireOperationsOwner\(\);const \{data,error\}=await db\.from\('customers'\)\.select\('id,full_name,phone,email,address,notes'\)\.eq\('store_id',store\.id\)\.eq\('id',btn\.dataset\.editCustomer\)\.maybeSingle\(\)/);
  assert.match(html, /db\.from\('customers'\)\.update\(payload\)\.eq\('id',editingId\)\.eq\('store_id',store\.id\)/);
  assert.match(html, /customerCancelEdit/);
});

test('customer update flow does not introduce a customer delete action', () => {
  assert.doesNotMatch(html, /db\.from\('customers'\)\.delete\(/);
});

test('customer list can be searched locally by name, phone, or email without changing stored rows', () => {
  assert.match(html, /id="customerSearch" type="search"/);
  assert.match(html, /function renderCustomerList\(\)/);
  assert.match(html, /\[x\.full_name,x\.phone,x\.email\]\.some/);
  assert.match(html, /customerSearch'\)\.addEventListener\('input',renderCustomerList\)/);
  assert.match(html, /customerRowsForOperations=cu\.data\|\|\[\];customerOffset=customerRowsForOperations\.length;customerHasMore=customerOffset===CUSTOMER_PAGE_SIZE;renderCustomerList\(\)/);
  assert.doesNotMatch(html, /db\.from\('customers'\)\.delete\(/);
});

test('customer list pagination loads further rows only for the active store and owner', () => {
  assert.match(html, /id="customerLoadMore"/);
  assert.match(html, /id="customerListMeta"/);
  assert.match(html, /const CUSTOMER_PAGE_SIZE=100/);
  assert.match(html, /customerLoadMore'\)\.addEventListener\('click',async\(\)=>\{try\{requireOperationsOwner\(\)/);
  assert.match(html, /db\.from\('customers'\)\.select\('id,full_name,phone,email,address,notes'\)\.eq\('store_id',store\.id\)\.order\('full_name',\{ascending:true\}\)\.range\(from,to\)/);
  assert.match(html, /customerRowsForOperations\.push\(\.\.\.next\.filter/);
  assert.match(html, /customerHasMore=next\.length===CUSTOMER_PAGE_SIZE/);
});

test('supplier editing is owner-guarded and scoped to the active store', () => {
  assert.ok(html.includes('id="supplierId"'));
  assert.ok(html.includes('data-edit-supplier='));
  assert.ok(html.includes('supplierCancelEdit'));
  assert.ok(html.includes("db.from('suppliers').select('id,name,contact_person,phone,email,address,tax_number,notes,is_active').eq('store_id',store.id).eq('id',btn.dataset.editSupplier).maybeSingle()"));
  assert.ok(html.includes("db.from('suppliers').update(payload).eq('id',editingId).eq('store_id',store.id).select('id').maybeSingle()"));
  assert.ok(html.includes("requireOperationsOwner();const editingId=$('supplierId').value"));
});

test('supplier editing does not add a delete action', () => {
  assert.ok(!html.includes("db.from('suppliers').delete("));
});

test('inline application scripts parse without syntax errors', () => {
  const scripts = html.split(/<script[^>]*>/i).slice(1)
    .map(part => part.split('</script>')[0].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0, 'At least one inline application script must exist.');
  scripts.forEach((script, index) => {
    assert.doesNotThrow(() => new vm.Script(script), 'inline script ' + (index + 1));
  });
});
