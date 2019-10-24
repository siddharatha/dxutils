import {resolve as pathResolve} from 'path';
import { fs } from '@salesforce/core';
import { ignoredMetadataTypes, toolingQueryByNameWithNamespace, toolingQueryByDeveloperNameWithNamespace, toolingQueryByDeveloperNameWithoutNamespace } from './config';

export const getMetadataTypesList = async function (fileName:string,conn:any){
    let metadatatypes;

    const mdtTypesJsonFile = pathResolve(fileName);

    let fileExists = true;
    await fs.access(mdtTypesJsonFile, fs.constants.R_OK)
        .catch(err => {
            console.log(`File Error: ${err}`);
            fileExists = false;
        });

    // Enhance the logic to update the available metadata types upon API version change
    if (!fileExists) {
        metadatatypes = await conn.metadata.describe(conn.getApiVersion());
        if (metadatatypes) {
            await fs.writeJson(mdtTypesJsonFile, metadatatypes);
        }
    } else {
        metadatatypes = await fs.readJson(mdtTypesJsonFile, false);
    }

    return metadatatypes;
}

export const getListMetadataAPIProcessingList = async function (metadatatypes:{metadataObjects:[{xmlName:string,childXmlNames:string[]}]}){
    const items = metadatatypes.metadataObjects.map(eachMetadataType => {
        const typearray = [];
        if (eachMetadataType.xmlName !== 'CustomLabels' &&
            eachMetadataType.xmlName !== 'WorkflowTask' &&
            ignoredMetadataTypes.indexOf(eachMetadataType.xmlName) === -1 &&
            !toolingQueryByNameWithNamespace.has(eachMetadataType.xmlName) &&
            !toolingQueryByDeveloperNameWithNamespace.has(eachMetadataType.xmlName) &&
            !toolingQueryByDeveloperNameWithoutNamespace.has(eachMetadataType.xmlName) &&
            !eachMetadataType.xmlName.includes('ManagedTopic')
        ) {
            typearray.push({ type: eachMetadataType.xmlName });
        }

        if (eachMetadataType.hasOwnProperty('childXmlNames')) {
            eachMetadataType.childXmlNames.forEach(eachChildXml => {
                if (ignoredMetadataTypes.indexOf(eachChildXml) === -1 &&
                    !toolingQueryByNameWithNamespace.has(eachChildXml) &&
                    !toolingQueryByDeveloperNameWithNamespace.has(eachChildXml) &&
                    !toolingQueryByDeveloperNameWithoutNamespace.has(eachChildXml)) {
                    typearray.push({ type: eachChildXml });
                }
            });
        }
        return typearray;
    });

    // DO NOT increase the number of items to listMetadataQuery
    const lstitems = []
        .concat(...items)
        .sort((a, b) => (a['type'] > b['type'] ? 1 : -1))
        .reduce((resultArray, item, index) => {
            const chunkIndex = Math.floor(index / 2);
            if (!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = []; // start a new chunk
            }
            resultArray[chunkIndex].push(item);
            return resultArray;
        }, []);

    return lstitems;    
}

export const getPickListChangesFromSetupAuditTrail = async function(conn:any,theMap:{}){
    const auditlogdetail = await conn.query(
        `select Field1,Field4 from SetupAuditTrail where Action like '%picklist%' and CreatedDate=last_n_days:${days}`
    );

    // Iterate through SetupAuditTrail records and prepare of object / field api name (from field label)
    // Field4 - Object Plural label
    // Field1 - Field label
    const theObjectsToFieldList = {};
    auditlogdetail.records.forEach(eachRecord => {
        if (theMap.hasOwnProperty(eachRecord['Field4'])) {
            if (theObjectsToFieldList.hasOwnProperty(eachRecord['Field4']) &&
                theMap.hasOwnProperty(eachRecord['Field4'])) {
                theObjectsToFieldList[theMap[eachRecord['Field4']]].push(
                eachRecord['Field1']
            );
            }
            theObjectsToFieldList[theMap[eachRecord['Field4']]] = [
            eachRecord['Field1']
            ];
        }
    });
    return theObjectsToFieldList;
}