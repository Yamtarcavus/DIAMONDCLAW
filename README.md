# DIAMONDCLAW — Arc Mainnet

Frontend configured for the supplied $CLAW token contract:

`0x412bC8cee1F7F31818fA76c91B754F0CE5496501`

## Network
- Arc Mainnet
- Chain ID: 5042 (`0x13b2`)
- RPC: `https://rpc.arc-scan.org`
- Explorer: `https://arc-scan.org`
- Gas: native USDC
- Arc ERC-20 USDC: `0x3600000000000000000000000000000000000000`

## What is live in this build
- MetaMask connect/switch to Arc Mainnet
- Live $CLAW name/symbol/decimals/total supply
- Live wallet $CLAW and USDC balances
- Add $CLAW to wallet
- Copy CA + Arcscan explorer links
- Tier calculation from on-chain CLAW balance
- USDC ↔ CLAW token selection
- Live AchSwap V2 pair discovery
- Live on-chain V2 quote when a USDC/CLAW pair exists
- Real approve + swap execution when a live pair exists
- External Arc DEX fallback link

## Important
A token CA is not a staking/reward contract. No staking or claim contract address was supplied, so this build does not fabricate one or send unsafe transactions. To activate Stake/Claim, add the real staking/reward contract addresses and their ABI/function definitions to `js/app.js`.

The site also does not assume a 10% tax, APY, TVL, audit, or reward amount unless it can be backed by an actual deployed contract/configuration.
