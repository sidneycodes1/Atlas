const http = require('http');

const payload = JSON.stringify({
  toAddress: 'BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6', // transfer from JITO_AUTH to ATLAS_TREASURY
  amountSol: 0.1,
  atlasEnabled: false
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/submit-transfer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(payload);
req.end();
