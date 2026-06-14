async function test() {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- SOL Attempt ${i} ---`);
    const res = await fetch('http://localhost:3000/api/submit-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toAddress: "BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6",
        amountSol: 0.001,
        atlasEnabled: false,
        asset: "SOL"
      })
    });
    const data = await res.json();
    console.log(data);
  }

  console.log(`\n--- USDC Attempt 1 ---`);
  const res = await fetch('http://localhost:3000/api/submit-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toAddress: "BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6",
      amountSol: 0.001,
      atlasEnabled: false,
      asset: "USDC"
    })
  });
  const data = await res.json();
  console.log(data);
}
test();
