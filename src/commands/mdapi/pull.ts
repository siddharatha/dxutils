import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { fs } from "@salesforce/core";
import child_process = require("child_process");
import * as Promise from "bluebird";
import * as moment from "moment";

const exec = Promise.promisify(child_process.exec);
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("dxutils", "pull");

export default class Pull extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx mdapi:pull --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
    `$ sfdx mdapi:pull --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    days: flags.integer({
      name: "days",
      char: "d",
      description: messages.getMessage("daysFlagDescription")
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
    // const types = this.flags.types || null;
    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const conn = this.org.getConnection();
    const userInfo = (await conn.query(
      `select Id,Name from User where username='${conn.getUsername()}'`
    )).records[0];
    this.ux.log(`hello ${userInfo["Name"]}`);
    this.ux.startSpinner("Calculating Packages");
    const items = (await conn.metadata.describe(
      conn.getApiVersion()
    )).metadataObjects.map(eachMetadataType => {
      let typearray = [];
      if (
        eachMetadataType.xmlName !== "CustomLabels" &&
        eachMetadataType.xmlName !== "WorkflowTask" &&
        !eachMetadataType.xmlName.includes("ManagedTopic")
      )
        typearray.push({ type: eachMetadataType.xmlName });
      if (eachMetadataType.hasOwnProperty("childXmlNames")) {
        eachMetadataType.childXmlNames.forEach(eachChildXml => {
          typearray.push({ type: eachChildXml });
        });
      }
      return typearray;
    });
    this.ux.stopSpinner(`Your org has ${items.length} metadata types
    Learn about metadata types here : https://developer.salesforce.com/docs/metadata-coverage
    `);
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
      "Calculating changes in your sandbox, should take about 3 minutes .. Hang on"
    );
    const allresults = await Promise.map(
      lstitems,
      eachitem => {
        return conn.metadata
          .list(eachitem, conn.getApiVersion())
          .then(res => {
            return res;
          })
          .catch(er => {});
      },
      { concurrency: 60 }
    );
    let mychanges = {};
    const allres = [].concat(...allresults).filter(eachResult => {
      if (eachResult && eachResult.hasOwnProperty("lastModifiedDate")) {
        const diffindays = moment().diff(
          moment(eachResult.lastModifiedDate),
          "days"
        );
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
      this.ux.stopSpinner("That took a while, but we managed to collect info");

      let packagexmlstring = `<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
      <version>${conn.getApiVersion()}</version>
    `;
      packagexmlstring += Object.keys(mychanges)
        .map(eachKey => {
          let thestring = ` <types>
        <name>${eachKey}</name>      
      `;
          mychanges[eachKey].forEach(eachItem => {
            thestring += `    <members>${eachItem}</members>\n`;
          });
          thestring += `  </types>\n`;
          return thestring;
        })
        .join("");
      packagexmlstring += "</Package>";
      // const allresults = await Promise.all(lstitems.map(eacharray=>conn.metadata.list(eacharray)));
      fs.writeFile("./package.xml", packagexmlstring, "utf8");
      this.ux.log("Generated package xml");
      const downloadconfirm = this.ux.confirm(
        "Would you like me to download the files generated ? If you prefer to make changes to the xml let me know"
      );
      if (downloadconfirm) {
        const retrieveCommand = `sfdx force:source:retrieve -x ./package.xml -w 30 -u ${this.org.getUsername()} --json`;
        try {
          await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
          return `successfully retrieved files`;
        } catch (e) {
          try {
            await exec(retrieveCommand, { maxBuffer: 1000000 * 1024 });
            return `successfully retrieved files `;
          } catch (e2) {
            return `successfully retrieved files`;
          }
        }
      } else {
        this.ux.log("Your packagexml awaits");
      }
    }
  }
}
