'use strict';
const crypto=require('node:crypto');

function encryptCredentials(csv,key){
 if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('La clave de cifrado debe tener 32 bytes.');
 const iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(csv,'utf8'),cipher.final()]);
 return {iv:iv.toString('hex'),auth_tag:cipher.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('base64')};
}

function decryptCredentials(record,key){
 if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('La clave de cifrado debe tener 32 bytes.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'hex'));
 decipher.setAuthTag(Buffer.from(record.auth_tag,'hex'));
 return Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]);
}

module.exports={encryptCredentials,decryptCredentials};
