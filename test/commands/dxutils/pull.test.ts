import { expect, test } from '@salesforce/command/lib/test';
import { ensureJsonMap, ensureString } from '@salesforce/ts-types';

describe('dxutils:pull', () => {
  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(request => {
      const requestMap = ensureJsonMap(request);
      console.log(requestMap);
      if (ensureString(requestMap.url).match(/User/)) {
        return Promise.resolve({
          records: [
            {
              Name: 'Test User',
              Id: '00590000000NXdp'
            }
          ]
        });
      }
      if (ensureString(requestMap.url).match(/metadata/i)) {
        return Promise.resolve({
          records: [
            {
              Name: 'Test User',
              Id: '00590000000NXdp'
            }
          ]
        });
      }
      return Promise.resolve({ records: [] });
    })
    .stdout()
    .command(['dxutils:pull', '--targetusername', 'test@org.com'])
    .it('runs dxutils:pull --targetusername test@org.com', ctx => {
      expect(ctx.stdout).to.contain(`hello Test User`);
    });
});
