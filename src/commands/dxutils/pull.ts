import { core, flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject } from '@salesforce/core';
import { fs } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as BlueBirdPromise from 'bluebird';
import * as child_process from 'child_process';
import * as path from 'path';
// import * as vscode from 'vscode';
import {ignoreComponentMap,toolingQueryByDeveloperNameWithNamespace,toolingQueryByDeveloperNameWithoutNamespace,toolingQueryByNameWithNamespace} from '../../shared/config';
import { getMetadataTypesList, getListMetadataAPIProcessingList, getPickListChangesFromSetupAuditTrail, getObjectListFromToolingAPI } from '../../shared/metadata';

const exec = BlueBirdPromise.promisify(child_process.exec);
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('@siddharatha/dxutils', 'pull');

// Array of metadata types that will be ignored while performing listMetadataQuery operation
// Enhance to read this configuration from Workspace / User Settings using vscode module
// (consider removing as required)


// const toolingQueryByDeveloperNameWithoutNamespace: string[] = ['LiveChatButton', 'OauthCustomScope',
//     'PresenceDeclineReason', 'PresenceUserConfig', 'ServiceChannel', 'ServicePresenceStatus',
//     'Skill'];

// Id, Name
// WithNamespace
//
// WithoutNamespace
//  Network, AssignmentRule, Profile

// Id, DeveloperName
// WithoutNamespace -
    //  Skill, ServiceChannel, ServicePresenceStatus, PresenceDeclineReason, PresenceUserConfig
    //  OauthCustomScope, LiveChatButton
// WithNamespace

// Special Processing
//  PermissionSet
//  CustomLabel
//  RecordType
//  CustomField

const QRY_NAME: string = 'SELECT Id, Name FROM ';
const QRY_DEVNAME: string = 'SELECT Id, DeveloperName FROM ';
const QRY_WHERE: string = ' WHERE ';
const QRY_NAMESPACE: string = ' NamespacePrefix = \'\' ';
const QRY_AND: string = ' AND ';
const QRY_LASTMODDATE: string = ' LastModifiedDate = Last_N_Days:';
const QRY_LASTMODID: string = ' LastModifiedById = ';


