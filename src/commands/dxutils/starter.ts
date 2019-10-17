import { core, flags, SfdxCommand } from '@salesforce/command';
import { fs } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as BlueBirdPromise from 'bluebird';
import * as child_process from 'child_process';

const exec = BlueBirdPromise.promisify(child_process.exec);
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
// Modifying the script for the demo to the team
const messages = core.Messages.loadMessages('@siddharatha/dxutils', 'starter');

export default class Starter extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx dxutils:pull --targetusername myOrg@example.com
  Hello myname
  Calculating packages`,
    `$ sfdx dxutils:pull -u myOrg@example.com -a
  Hello myname
  Calculating packages ...
  You have 130 metadata types in your org I can scan
  `
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    projectname: flags.string({
      name: 'projectname',
      char: 'n',
      description: messages.getMessage('projectNameFlagDescription')
    }),
    autodownload: flags.boolean({
      name: 'autodownload',
      char: 'a',
      description: messages.getMessage('autoDownloadFlagDescription')
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): BlueBirdPromise<AnyJson> {
    const projectname = this.flags.projectname;
    const autodownload: boolean = this.flags.autodownload || false;
    this.ux.log('creating a directory',`${autodownload}`);
    await fs.mkdirp(`./${projectname}`);
    await download('http://github.com/siddharatha/lwc-starter-kit/archive/master.zip', `./${projectname}/lwc-starter.zip`);
  }
}

let download = async function(uri, filename){
    let command = `curl -o ${filename}  '${uri}'`;
    await exec(command);
};
