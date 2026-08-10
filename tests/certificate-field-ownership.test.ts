import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const certificates = readFileSync('src/server/certificates.ts', 'utf8');

describe('certificate field mutation ownership', () => {
  it('checks job ownership before updateField reaches the service-role write', () => {
    const action = certificates.slice(
      certificates.indexOf('export async function updateField'),
      certificates.indexOf('const optionalText'),
    );

    expect(action).toMatch(/\.from\('jobs'\)[\s\S]*\.eq\('id', input\.jobId\)[\s\S]*\.eq\('user_id', user\.id\)/);
    expect(action.indexOf(".eq('user_id', user.id)")).toBeLessThan(
      action.indexOf('supabaseServerServiceRole()'),
    );
    expect(action).toMatch(/if \(!ownedJob\) throw new Error\('Unauthorized'\)/);
  });

  it('scopes saved boiler-service clients and properties to the current engineer', () => {
    const action = certificates.slice(
      certificates.indexOf('export async function saveBoilerServiceJobInfo'),
      certificates.indexOf('export async function saveBoilerServiceDetails'),
    );

    expect(action).toMatch(/getCustomerById\(linkedClientId, \{ sb, userId: user\.id, requireOwner: true \}\)/);
    expect(action).toMatch(/\.from\('properties'\)[\s\S]*\.eq\('id', linkedPropertyId\)[\s\S]*\.eq\('user_id', user\.id\)/);
    expect(action).toMatch(/\.eq\('id', jobId\)[\s\S]*\.eq\('user_id', user\.id\)/);
  });
});
