const web3 = require("@solana/web3.js");
const config = require('./config');

const connection = new web3.Connection(
  web3.clusterApiUrl('devnet'),
  'confirmed',
)

// async function getKeypair(privateKey) {
//   // privateKey支持2种
//   // 1. 私钥字符串
//   // 2. 私钥字符串
//   if (privateKey instanceof web3.Keypair) {
//     return privateKey
//   } else {
//     return web3.Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
//   }
// }

async function getAccountsList() {
  // 
}


// let secretKey = Uint8Array.from([
//   202, 171, 192, 129, 150, 189, 204, 241, 142, 71, 205, 2, 81, 97, 2, 176, 48,
//   81, 45, 1, 96, 138, 220, 132, 231, 131, 120, 77, 66, 40, 97, 172, 91, 245, 84,
//   221, 157, 190, 9, 145, 176, 130, 25, 43, 72, 107, 190, 229, 75, 88, 191, 136,
//   7, 167, 109, 91, 170, 164, 186, 15, 142, 36, 12, 23,
// ]);

// let keypair = web3.Keypair.fromSecretKey(secretKey);
// console.log(keypair)

async function getTokenInfo(connection, sender, tokenContractAddress) {
  const tokenMint = new web3.PublicKey(tokenContractAddress)
  const token = new splToken.Token(connection, tokenMint, splToken.TOKEN_PROGRAM_ID, sender)
  const decimals = (await token.getMintInfo()).decimals
  return { token: token, decimals: decimals }
}

async function buildSplTokenBatchTransferTx(connection, sender, tokenInfo, transfers) {
  let token = tokenInfo.token
  let senderTokenAccount = await token.getOrCreateAssociatedAccountInfo(sender.publicKey)
  let transferedRecipients = {}
  let transaction = new web3.Transaction()
  for (var i = 0; i < transfers.length; i++) {
    let transfer = transfers[i]
    let recipient = transfer.recipient
    let amount = transfer.value * Math.pow(10, tokenInfo.decimals)
    let aTokenAddress =
      await getAssociatedTokenAddress(connection, recipient, token.publicKey) ||
      transferedRecipients[recipient]
    if (aTokenAddress) {
      transaction = transaction.add(
        splToken.Token.createTransferInstruction(
          splToken.TOKEN_PROGRAM_ID,
          senderTokenAccount.address,
          aTokenAddress,
          sender.publicKey,
          [],
          amount
        )
      )
    } else {
      aTokenAddress = await calcAssociatedTokenAddress(recipient, token.publicKey)
      transaction = transaction.add(
        splToken.Token.createAssociatedTokenAccountInstruction(
          splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
          splToken.TOKEN_PROGRAM_ID,
          token.publicKey,
          aTokenAddress,
          recipient,
          sender.publicKey
        ),
        splToken.Token.createTransferInstruction(
          splToken.TOKEN_PROGRAM_ID,
          senderTokenAccount.address,
          aTokenAddress,
          sender.publicKey,
          [],
          amount
        )
      )
    }
    transferedRecipients[recipient] = aTokenAddress
  }

  return transaction
}



async function getAssociatedTokenAddress(connection, address, tokenMint) {
  const result = await connection.getTokenAccountsByOwner(address, { 'mint': tokenMint }, { commitment: 'confirmed' })
  if (result.value.length == 0) {
    return null
  }
  return result.value[0].pubkey
}

async function calcAssociatedTokenAddress(address, tokenMint) {
  return (await web3.PublicKey.findProgramAddress(
    [
      address.toBuffer(),
      splToken.TOKEN_PROGRAM_ID.toBuffer(),
      tokenMint.toBuffer()
    ],
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0]
}

async function transfer() {
  const { privateKey, toAddressList } = config;
  const sender = web3.Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

  const tx = new web3.Transaction();

  for (let toAddress of toAddressList) {
    tx.add(
      web3.SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: toAddress,
        lamports: amount * web3.LAMPORTS_PER_SOL,
      })
    )
  }

  const signature = await web3.sendAndConfirmTransaction(
    connection,
    tx,
    [sender]
  );

  const tokenInfo = await getTokenInfo(connection, sender, '');

  const splTx = await buildSplTokenBatchTransferTx(connection, sender, tokenInfo, splTransfers)
  const splSignature = await web3.sendAndConfirmTransaction(
    connection,
    splTx,
    [sender]
  )

  console.log('SPL_SIGNATURE', splSignature)

}