export default class Pull extends SfdxCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx dxutils:pull --targetusername myOrg@example.com
        Hello myname
        Calculating packages`,
        `$ sfdx dxutils:pull -u myOrg@example.com -a
        Hello myname
        Calculating packages ...
        You have 130 metadata types in your org I can scan`
    ];

    protected static flagsConfig = {
        // flag with a value (-n, --name=VALUE)
        days: flags.integer({
            name: 'days',
            char: 'd',
            description: messages.getMessage('daysFlagDescription')
        }),
        autodownload: flags.boolean({
            name: 'autodownload',
            char: 'a',
            description: messages.getMessage('autoDownloadFlagDescription')
        }),
        autoclean: flags.boolean({
            name: 'autoclean',
            char: 'c',
            description: messages.getMessage('autocleanFlagDescription')
        })
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    // protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run(): Promise<AnyJson> {
        const days = this.flags.days || 30;
        const autodownload: boolean = this.flags.autodownload || false;
        const autoclean: boolean = this.flags.autoclean || false;
        const dxproject = await SfdxProject.resolve();
        const prjfolderpath = dxproject.getPath();
        const projectJson = await dxproject.resolveProjectConfig();
        const projectroot = projectJson.packageDirectories[0].path;
        const cleanCommand = `sh ${path.resolve(prjfolderpath + '/scripts/compressAll.sh')} "${projectroot}"`;

        this.ux.log(`Flags: Num-days:${days}, Download: ${autodownload}, Clean: ${autoclean}`);
        this.ux.log(`Project folder: ${prjfolderpath}`);
        this.ux.log (`Project root: ${projectroot}`);

        // Read configuration from settings (User or Workspace)
        // const dxutilsConfig = vscode.workspace.getConfiguration('dxUtils');
        // const currentValue = dxutilsConfig.get('dxUtils.ignoreTypes', {});

        // const types = this.flags.types || null;
        // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername

        const conn = this.org.getConnection();
        const userInfo = (await conn.query(
            `select Id,Name from User where username='${conn.getUsername()}'`
        )).records[0];
        this.ux.log(`hello ${userInfo['Name']} - UserId: ${userInfo['Id']}`);

        // #region PREPARE
        this.ux.startSpinner(
            'Retrieving metadata coverage of the org for calculating changes ..'
        );
        console.time('Retrieving metadata coverage...');

        this.ux.cli.url(
            'Learn about metadata types and coverage',
            'https://developer.salesforce.com/docs/metadata-coverage'
        );

        const theMap = {};
        const mychanges: Map<string, string[]> = new Map<string, string[]>();
        mychanges['CustomObject'] = [];
        await getObjectListFromToolingAPI(conn,theMap,mychanges,userInfo['Id'],days);
        
        
        const metadatatypes = await getMetadataTypesList('./mdtTypes.json',conn);
        const lstitems = await getListMetadataAPIProcessingList(metadatatypes);
        
        this.ux.stopSpinner(`We will be retrieving components of ${lstitems.length * 2} metadata types from your org`);
        console.timeEnd('Retrieving metadata coverage...');

        this.ux.startSpinner('Generating object list...');
        console.time('Global describe...');

        // Instead of performing globalDescribe, below work-around has been applied
        // In a complex org with lot of metadata (over 1500 custom objects), globalDescribe
        // operation is taking a lot of time and sometimes peaking at 600K ms
        // const entityCountInfo = (await conn.query("SELECT count() FROM EntityDefinition WHERE (NOT DeveloperName LIKE '%__Tag') AND (NOT DeveloperName LIKE '%__ChangeEvent') AND (NOT DeveloperName LIKE '%__Share') AND (NOT DeveloperName LIKE '%__History') AND (NOT DeveloperName LIKE '%__Feed')")).totalSize;
        
        console.timeEnd('Global describe...');
        this.ux.stopSpinner('describing completed');
        this.ux.log(`My object changes ${JSON.stringify(mychanges)}`);
        // #endregion

        // #region PROCESS
        console.time('Getting Picklist Changes');
        const theObjectsToFieldList = await getPickListChangesFromSetupAuditTrail(conn,theMap,days);
        // Querying for picklist value changes from SetupAuditTrail as the same is not
        // available in metadata api or tooling api
        this.ux.log('Querying for picklist changes...');
        

        const processResult = (queryType: string, queryResult, propertyName: string) => {
            if (queryResult != null) {
                queryResult.records.forEach(eachItem => {
                    mychanges[queryType].push(eachItem[propertyName]);
                });
            }
        };

        const processMetadata = (queryType: string, query: string, propertyName: string) => {
            if (!mychanges.has(queryType)) {
                mychanges[queryType] = [];
            }
            return conn.query(query)
                .then(result => {
                    processResult(queryType, result, propertyName);
                });
        };

        const getDescribe = async objectName => {
            return await conn
                .sobject(objectName)
                .describe()
                .then(eachRes => {
                return eachRes.fields
                    .filter(eachField => {
                    return theObjectsToFieldList[objectName].includes(
                        eachField.label
                    );
                    })
                    .map(eachField => `${objectName}.${eachField.name}`);
                });
        };

        this.ux.log(`Identified changes in picklists: ${JSON.stringify(theObjectsToFieldList)}`);

        const objects = Object.keys(theObjectsToFieldList);
        const picklists = [].concat(await BlueBirdPromise.all(objects.map(getDescribe)));
        console.timeEnd('Getting Picklist Changes');

        console.time('Identify your changes');
        this.ux.startSpinner(
            'Retrieving metadata - list information for calculating changes, should take about 3 minutes .. Hang on tight'
        );

        // DO NOT:
        //  increase the number of items to listMetadataQuery
        //  increase the degree of parallelization. Increasing the parallelization of
        //  listMetadataQuery (assuming multiple developers are using same non source tracking org)
        //  causes increased failures of metadata operations given the size of org having huge metadata
        await BlueBirdPromise.map(
            Object.keys(toolingQueryByNameWithNamespace),
            eachKey => {
                const qry = `${QRY_NAME} ${toolingQueryByNameWithNamespace[eachKey]} ${QRY_WHERE} ${QRY_NAMESPACE}${QRY_AND}${QRY_LASTMODDATE}${days} ${QRY_AND}${QRY_LASTMODID}'${userInfo['Id']}'`;
                return processMetadata(eachKey, qry, 'Name');
            },
            { concurrency: 2 }
        );

        await BlueBirdPromise.map(
            Object.keys(toolingQueryByDeveloperNameWithNamespace),
            eachKey => {
                const qry = `${QRY_DEVNAME} ${toolingQueryByDeveloperNameWithNamespace[eachKey]} ${QRY_WHERE} ${QRY_NAMESPACE}${QRY_AND}${QRY_LASTMODDATE}${days} ${QRY_AND} ${QRY_LASTMODID}'${userInfo['Id']}'`;
                return processMetadata(eachKey, qry, 'DeveloperName');
            },
            { concurrency: 2 }
        );
        await BlueBirdPromise.map(
            Object.keys(toolingQueryByDeveloperNameWithoutNamespace),
            eachKey => {
                const qry = `${QRY_DEVNAME} ${eachKey} ${QRY_WHERE} ${QRY_LASTMODDATE}${days} ${QRY_AND} ${QRY_LASTMODID}'${userInfo['Id']}'`;
                return processMetadata(eachKey, qry, 'DeveloperName');
            },
            { concurrency: 2 }
        );

        console.time('Listing metadata changes for identified metadata types...');
        const allresults = await BlueBirdPromise.map(
            lstitems,
            eachitem => {
                console.time(`Retrieved metadata list for types ${JSON.stringify(eachitem)}`);
                return conn.metadata
                .list(eachitem, conn.getApiVersion())
                    .then(res => {
                        console.timeEnd(`Retrieved metadata list for types ${JSON.stringify(eachitem)}`);
                        return res;
                    })
                .catch(() => {});
            },
            { concurrency: 2 }
        );
        console.timeEnd('Listing metadata changes for identified metadata types...');

        const allres = [].concat(...allresults).filter(eachResult => {
            if (eachResult && eachResult.hasOwnProperty('lastModifiedDate')) {
                const diffindays = moment().diff(
                    moment(eachResult.lastModifiedDate),
                    'days');

                return (
                    diffindays <= days &&
                    (eachResult.lastModifiedById === userInfo['Id'] ||
                        eachResult.createdById === userInfo['Id'])
                    );
            }
            return false;
        });

        if (allres) {
            allres.forEach(eachItem => {
                if (mychanges.hasOwnProperty(eachItem.type)) {
                    mychanges[eachItem.type].push(eachItem.fullName);
                } else mychanges[eachItem.type] = [eachItem.fullName];
            });
            if(!mychanges.hasOwnProperty('CustomField'))
            mychanges['CustomField'] = [];
            
            mychanges['CustomField'].push(...picklists);
            this.ux.stopSpinner('That took a while, but we managed to collect info');

            let packagexmlstring = `<?xml version="1.0" encoding="UTF-8"?>\n
                    <Package xmlns="http://soap.sforce.com/2006/04/metadata">\n
                    <version>${conn.getApiVersion()}</version>`;

            packagexmlstring += Object.keys(mychanges)
                .map(eachKey => {
                    let thestring = '';
                    if (mychanges[eachKey].length > 0) {
                        thestring = ` <types>\n\t<name>${eachKey}</name>`;
                        mychanges[eachKey].forEach(eachItem => {
                            const decodedItem = decodeURI(eachItem);
                            const skipItem = (ignoreComponentMap.has(eachKey) && ignoreComponentMap.get(eachKey).indexOf(decodedItem) > -1);
                            if (!skipItem) {
                                thestring += `    <members>${eachItem}</members>\n`;
                            }
                        });
                        thestring += '  </types>\n';
                    }
                    return thestring;
            })
            .join('');
            packagexmlstring += '</Package>';

            console.timeEnd('Identify your changes');
            // const allresults = await BlueBirdPromise.all(lstitems.map(eacharray=>conn.metadata.list(eacharray)));
            await fs.writeFile(
                path.resolve('./package.xml'),
                packagexmlstring,
                'utf8'
            );

            this.ux.log('Generated package xml');

        // #endregion

        // #region EXECUTE
            console.time('Retrieving your changes');
            if (autodownload) {
                this.ux.startSpinner(
                    "you opted for autodownload, so i'm Downloading the changes"
                );

                let retrieveCommand = '';
                this.ux.log(
                    'You are in project mode, will keep the files in your project folder'
                );
                retrieveCommand = `sfdx force:source:retrieve -x ${path.resolve('./package.xml')} -w 30 -u ${this.org.getUsername()} --json`;

                // this.ux.log(`Clean command: ${cleanCommand}`);
                try {
                    await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
                    this.ux.stopSpinner('Done downloading source files');
                    if (autoclean) {
                        await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                    }
                    console.timeEnd('Retrieving your changes');
                    return 'successfully retrieved files';
                } catch (e) {
                    try {
                        await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
                        this.ux.stopSpinner('Done downloading source files');
                        if (autoclean) {
                            await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                        }
                        console.timeEnd('Retrieving your changes');
                        return 'successfully retrieved files ';
                    } catch (e2) {
                        this.ux.stopSpinner('Done downloading source files');
                        if (autoclean) {
                            await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                        }
                        console.timeEnd('Retrieving your changes');
                        return 'successfully retrieved files';
                    }
                }
            } else {
                this.ux.log('Your packagexml awaits');
            }

        // #endregion
        }
    }
}
