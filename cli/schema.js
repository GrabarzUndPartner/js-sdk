"use strict";
const fs = require('fs');
const account = require('./account');
const path = require('path');
const helper = require('./helper');

const filepath = './baqend/schema/';

module.exports = function(args) {
  return account.login(args).then((db) => {
    if (!fs.existsSync(filepath)){
      createDir(filepath)
    }
    switch(args.command) {
      case 'upload':
        return uploadSchema(db, args).then((deployed) => {
          console.log("---------------------------------------")
          if (deployed) {
            console.log("The schema was successfully " + (args.force && "replaced" || "updated") )
          } else {
            console.log("The schema update was aborted")
          }
        });
      case 'download':
        return downloadSchema(db, args).then(() => {
          console.log("---------------------------------------")
          console.log("Your schema was successfully downloaded")
        });
      default:
        throw new Error(`Invalid command: "${args.command}". Please use one of ["upload", "download"].`);
    }
  })
};

function uploadSchema(db, args) {
  args = args || {};
  let filepath = 'baqend/schema/';
  return readDirectory(filepath).then((fileNames) => {
    return Promise.all(
      fileNames.map((fileName) => {
        return readFile(path.join(filepath, fileName)).then((file) => {
          return JSON.parse(file)
        })
      })
    ).then((schemas) => {
      if (args.force) {
        return helper.readInput("This will delete ALL your App data. Are you sure you want to continue? (yes/no)")
          .then((answer) => {
            if (answer.toLowerCase() === 'yes') {
              schemas.forEach((schema) => {
                console.log("Replacing " + schema.class.replace('/db/', '') + " Schema")
              });
              return db.send(new db.message.ReplaceAllSchemas(schemas));
            }
            return false;
          });
      } else {
        schemas.forEach((schema) => {
          console.log("Updating " + schema.class.replace('/db/', '') + " Schema")
        });
        return db.send(new db.message.UpdateAllSchemas(schemas))
      }
    })
  })
}
module.exports.uploadSchema = uploadSchema;

function downloadSchema(db) {
  return db.send(new db.message.GetAllSchemas()).then((res) => {
    return Promise.all(
      res.entity.map((schema) => {
        let classname = schema.class.replace('/db/', '')
        let filename = 'baqend/schema/' + classname + ".json"

        if (!classname.match(/logs\./) && classname !== 'Object') {
          return writeFile(filename, JSON.stringify(schema, null, 2)).then(() => {
            console.log('Downloaded ' + classname + ' Schema')
          })
        }
      })
    )
  });
}
module.exports.downloadSchema = downloadSchema;

function readDirectory(filePath) {
  return new Promise((resolve, reject) => {
    fs.readdir(filePath, (err, fileNames) => {
      err ? reject(err) : resolve(fileNames);
    })
  })
}

function writeFile(filePath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (err, fileNames) => {
      err ? reject(err) : resolve(fileNames);
    })
  })
}

function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf-8', (err, file) => {
      err ? reject(err) : resolve(file);
    })
  });
}

// recursive directory creation
function createDir(dir) {
  const splitPath = dir.split('/');
  splitPath.reduce((path, subPath) => {
    let currentPath;
    if(subPath != '.'){
      currentPath = path + '/' + subPath;
      if (!fs.existsSync(currentPath)){
        fs.mkdirSync(currentPath);
      }
    }
    else{
      currentPath = subPath;
    }
    return currentPath
  }, '')
}
