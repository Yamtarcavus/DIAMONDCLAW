DIAMONDCLAW Arc Mainnet standalone build.

Upload the contents of this folder to the repository root. Do not upload the parent folder itself.


## Wallet fix
This build pins Web3.js 1.10.0 and uses JSON ABI objects. The previous build loaded Web3.js latest (v4) while passing human-readable ABI strings, which caused `Cannot create property 'constant' on string ... balanceOf(...)`.
