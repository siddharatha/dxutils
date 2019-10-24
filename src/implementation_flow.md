# WIP to figure out the best way to manage code 

# Order of Execution
- Collect Input from Flags
- Get User's Changes
  - Prepare Package XML
- Download Metadata
- Pre/Post Process Metadata

# class extends SFDCCommand
- each command extends SFDC Command
- has utilities for User connection, logging , file management.

# Interface contracts
```ts
interface MDType{
    apiname:string,
    label:string,
    lastmodifiedbyId:string,
    lastmodifiedbyName:string
}

```