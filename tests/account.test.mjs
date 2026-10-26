import test from 'node:test';
import assert from 'node:assert/strict';
import {
  usernameFromUser,
  usernameFromLogin,
  validateLogin,
  validateRegistration,
  validateNewPassword,
} from '../src/lib/account.ts';

test('usernameFromUser prefers the metadata username', () => {
  assert.equal(usernameFromUser({ email: 'lucia@vc.test', user_metadata: { username: 'Lucia69' } }), 'Lucia69');
});

test('usernameFromUser falls back to the e-mail local part, then to an empty string', () => {
  assert.equal(usernameFromUser({ email: 'lucia@vc.test', user_metadata: {} }), 'lucia');
  assert.equal(usernameFromUser({ email: 'lucia@vc.test', user_metadata: null }), 'lucia');
  assert.equal(usernameFromUser({ user_metadata: {} }), '');
  assert.equal(usernameFromUser(null), '');
  assert.equal(usernameFromUser(undefined), '');
});

test('usernameFromLogin uses the typed e-mail, not the account e-mail', () => {
  assert.equal(usernameFromLogin({ user_metadata: { username: 'Jason' } }, 'x@y.z'), 'Jason');
  assert.equal(usernameFromLogin({ email: 'other@y.z', user_metadata: {} }, 'typed@y.z'), 'typed');
  assert.equal(usernameFromLogin(null, 'typed@y.z'), 'typed');
});

test('validateLogin needs both fields', () => {
  assert.equal(validateLogin('', 'pw'), 'Enter email and password.');
  assert.equal(validateLogin('a@b.c', ''), 'Enter email and password.');
  assert.equal(validateLogin('a@b.c', 'pw'), null);
});

test('validateRegistration checks presence, then length, then confirmation (in that order)', () => {
  assert.equal(validateRegistration('', 'a@b.c', 'secret1', 'secret1'), 'All fields required.');
  assert.equal(validateRegistration('Lu', '', 'secret1', 'secret1'), 'All fields required.');
  assert.equal(validateRegistration('Lu', 'a@b.c', '', ''), 'All fields required.');
  // too short AND mismatched: the length message wins
  assert.equal(validateRegistration('Lu', 'a@b.c', '12345', 'nope'), 'Password must be at least 6 characters.');
  assert.equal(validateRegistration('Lu', 'a@b.c', 'secret1', 'secret2'), 'Passwords do not match.');
  assert.equal(validateRegistration('Lu', 'a@b.c', '123456', '123456'), null);
});

test('validateNewPassword: empty or short is a length error, mismatch is separate', () => {
  assert.equal(validateNewPassword('', ''), 'Password must be at least 6 characters.');
  assert.equal(validateNewPassword('12345', '12345'), 'Password must be at least 6 characters.');
  assert.equal(validateNewPassword('123456', '1234567'), 'Passwords do not match.');
  assert.equal(validateNewPassword('123456', '123456'), null);
});
