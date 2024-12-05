require('dotenv').config();
const { encrypt } = require('./utils/encryption');

const plaintextPassword = '123456';
const encryptedPassword = encrypt(plaintextPassword);

console.log('Encrypted Password:', encryptedPassword);
