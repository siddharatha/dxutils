import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson} from '@salesforce/ts-types';
import { fs } from '@salesforce/core';
import * as Promise from 'bluebird';
import * as moment from 'moment';
// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('dxutils', 'org');

export default class Org extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx dxutils:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
  `$ sfdx dxutils:org --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: messages.getMessage('nameFlagDescription')}),
    force: flags.boolean({char: 'f', description: messages.getMessage('forceFlagDescription')}),
    days: flags.integer({char:'d',description:messages.getMessage('daysFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  // protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    const name = this.flags.name || 'world';
    const days = this.flags.days || 30;
    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const conn = this.org.getConnection();    
    const userInfo = (await conn.query(`select Id,Name from User where username='${conn.getUsername()}'`)).records[0];
    const items = (await conn.metadata.describe(conn.getApiVersion())).metadataObjects.map(eachMetadataType=>{      
      let typearray = [];
      if(eachMetadataType.xmlName!=='CustomLabels' && eachMetadataType.xmlName!=='WorkflowTask')
      typearray.push({type:eachMetadataType.xmlName});
      if(eachMetadataType.hasOwnProperty('childXmlNames')){        
        eachMetadataType.childXmlNames.forEach(eachChildXml=>{
          typearray.push({type:eachChildXml});
        }) 
      }
      return typearray;
    })
    const lstitems = [].concat(...items).sort((a, b) => (a['type'] > b['type']) ? 1 : -1).reduce((resultArray,item,index)=>{
      const chunkIndex = Math.floor(index/3);
    if(!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }
    resultArray[chunkIndex].push(item)    
    return resultArray
    },[]);
    fs.writeFile('./packagetypes.json',JSON.stringify(lstitems,null,2),'utf8');
    this.ux.log(lstitems.length);
    // const lstitems2 = [lstitems[0],lstitems[1]]
    //,lstitems[2],lstitems[3],lstitems[4],lstitems[5]];
    
    const allresultsp1 = await Promise.map(lstitems.slice(0,20),eachitem=>{      
      return conn.metadata.list(eachitem,conn.getApiVersion())
    },{concurrency:1});
    const allresultsp2 = await Promise.map(lstitems.slice(20,40),eachitem=>{      
      return conn.metadata.list(eachitem,conn.getApiVersion())
    },{concurrency:1});
    const allresultsp3 = await Promise.map(lstitems.slice(40),eachitem=>{      
      return conn.metadata.list(eachitem,conn.getApiVersion())
    },{concurrency:1});
    
    let mychanges = {};
    const allres = [].concat(...allresultsp1,...allresultsp2,...allresultsp3).filter(eachResult=>{
      if(eachResult && eachResult.hasOwnProperty('lastModifiedDate')){      
      const diffindays = moment().diff(moment(eachResult.lastModifiedDate),'days');
      return diffindays <= days && (eachResult.lastModifiedById === userInfo['Id'] || eachResult.createdById === userInfo['Id'])
      }
      return false;
    });
    if(allres)
    {
    allres.forEach(eachItem=>{
      if(mychanges.hasOwnProperty(eachItem.type)){
        mychanges[eachItem.type].push(eachItem.fullName);
      }
      else
        mychanges[eachItem.type] = [eachItem.fullName];
    })

    let packagexmlstring = `<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
      <version>${conn.getApiVersion()}</version>
    `;    
    packagexmlstring+=Object.keys(mychanges).map(eachKey=>{
      let thestring = `<types>
      <name>${eachKey}</name>      
      `;
      mychanges[eachKey].forEach(eachItem=>{
        thestring+=`<members>${eachItem}</members>\n`
      });
      thestring+=`</types>\n`;
      return thestring;
    }).join('');
    packagexmlstring+='</Package>';
    // const allresults = await Promise.all(lstitems.map(eacharray=>conn.metadata.list(eacharray)));    
    fs.writeFile('./package.xml',packagexmlstring,'utf8');
    this.ux.log('Just generated package xml');
    this.ux.log(packagexmlstring);        
  }
  }
  
}
