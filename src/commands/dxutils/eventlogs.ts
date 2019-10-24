import { flags, SfdxCommand } from '@salesforce/command';
import * as path from 'path';
import { downloadFile } from '../../shared/download';

// const messages = core.Messages.loadMessages('@siddharatha/dxutils', 'eventlogs');
// core.Messages.importMessagesDirectory(__dirname);

export default class EventLogs extends SfdxCommand {
  public static description = 'Assign something man';
  public static examples = [
    `$ sfdx dxutils:eventlogs --targetusername myOrg@example.com
        Hello myname
        Calculating packages`,
    `$ sfdx dxutils:eventlogs -u myOrg@example.com -d THIS_WEEK -e LightningPageView
        Hello myname
        Calculating packages ...
        You have 130 metadata types in your org I can scan`
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    dateliteral: flags.string({
      name: 'dateliteral',
      char: 'd',
      description: 'Enter Date'
    }),
    targetdir: flags.string({
      name: 'targetdir',
      char: 't',
      description: 'Enter targetDIR'
    }),
    eventtypes: flags.string({
      name: 'eventtypes',
      char: 'e',
      description: 'Enter EventTypes'
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;
  public async run(): Promise<any> {
    const dateliteral: string = this.flags.dateliteral || 'TODAY';
    const targetdir: string = this.flags.targetdir || path.resolve('./');
    const eventtypes: string = this.flags.eventtypes || 'LightningPageView';
    const conn = this.org.getConnection();

    // Show user who he is
    const userInfo = (await conn.query(
      `select Id,Name from User where username='${conn.getUsername()}'`
    )).records[0];
    this.ux.log(`hello ${userInfo['Name']} - UserId: ${userInfo['Id']}`);

    // get the logs
    const eventlogs = await conn.query(
      `select Id,logfile from EventLogFile where EventType in (${eventtypes
        .split(',')
        .map(
          eachEventType => `'${eachEventType}'`
        )}) and LogDate = ${dateliteral}`
    );
    this.ux.startSpinner('Retrieving Event Log Files');
    Promise.all(
      eventlogs.records.map(eachRecord => {
        const url = `${conn.instanceUrl}/${eachRecord['LogFile']}`;
        return downloadFile(conn.accessToken, url, eachRecord['Id']);
      })
    )
      .then(() => {
        this.ux.stopSpinner('Finished Download');
      })
      .catch(this.ux.error);
    return null;
  }
}
