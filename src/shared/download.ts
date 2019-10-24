import fs = require('fs');
import path = require('path');
import { get as requestGet } from 'request';

export const downloadFile = (
  token: string,
  url: string,
  id: string,
  targetdir: string
) => {
  return new Promise((resolve, reject) => {
    requestGet(url)
      .auth(null, null, true, token)
      .pipe(fs.createWriteStream(path.resolve(`${targetdir}/${id}.csv`)))
      .on('finish', () => {
        console.log('Finished processing ' + id);
        resolve();
      });
  });
};
