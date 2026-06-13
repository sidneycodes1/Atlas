const { PublicKey } = require('@solana/web3.js');
const addr = "7e4PtnppQKXkPWLRcp6e3dv3CSqrmtTENKcC4h44Ry7V";
console.log('Length:', addr.length);
console.log('Char codes:', [...addr].map(c => c.charCodeAt(0)));
try {
  new PublicKey(addr);
  console.log('VALID');
} catch (e) {
  console.log('INVALID:', e.message);
}
