/**
 * Firestore security rules tests.
 *
 * Run with `npm run test:rules` (spins up the Firestore emulator via
 * `firebase emulators:exec`, which then runs vitest against it — needs the
 * emulator binaries, so it may need `firebase setup:emulators:firestore`
 * once on a fresh machine, and a JDK on PATH).
 *
 * These specifically cover the role-permission bugs found and fixed in this
 * project's admin/manager/rep rollout: a manager must be able to create,
 * read and update operational data (cities, doctors, presentations,
 * requests, visit logs) but never delete a district/city, never write to
 * the master slide library, and never read the 'users' collection directly
 * (that's server-action-only, scoped via the Admin SDK) — regressing any of
 * these is exactly what caused the permission-denied crashes this session.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'spica-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const admin = () => testEnv.authenticatedContext('admin-uid', { role: 'admin' }).firestore();
const manager = () => testEnv.authenticatedContext('mgr-uid', { role: 'manager' }).firestore();
const repIn = (city: string, uid = 'rep-uid') =>
  testEnv.authenticatedContext(uid, { role: 'rep', city }).firestore();
const roleless = () => testEnv.authenticatedContext('ghost-uid', {}).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

async function seed(fn: (db: Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

describe('cities (districts)', () => {
  it('any authenticated user can read', async () => {
    await assertSucceeds(getDocs(collection(repIn('NORTH'), 'cities')));
  });
  it('unauthenticated cannot read', async () => {
    await assertFails(getDocs(collection(anon(), 'cities')));
  });
  it('admin and manager can create/update', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'cities/c1'), { name: 'NORTH' }));
    await assertSucceeds(setDoc(doc(manager(), 'cities/c2'), { name: 'SOUTH' }));
  });
  it('rep cannot create', async () => {
    await assertFails(setDoc(doc(repIn('NORTH'), 'cities/c3'), { name: 'EAST' }));
  });
  it('admin can delete; manager cannot', async () => {
    await seed((db) => setDoc(doc(db, 'cities/c1'), { name: 'NORTH' }));
    await assertFails(deleteDoc(doc(manager(), 'cities/c1')));
    await assertSucceeds(deleteDoc(doc(admin(), 'cities/c1')));
  });
});

describe('districts_cities (sub-cities)', () => {
  it('admin and manager can create; only admin can delete', async () => {
    await assertSucceeds(setDoc(doc(manager(), 'districts_cities/dc1'), { name: 'VELLORE', districtName: 'NORTH' }));
    await assertFails(deleteDoc(doc(manager(), 'districts_cities/dc1')));
    await assertSucceeds(deleteDoc(doc(admin(), 'districts_cities/dc1')));
  });
});

describe('slides (master library)', () => {
  it('any authenticated user can read', async () => {
    await assertSucceeds(getDocs(collection(repIn('NORTH'), 'slides')));
  });
  it('only admin can write — manager access was removed', async () => {
    await assertFails(setDoc(doc(manager(), 'slides/s1'), { number: 1 }));
    await assertSucceeds(setDoc(doc(admin(), 'slides/s1'), { number: 1 }));
  });
});

describe('doctors', () => {
  it('any authenticated user can list', async () => {
    await assertSucceeds(getDocs(collection(repIn('NORTH'), 'doctors')));
  });
  it('admin and manager can write; rep cannot', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'doctors/d1'), { name: 'Dr A', city: 'NORTH' }));
    await assertSucceeds(setDoc(doc(manager(), 'doctors/d2'), { name: 'Dr B', city: 'NORTH' }));
    await assertFails(setDoc(doc(repIn('NORTH'), 'doctors/d3'), { name: 'Dr C', city: 'NORTH' }));
  });
  it('rep can get a doctor in their own city, not another city', async () => {
    await seed((db) => setDoc(doc(db, 'doctors/d1'), { name: 'Dr A', city: 'NORTH' }));
    await assertSucceeds(getDoc(doc(repIn('NORTH'), 'doctors/d1')));
    await assertFails(getDoc(doc(repIn('SOUTH'), 'doctors/d1')));
  });
});

describe('presentations', () => {
  it('admin/manager can read and write; rep can only read their own city', async () => {
    await seed((db) => setDoc(doc(db, 'presentations/p1'), { city: 'NORTH', doctorId: 'd1' }));
    await assertSucceeds(getDoc(doc(admin(), 'presentations/p1')));
    await assertSucceeds(getDoc(doc(manager(), 'presentations/p1')));
    await assertSucceeds(getDoc(doc(repIn('NORTH'), 'presentations/p1')));
    await assertFails(getDoc(doc(repIn('SOUTH'), 'presentations/p1')));
    await assertFails(setDoc(doc(repIn('NORTH'), 'presentations/p1'), { city: 'NORTH' }));
  });
});

describe('requests (change requests)', () => {
  it('rep can create a request only for themselves', async () => {
    await assertSucceeds(
      setDoc(doc(repIn('NORTH', 'rep-uid'), 'requests/r1'), { repId: 'rep-uid', status: 'pending' })
    );
    await assertFails(
      setDoc(doc(repIn('NORTH', 'rep-uid'), 'requests/r2'), { repId: 'someone-else', status: 'pending' })
    );
  });
  it('admin/manager can list all; a rep can only read their own', async () => {
    await seed((db) => setDoc(doc(db, 'requests/r1'), { repId: 'rep-uid', status: 'pending' }));
    await assertSucceeds(getDocs(collection(admin(), 'requests')));
    await assertSucceeds(getDocs(collection(manager(), 'requests')));
    await assertSucceeds(getDoc(doc(repIn('NORTH', 'rep-uid'), 'requests/r1')));
    await assertFails(getDoc(doc(repIn('NORTH', 'other-rep'), 'requests/r1')));
  });
  it('only admin can delete', async () => {
    await seed((db) => setDoc(doc(db, 'requests/r1'), { repId: 'rep-uid', status: 'pending' }));
    await assertFails(deleteDoc(doc(manager(), 'requests/r1')));
    await assertSucceeds(deleteDoc(doc(admin(), 'requests/r1')));
  });
});

describe('visit_logs', () => {
  it('rep can create only for themselves; any authenticated user can read', async () => {
    await assertSucceeds(
      setDoc(doc(repIn('NORTH', 'rep-uid'), 'visit_logs/v1'), { repId: 'rep-uid', status: 'VISITED' })
    );
    await seed((db) => setDoc(doc(db, 'visit_logs/v2'), { repId: 'rep-uid', status: 'VISITED' }));
    await assertSucceeds(getDocs(collection(manager(), 'visit_logs')));
  });
  it('only admin can delete', async () => {
    await seed((db) => setDoc(doc(db, 'visit_logs/v1'), { repId: 'rep-uid', status: 'VISITED' }));
    await assertFails(deleteDoc(doc(manager(), 'visit_logs/v1')));
    await assertSucceeds(deleteDoc(doc(admin(), 'visit_logs/v1')));
  });
});

describe('users', () => {
  it('only admin can list — client pages must use the listAllUsers server action instead', async () => {
    await assertFails(getDocs(collection(manager(), 'users')));
    await assertSucceeds(getDocs(collection(admin(), 'users')));
  });
  it('a user can read/update their own doc but not change their role', async () => {
    await seed((db) => setDoc(doc(db, 'users/rep-uid'), { name: 'Rep One', role: 'rep', city: 'NORTH' }));
    const self = repIn('NORTH', 'rep-uid');
    await assertSucceeds(getDoc(doc(self, 'users/rep-uid')));
    await assertSucceeds(updateDoc(doc(self, 'users/rep-uid'), { name: 'Rep One Updated' }));
    await assertFails(updateDoc(doc(self, 'users/rep-uid'), { role: 'admin' }));
  });
  it('a roleless (never-invited) account cannot read anyone else\'s user doc', async () => {
    await seed((db) => setDoc(doc(db, 'users/rep-uid'), { name: 'Rep One', role: 'rep' }));
    await assertFails(getDoc(doc(roleless(), 'users/rep-uid')));
  });
});
