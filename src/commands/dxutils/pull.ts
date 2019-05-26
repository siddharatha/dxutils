import { core, flags, SfdxCommand } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";
import { fs } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import * as Promise from "bluebird";
import * as child_process from "child_process";
import * as moment from "moment";
import * as path from "path";

const exec = Promise.promisify(child_process.exec);
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("@siddharatha/dxutils", "pull");

export default class Pull extends SfdxCommand {
    public static description = messages.getMessage("commandDescription");

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
            name: "days",
            char: "d",
            description: messages.getMessage("daysFlagDescription")
        }),
        autodownload: flags.boolean({
            name: "autodownload",
            char: "a",
            description: messages.getMessage("autoDownloadFlagDescription")
        }),
        autoclean: flags.boolean({
            name: "autoclean",
            char: "c",
            description: messages.getMessage("autocleanFlagDescription")
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
        const prjfolderpath = await dxproject.getPath();
        const projectJson = await dxproject.resolveProjectConfig();
        const projectroot = projectJson.packageDirectories[0].path;
        const cleanCommand = `sh ${path.resolve(prjfolderpath + "/scripts/compressAll.sh")} "${projectroot}"`;

        this.ux.log(`Flags: Num-days:${days}, Download: ${autodownload}, Clean: ${autoclean}`);
        this.ux.log(`Project folder: ${prjfolderpath}`);
        this.ux.log (`Project root: ${projectroot}`);

        // const types = this.flags.types || null;
        // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
        const conn = this.org.getConnection();
        const userInfo = (await conn.query(
            `select Id,Name from User where username='${conn.getUsername()}'`
        )).records[0];

        this.ux.log(`hello ${userInfo["Name"]}`);
        console.time("Get Picklist Changes");

        // Querying for picklist value changes from SetupAuditTrail
        // TODO: Determine and optimize to perform
        // 1. query via background thread every 30 seconds
        // 2. cache the results in a map
        const auditlogdetail = await conn.query(
            `select Field1,Field4 from SetupAuditTrail where Action like '%picklist%' and CreatedDate=last_n_days:${days}`
        );

        // Creating a map of object(s)
        // TODO: Determine and optimize to perform
        // 1. describe via background thread every 30 seconds
        // 2. cache the results in a map to be re-used
        const theMap = {};
        (await conn.describeGlobal()).sobjects
        .filter(
            eachSobject => !(
                eachSobject.name.endsWith("__Tag") ||
                eachSobject.name.endsWith("__History") ||
                eachSobject.name.endsWith("__Feed") ||
                eachSobject.name.endsWith("__ChangeEvent") ||
                eachSobject.name.endsWith("__Share")
            )
        )
        .forEach(eachObject => {
            theMap[eachObject.labelPlural] = eachObject.name;
        });

        // Iterate through SetupAuditTrail records and prepare of object / field api name (from field label)
        const theObjectsToFieldList = {};
        auditlogdetail.records.forEach(eachRecord => {
            if (theMap.hasOwnProperty(eachRecord["Field4"])) {
                if (theObjectsToFieldList.hasOwnProperty(eachRecord["Field4"])) {
                theObjectsToFieldList[theMap[eachRecord["Field4"]]].push(
                    eachRecord["Field1"]
                );
                }
                theObjectsToFieldList[theMap[eachRecord["Field4"]]] = [
                eachRecord["Field1"]
                ];
            }
        });

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

        const objects = Object.keys(theObjectsToFieldList);
        const picklists = [].concat(await Promise.all(objects.map(getDescribe)));
        console.timeEnd("Get Picklist Changes");

        // Identify all metadata types supported in the Org
        // NOTE: Supported types would vary based on features active on the org (e.g., Knowledge)
        console.time("Identify your changes");
        const metadatatypes = await conn.metadata.describe(conn.getApiVersion());
        const items = metadatatypes.metadataObjects.map(eachMetadataType => {
            const typearray = [];
            if (eachMetadataType.xmlName !== "CustomLabels" &&
                eachMetadataType.xmlName !== "WorkflowTask" &&
                !eachMetadataType.xmlName.includes("ManagedTopic")
            ) {
                typearray.push({ type: eachMetadataType.xmlName });
            }

            if (eachMetadataType.hasOwnProperty("childXmlNames")) {
                eachMetadataType.childXmlNames.forEach(eachChildXml => {

                    typearray.push({ type: eachChildXml });
                });
            }
            return typearray;
        });

        this.ux.stopSpinner(`Your org has ${items.length} metadata types`);
        this.ux.cli.url(
            "Learn about metadata types and coverage",
            "https://developer.salesforce.com/docs/metadata-coverage"
        );
        const lstitems = []
            .concat(...items)
            .sort((a, b) => (a["type"] > b["type"] ? 1 : -1))
            .reduce((resultArray, item, index) => {
                const chunkIndex = Math.floor(index / 3);
                if (!resultArray[chunkIndex]) {
                    resultArray[chunkIndex] = []; // start a new chunk
                }
                resultArray[chunkIndex].push(item);
                return resultArray;
            }, []);

        this.ux.startSpinner(
            "Retrieving metadata - list information for calculating changes .."
        );

        const allresults = await Promise.map(
            lstitems,
            eachitem => {
                this.ux.log (`Retrieving metadata for: ${JSON.stringify(eachitem)}`);
                return conn.metadata
                .list(eachitem, conn.getApiVersion())
                .then(res => {
                    return res;
                })
                .catch(er => {});
            },
            { concurrency: 60 }
        );

        this.ux.startSpinner(
            "Calculating changes in your sandbox, should take about 3 minutes .. Hang on"
        );

        const mychanges = {};
        const allres = [].concat(...allresults).filter(eachResult => {
            this.ux.log(`Checking changes for ${eachResult.fileName}`);
            if (eachResult && eachResult.hasOwnProperty("lastModifiedDate")) {
                const diffindays = moment().diff(
                    moment(eachResult.lastModifiedDate),
                    "days");

                return (
                    diffindays <= days &&
                    (eachResult.lastModifiedById === userInfo["Id"] ||
                        eachResult.createdById === userInfo["Id"])
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

            mychanges["CustomField"].push(...picklists);
            this.ux.stopSpinner("That took a while, but we managed to collect info");

            let packagexmlstring = `<?xml version="1.0" encoding="UTF-8"?>\n
                    <Package xmlns="http://soap.sforce.com/2006/04/metadata">\n
                    <version>${conn.getApiVersion()}</version>`;

            packagexmlstring += Object.keys(mychanges)
                .map(eachKey => {
                    let thestring = ` <types>\n\t<name>${eachKey}</name>`;
                    mychanges[eachKey].forEach(eachItem => {
                        thestring += `    <members>${eachItem}</members>\n`;
                    });
                    thestring += "  </types>\n";
                    return thestring;
            })
            .join("");
            packagexmlstring += "</Package>";

            console.timeEnd("Identify your changes");
            // const allresults = await Promise.all(lstitems.map(eacharray=>conn.metadata.list(eacharray)));
            await fs.writeFile(
                path.resolve(`./package.xml`),
                packagexmlstring,
                "utf8"
            );

            this.ux.log("Generated package xml");
            console.time("Retrieving your changes");
            if (autodownload) {
                this.ux.startSpinner(
                    "you opted for autodownload, so i'm Downloading the changes"
                );

                let retrieveCommand = "";
                this.ux.log(
                    "You are in project mode, will keep the files in your project folder"
                );
                retrieveCommand = `sfdx force:source:retrieve -x ${path.resolve("./package.xml")} -w 30 -u ${this.org.getUsername()} --json`;

                this.ux.log(`Clean command: ${cleanCommand}`);
                try {
                    await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
                    this.ux.stopSpinner("Done downloading source files");
                    if (autoclean) {
                        await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                    }
                    console.timeEnd("Retrieving your changes");
                    return "successfully retrieved files";
                } catch (e) {
                    try {
                        await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
                        this.ux.stopSpinner("Done downloading source files");
                        if (autoclean)
                            await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                        console.timeEnd("Retrieving your changes");
                        return "successfully retrieved files ";
                    } catch (e2) {
                        this.ux.stopSpinner("Done downloading source files");
                        if (autoclean)
                            await exec(cleanCommand, { maxBuffer: 1000000 * 1024 });
                        console.timeEnd("Retrieving your changes");
                        return "successfully retrieved files";
                    }
                }
            } else {
                this.ux.log("Your packagexml awaits");
            }
        }
    }
}
