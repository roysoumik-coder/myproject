const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeHtml, validateStudent } = require('../index');

test('validateStudent accepts a complete student record', () => {
  const form = new URLSearchParams({
    name: 'Priya Sen',
    email: 'PRIYA.SEN@example.com',
    course: 'DevSecOps',
    year: '3rd Year',
    status: 'Active',
  });

  const result = validateStudent(form);

  assert.deepEqual(result.errors, []);
  assert.equal(result.student.email, 'priya.sen@example.com');
});

test('validateStudent rejects invalid values', () => {
  const form = new URLSearchParams({
    name: 'A',
    email: 'not-an-email',
    course: '',
    year: '5th Year',
    status: 'Unknown',
  });

  const result = validateStudent(form);

  assert.equal(result.errors.length, 5);
});

test('escapeHtml encodes unsafe characters', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
