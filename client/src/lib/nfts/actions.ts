import { MichelsonMap } from '@taquito/taquito';
import { Buffer } from 'buffer';
import { SystemWithWallet } from '../system';
import faucetCode from './code/fa2_tzip16_compat_multi_nft_faucet';
import assetCode from './code/fa2_tzip16_compat_multi_nft_asset';
import { uploadIPFSJSON } from '../util/ipfs';

function toHexString(input: string) {
  return Buffer.from(input).toString('hex');
}

export async function createFaucetContract(
  system: SystemWithWallet,
  name: string
) {
  const metadataMap = new MichelsonMap<string, string>();
  const resp = await uploadIPFSJSON({
    name,
    description: 'An OpenMinter base collection contract.',
    interfaces: ['TZIP-012', 'TZIP-016', 'TZIP-020'],
    tokenCategory: 'collectibles'
  });
  metadataMap.set('', toHexString(resp.data.ipfsUri));
  return await system.toolkit.wallet
    .originate({
      code: faucetCode,
      storage: {
        assets: {
          ledger: new MichelsonMap(),
          next_token_id: 0,
          operators: new MichelsonMap(),
          token_metadata: new MichelsonMap()
        },
        metadata: metadataMap
      }
    })
    .send();
}

export async function createAssetContract(
  system: SystemWithWallet,
  metadata: Record<string, string>
) {
  const metadataMap = new MichelsonMap<string, string>();
  const resp = await uploadIPFSJSON({
    description: 'An OpenMinter assets contract.',
    interfaces: ['TZIP-012', 'TZIP-016', 'TZIP-020'],
    tokenCategory: 'collectibles',
    ...metadata
  });
  metadataMap.set('', toHexString(resp.data.ipfsUri));
  return await system.toolkit.wallet
    .originate({
      code: assetCode,
      storage: {
        assets: {
          ledger: new MichelsonMap(),
          next_token_id: 0,
          operators: new MichelsonMap(),
          token_metadata: new MichelsonMap()
        },
        admin: {
          admin: system.tzPublicKey,
          pending_admin: null,
          paused: false
        },
        metadata: metadataMap
      }
    })
    .send();
}

export async function mintToken(
  system: SystemWithWallet,
  address: string,
  metadata: Record<string, string>
) {
  const contract = await system.toolkit.wallet.at(address);
  const storage = await contract.storage<any>();

  const token_id = storage.assets.next_token_id;
  const token_info = new MichelsonMap<string, string>();
  const resp = await uploadIPFSJSON({
    ...metadata,
    decimals: 0,
    booleanAmount: true
  });
  token_info.set('', toHexString(resp.data.ipfsUri));

  return contract.methods
    .mint([
      {
        owner: system.tzPublicKey,
        token_metadata: {
          token_id,
          token_info
        }
      }
    ])
    .send();
}

export async function transferToken(
  system: SystemWithWallet,
  contractAddress: string,
  tokenId: number,
  toAddress: string
) {
  const contract = await system.toolkit.wallet.at(contractAddress);
  return contract.methods
    .transfer([
      {
        from_: system.tzPublicKey,
        txs: [{ to_: toAddress, token_id: tokenId, amount: 1 }]
      }
    ])
    .send();
}
