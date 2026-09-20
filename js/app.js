/* DIAMONDCLAW - Arc Mainnet frontend
 * Token contract supplied by the project owner:
 * 0x412bC8cee1F7F31818fA76c91B754F0CE5496501
 *
 * This build uses only real on-chain information for the token itself.
 * Staking/reward contracts are intentionally not fabricated: a token CA is
 * not a staking/reward contract address.
 */

const CONFIG = {
  NETWORK: {
    chainId: '0x13b2',
    chainIdDecimal: 5042,
    chainName: 'Arc Mainnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: ['https://rpc.arc-scan.org'],
    blockExplorerUrls: ['https://arc-scan.org']
  },
  TOKEN_CONTRACT: '0x412bC8cee1F7F31818fA76c91B754F0CE5496501',
  USDC_CONTRACT: '0x3600000000000000000000000000000000000000',
  // AchSwap V2 public Arc Mainnet deployment. Used only when a real pair exists.
  DEX: {
    name: 'AchSwap V2',
    factory: '0xb0C2B0acb9c13079dDd871eDaF43Aabf6e88C530',
    router: '0x52FE40c00530db2e43d01652f903870571A14AFD',
    url: 'https://docs.achswap.app/'
  },
  EXTERNAL_TRADE_URL: 'https://www.arcade.trading/',
  TOKEN_SYMBOL_FALLBACK: 'CLAW',
  TOKEN_DECIMALS_FALLBACK: 18,
  TIERS: [
    { name: 'Baby Claw', minTokens: 1000, minDays: 0, multiplier: 1.0 },
    { name: 'Iron Claw', minTokens: 10000, minDays: 7, multiplier: 1.5 },
    { name: 'Steel Claw', minTokens: 50000, minDays: 30, multiplier: 2.5 },
    { name: 'Titanium Claw', minTokens: 250000, minDays: 90, multiplier: 5.0 },
    { name: 'Diamond Claw', minTokens: 1000000, minDays: 180, multiplier: 10.0 },
    { name: 'Alpha Claw', minTokens: 5000000, minDays: 365, multiplier: 25.0 }
  ]
};

const ERC20_ABI = [
  { constant: true, inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], type: 'function' },
  { constant: true, inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], type: 'function' },
  { constant: true, inputs: [], name: 'symbol', outputs: [{ type: 'string' }], type: 'function' },
  { constant: true, inputs: [], name: 'name', outputs: [{ type: 'string' }], type: 'function' },
  { constant: true, inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], type: 'function' },
  { constant: false, inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], type: 'function' },
  { constant: true, inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], type: 'function' }
];

const FACTORY_ABI = [
  { constant: true, inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], name: 'getPair', outputs: [{ name: 'pair', type: 'address' }], type: 'function' }
];
const ROUTER_ABI = [
  { constant: true, inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], name: 'getAmountsOut', outputs: [{ name: 'amounts', type: 'uint256[]' }], type: 'function' },
  { constant: false, inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'amountOutMin', type: 'uint256' }, { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], name: 'swapExactTokensForTokens', outputs: [{ name: 'amounts', type: 'uint256[]' }], type: 'function' }
];

let web3 = null;
let userAccount = null;
let tokenContract = null;
let usdcContract = null;
let routerContract = null;
let factoryContract = null;
let tokenDecimals = CONFIG.TOKEN_DECIMALS_FALLBACK;
let tokenSymbol = CONFIG.TOKEN_SYMBOL_FALLBACK;
let tokenName = 'DiamondClaw';
let tokenPair = null;

window.DiamondClaw = { CONFIG, connectWallet, disconnectWallet, getAccount: () => userAccount };
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.currentAccount = null;

function isAddress(a) { return /^0x[a-fA-F0-9]{40}$/.test(a || ''); }
function shortAddress(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : 'Connect Wallet'; }
function fmt(n, max = 4) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: max }); }
function fmtUsd(n) { return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }); }
function parseUnits(value, decimals) {
  const str = String(value ?? '0').trim();
  if (!/^\d+(\.\d+)?$/.test(str)) throw new Error('Geçersiz miktar.');
  const [whole, frac=''] = str.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return web3.utils.toBN(whole).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals))).add(web3.utils.toBN(padded || '0'));
}
function formatUnits(raw, decimals, max=6) {
  const bn = web3.utils.toBN(String(raw)); const base = web3.utils.toBN(10).pow(web3.utils.toBN(decimals));
  const whole = bn.div(base).toString(); const frac = bn.mod(base).toString().padStart(decimals, '0').replace(/0+$/, '');
  const n = Number(frac ? `${whole}.${frac}` : whole); return n.toLocaleString('en-US', { maximumFractionDigits: max });
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function ensureWeb3() {
  if (window.Web3) { web3 = web3 || new Web3(window.ethereum || CONFIG.NETWORK.rpcUrls[0]); return Promise.resolve(web3); }
  return new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-web3-loader]');
    if (old) { old.addEventListener('load', () => resolve((web3 = new Web3(window.ethereum || CONFIG.NETWORK.rpcUrls[0])))); old.addEventListener('error', reject); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/web3@1.10.0/dist/web3.min.js'; s.dataset.web3Loader = '1';
    s.onload = () => resolve((web3 = new Web3(window.ethereum || CONFIG.NETWORK.rpcUrls[0])));
    s.onerror = () => reject(new Error('Web3 library yüklenemedi.')); document.head.appendChild(s);
  });
}

function injectWalletModal() {
  if (document.getElementById('walletModal')) return;
  const m = document.createElement('div'); m.id = 'walletModal'; m.className = 'wallet-modal';
  m.innerHTML = `<div class="wallet-modal-card"><button class="wallet-close">&times;</button><div class="wallet-modal-icon">💎</div><h2>Connect Wallet</h2><p>MetaMask ile Arc Mainnet'e bağlanın.</p><button class="wallet-option" id="metamaskBtn"><span>🦊</span><strong>MetaMask</strong><small>Browser extension</small></button><div class="wallet-network-note">Arc Mainnet · Chain 5042 · Gas: USDC</div><div id="walletError" class="wallet-error" hidden></div></div>`;
  document.body.appendChild(m);
  m.querySelector('.wallet-close').onclick = closeWalletModal;
  m.addEventListener('click', e => { if (e.target === m) closeWalletModal(); });
  m.querySelector('#metamaskBtn').onclick = connectMetaMask;
}
function openWalletModal() { injectWalletModal(); document.getElementById('walletModal').classList.add('open'); }
function closeWalletModal() { const m = document.getElementById('walletModal'); if (m) m.classList.remove('open'); }
function walletError(msg) { const e = document.getElementById('walletError'); if (e) { e.hidden = false; e.textContent = msg; } }
function showActionMessage(msg, good = false) {
  let b = document.getElementById('actionMessage');
  if (!b) { b = document.createElement('div'); b.id = 'actionMessage'; b.className = 'action-message'; document.body.appendChild(b); }
  b.textContent = msg; b.classList.toggle('success', good); b.classList.add('show');
  clearTimeout(window._actionMessageTimer); window._actionMessageTimer = setTimeout(() => b.classList.remove('show'), 6500);
}

function bindConnectButtons() {
  document.querySelectorAll('#connectWallet,#walletBtn,[data-connect-wallet]').forEach(btn => {
    if (btn.dataset.walletBound) return;
    btn.dataset.walletBound = '1';
    btn.addEventListener('click', e => { e.preventDefault(); userAccount ? disconnectWallet() : openWalletModal(); });
  });
}

async function connectWallet() { if (userAccount) return disconnectWallet(); openWalletModal(); }

async function connectMetaMask() {
  if (!window.ethereum) return walletError('MetaMask bulunamadı. MetaMask kurup sayfayı yenileyin.');
  try {
    await ensureWeb3();
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const current = await window.ethereum.request({ method: 'eth_chainId' });
    if (current.toLowerCase() !== CONFIG.NETWORK.chainId.toLowerCase()) {
      try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CONFIG.NETWORK.chainId }] }); }
      catch (e) {
        if (e.code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [CONFIG.NETWORK] });
        else throw new Error('MetaMask içinde Arc Mainnet (5042) seçimini onaylayın.');
      }
    }
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts.length) throw new Error('Cüzdan adresi alınamadı.');
    userAccount = accounts[0]; window.currentAccount = userAccount; web3 = new Web3(window.ethereum);
    initContracts(); await refreshTokenMetadata();
    closeWalletModal(); updateWalletUI(); updatePageAfterWalletConnect(); await loadUserData();
    showActionMessage(`Bağlandı: ${shortAddress(userAccount)}`, true);
  } catch (e) { console.error(e); walletError(e.message || 'Wallet bağlantısı başarısız.'); }
}

function initContracts() {
  if (!web3) return;
  tokenContract = new web3.eth.Contract(ERC20_ABI, CONFIG.TOKEN_CONTRACT);
  usdcContract = new web3.eth.Contract(ERC20_ABI, CONFIG.USDC_CONTRACT);
  routerContract = new web3.eth.Contract(ROUTER_ABI, CONFIG.DEX.router);
  factoryContract = new web3.eth.Contract(FACTORY_ABI, CONFIG.DEX.factory);
}

async function refreshTokenMetadata() {
  if (!tokenContract) return;
  try { tokenSymbol = await tokenContract.methods.symbol().call(); } catch (_) {}
  try { tokenName = await tokenContract.methods.name().call(); } catch (_) {}
  try { tokenDecimals = Number(await tokenContract.methods.decimals().call()); } catch (_) {}
  document.title = `${tokenSymbol} | DIAMONDCLAW`;
  document.querySelectorAll('[data-token-symbol]').forEach(e => e.textContent = tokenSymbol);
  setText('tokenName', tokenName);
  setText('tokenContractShort', shortAddress(CONFIG.TOKEN_CONTRACT));
  const caEls = document.querySelectorAll('[data-ca]'); caEls.forEach(e => e.textContent = CONFIG.TOKEN_CONTRACT);
}

async function checkExistingConnection() {
  if (!window.ethereum) return;
  try {
    await ensureWeb3(); const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const chain = await window.ethereum.request({ method: 'eth_chainId' });
    if (accounts.length && chain.toLowerCase() === CONFIG.NETWORK.chainId.toLowerCase()) {
      userAccount = accounts[0]; window.currentAccount = userAccount; web3 = new Web3(window.ethereum); initContracts();
      await refreshTokenMetadata(); updateWalletUI(); updatePageAfterWalletConnect(); await loadUserData();
    }
  } catch (e) { console.warn('Existing wallet check:', e); }
}

function updateWalletUI() {
  document.querySelectorAll('#connectWallet,#walletBtn').forEach(btn => {
    btn.innerHTML = userAccount ? `<i class="fas fa-wallet"></i> ${shortAddress(userAccount)}` : '<i class="fas fa-wallet"></i> Connect Wallet';
    btn.classList.toggle('connected', !!userAccount); btn.title = userAccount ? 'Disconnect wallet' : 'Connect wallet';
  });
  if (userAccount) setText('connectedWallet', userAccount);
}

function disconnectWallet() {
  userAccount = null; window.currentAccount = null; tokenPair = null;
  updateWalletUI(); updatePageAfterWalletConnect(); showActionMessage('Wallet bağlantısı kapatıldı.');
}

async function getBalance(contract, decimals) {
  if (!contract || !userAccount) return 0;
  try { return Number(formatUnits(await contract.methods.balanceOf(userAccount).call(), decimals, 8).replace(/,/g,'')); } catch (_) { return 0; }
}
function rawAmount(value, decimals) { return parseUnits(value, decimals); }

async function loadUserData() {
  if (!userAccount || !web3) return;
  const [claw, usdc] = await Promise.all([getBalance(tokenContract, tokenDecimals), getBalance(usdcContract, 6)]);
  setText('clawBalance', `${fmt(claw)} ${tokenSymbol}`);
  try { const supplyRaw = await tokenContract.methods.totalSupply().call(); setText('totalSupplyValue', `${formatUnits(supplyRaw, tokenDecimals, 0)} ${tokenSymbol}`); } catch (_) {}
  setText('clawValue', 'On-chain balance');
  setText('availableBalance', `${fmt(claw)} ${tokenSymbol}`);
  setText('usdcBalance', `${fmt(usdc, 2)} USDC`);
  setText('fromBalance', 'Balance: ' + fmt(usdc, 2) + ' USDC');
  setText('toBalance', 'Balance: ' + fmt(claw) + ' ' + tokenSymbol);
  setText('stakedAmount', 'Not configured'); setText('pendingRewards', 'Not configured');
  updateTier(claw);
  await findPair();
}

function updateTier(balance) {
  let current = CONFIG.TIERS[0];
  CONFIG.TIERS.forEach(t => { if (balance >= t.minTokens) current = t; });
  setText('currentTier', current.name); setText('gripStrength', Math.floor(balance).toLocaleString('en-US'));
  const next = CONFIG.TIERS.find(t => balance < t.minTokens);
  setText('nextTier', next ? next.name : 'Max Tier');
  if (next) { const pct = Math.min(100, (balance / next.minTokens) * 100); const bar = document.getElementById('tierProgress'); if (bar) bar.style.width = pct + '%'; setText('tierProgressText', `${fmt(balance)} / ${fmt(next.minTokens)} ${tokenSymbol}`); }
}

async function findPair() {
  if (!factoryContract) return null;
  try { tokenPair = await factoryContract.methods.getPair(CONFIG.USDC_CONTRACT, CONFIG.TOKEN_CONTRACT).call(); if (/^0x0{40}$/i.test(tokenPair)) tokenPair = null; }
  catch (_) { tokenPair = null; }
  setText('pairAddress', tokenPair ? shortAddress(tokenPair) : 'No V2 pair found');
  document.querySelectorAll('[data-pair]').forEach(e => e.textContent = tokenPair || 'No live pair');
  return tokenPair;
}

function updatePageAfterWalletConnect() {
  const gate = document.getElementById('notConnected'), content = document.getElementById('dashboardContent');
  if (content) content.style.display = userAccount ? 'block' : 'none'; if (gate) gate.style.display = userAccount ? 'none' : 'block';
  const sg = document.getElementById('notConnectedStake'), sc = document.getElementById('stakeContent');
  if (sc) sc.style.display = userAccount ? 'block' : 'none'; if (sg) sg.style.display = userAccount ? 'none' : 'block';
}

function setupTrade() {
  const selectors = [...document.querySelectorAll('.token-selector')];
  const tokenList = [{ symbol: 'USDC', address: CONFIG.USDC_CONTRACT, decimals: 6 }, { symbol: tokenSymbol, address: CONFIG.TOKEN_CONTRACT, decimals: tokenDecimals }];
  selectors.forEach((selector, idx) => {
    selector.onclick = e => { e.preventDefault(); document.querySelectorAll('.token-menu').forEach(x => x.remove()); const menu = document.createElement('div'); menu.className = 'token-menu';
      tokenList.forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t.symbol; b.onclick = () => { selector.querySelector('span').textContent = t.symbol; menu.remove(); updateTradeUI(); }; menu.appendChild(b); });
      selector.parentElement.appendChild(menu);
    };
  });
  const sw = document.querySelector('.switch-btn'); if (sw) sw.onclick = () => { const s = selectors.map(x => x.querySelector('span')); if (s.length >= 2) [s[0].textContent, s[1].textContent] = [s[1].textContent, s[0].textContent]; updateTradeUI(); };
  document.getElementById('fromAmount')?.addEventListener('input', updateTradeUI);
  document.querySelectorAll('.max-btn').forEach(b => b.onclick = async () => { if (!userAccount) return openWalletModal(); const from = getTradeSymbols()[0]; const bal = from === 'USDC' ? await getBalance(usdcContract, 6) : await getBalance(tokenContract, tokenDecimals); const input = document.getElementById('fromAmount'); if (input) input.value = Math.max(0, bal - (from === 'USDC' ? 0.01 : 0)).toString(); updateTradeUI(); });
  const swap = document.getElementById('swapBtn'); if (swap) swap.onclick = executeSwap;
  updateTradeUI();
}
function getTradeSymbols() { const s = document.querySelectorAll('.token-selector span'); return [s[0]?.textContent.trim() || 'USDC', s[1]?.textContent.trim() || tokenSymbol]; }
function updateTradeUI() {
  const [from, to] = getTradeSymbols(), input = document.getElementById('fromAmount'), out = document.getElementById('toAmount');
  const amount = Number(input?.value || 0); if (!out) return;
  setText('fromBalance', 'Balance: ' + '—'); setText('toBalance', 'Balance: ' + '—');
  if (!amount || from === to) { out.value = ''; return; }
  if (tokenPair && routerContract) {
    const path = from === 'USDC' ? [CONFIG.USDC_CONTRACT, CONFIG.TOKEN_CONTRACT] : [CONFIG.TOKEN_CONTRACT, CONFIG.USDC_CONTRACT];
    const dec = from === 'USDC' ? 6 : tokenDecimals;
    routerContract.methods.getAmountsOut(rawAmount(amount, dec).toString(), path).call().then(arr => {
      const outDec = to === 'USDC' ? 6 : tokenDecimals; out.value = (Number(arr[arr.length - 1]) / (10 ** outDec)).toFixed(Math.min(outDec, 6));
      setText('pairStatus', `${CONFIG.DEX.name} · Live on-chain quote`);
    }).catch(() => { out.value = ''; setText('pairStatus', 'No live quote'); });
  } else { out.value = ''; setText('pairStatus', 'No live USDC/CLAW V2 pair detected'); }
}

async function executeSwap() {
  if (!userAccount) return openWalletModal();
  const [from, to] = getTradeSymbols(), amount = Number(document.getElementById('fromAmount')?.value || 0);
  if (!amount || from === to) return showActionMessage('Swap miktarı ve farklı tokenler seçin.');
  if (!tokenPair) return showActionMessage('Bu CA için AchSwap V2 üzerinde canlı USDC çifti bulunamadı. Likidite oluşturulduğunda Swap burada aktifleşir.');
  const sell = from === 'USDC' ? usdcContract : tokenContract;
  const sellDec = from === 'USDC' ? 6 : tokenDecimals;
  const path = from === 'USDC' ? [CONFIG.USDC_CONTRACT, CONFIG.TOKEN_CONTRACT] : [CONFIG.TOKEN_CONTRACT, CONFIG.USDC_CONTRACT];
  try {
    const amountIn = rawAmount(amount, sellDec);
    const amounts = await routerContract.methods.getAmountsOut(amountIn.toString(), path).call();
    const minOut = web3.utils.toBN(amounts[amounts.length - 1]).mul(web3.utils.toBN('995')).div(web3.utils.toBN('1000'));
    const allowance = await sell.methods.allowance(userAccount, CONFIG.DEX.router).call();
    if (web3.utils.toBN(allowance).lt(amountIn)) {
      showActionMessage(`Approve ${from} için MetaMask işlemini onaylayın...`);
      await sell.methods.approve(CONFIG.DEX.router, amountIn.toString()).send({ from: userAccount });
    }
    showActionMessage('Swap MetaMask onayınızı bekliyor...');
    const tx = await routerContract.methods.swapExactTokensForTokens(amountIn.toString(), minOut.toString(), path, userAccount, Math.floor(Date.now() / 1000) + 1200).send({ from: userAccount });
    showActionMessage(`Swap tamamlandı: ${tx.transactionHash}`, true);
    await loadUserData(); updateTradeUI();
  } catch (e) { console.error(e); showActionMessage(e.message || 'Swap başarısız.'); }
}

function setupRewards() {
  const b = document.getElementById('claimRewardsBtn'); if (b) b.onclick = () => {
    if (!userAccount) return openWalletModal();
    showActionMessage('Claim için ayrı bir reward contract adresi/ABI gerekir. Verilen CA token kontratıdır; token CA üzerinden güvenli biçimde claim uyduramam.');
  };
}
function setupStake() {
  document.querySelectorAll('.lock-btn').forEach(b => b.onclick = () => { document.querySelectorAll('.lock-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); updateStakeCalculator(); });
  document.getElementById('stakeAmount')?.addEventListener('input', updateStakeCalculator); updateStakeCalculator();
  const btn = document.getElementById('stakeBtn'); if (btn) btn.onclick = () => { if (!userAccount) return openWalletModal(); showActionMessage('Stake için ayrı bir staking contract adresi/ABI gerekir. Sadece token CA ile stake işlemi yapılamaz.'); };
}
function updateStakeCalculator() {
  const amount = Number(document.getElementById('stakeAmount')?.value || 0), active = document.querySelector('.lock-btn.active');
  const days = Number(active?.dataset.days || 90), boost = Number(active?.dataset.boost || 2.5), apy = Number(active?.dataset.apy || 212);
  setText('selectedDays', `${days} Days`); setText('selectedBoost', `x${boost}`); setText('calculatedAPY', 'Contract pending'); setText('dailyEarnings', '—'); setText('totalReturn', '—');
}

function setupUtilityButtons() {
  document.querySelectorAll('[data-copy-ca]').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(CONFIG.TOKEN_CONTRACT); showActionMessage('CLAW contract adresi kopyalandı.', true); });
  document.querySelectorAll('[data-add-token]').forEach(b => b.onclick = async () => {
    if (!window.ethereum) return openWalletModal();
    try { await window.ethereum.request({ method: 'wallet_watchAsset', params: [{ type: 'ERC20', options: { address: CONFIG.TOKEN_CONTRACT, symbol: tokenSymbol, decimals: tokenDecimals, image: location.origin + location.pathname.replace(/[^/]*$/, '') + 'images/logo.png' } }] }); } catch (e) { showActionMessage(e.message || 'Token eklenemedi.'); }
  });
  document.querySelectorAll('[data-explorer]').forEach(b => b.href = `https://arc-scan.org/address/${CONFIG.TOKEN_CONTRACT}`);
}

function setupGlobalEvents() {
  bindConnectButtons(); injectWalletModal(); setupTrade(); setupRewards(); setupStake(); setupUtilityButtons();
  if (window.ethereum && !window.ethereum.__diamondClawEvents) {
    window.ethereum.__diamondClawEvents = true;
    window.ethereum.on('accountsChanged', async accounts => { if (!accounts.length) disconnectWallet(); else { userAccount = accounts[0]; window.currentAccount = userAccount; updateWalletUI(); await loadUserData(); updatePageAfterWalletConnect(); } });
    window.ethereum.on('chainChanged', () => location.reload());
  }
}

function loadGlobalStats() {
  setText('holdersCount', 'Live on Arc'); setText('totalStaked', 'Not configured'); setText('avgHold', '—');
  document.querySelectorAll('[data-ca]').forEach(e => e.textContent = CONFIG.TOKEN_CONTRACT);
}

async function initApp() {
  setupGlobalEvents(); loadGlobalStats();
  await ensureWeb3();
  web3 = new Web3(window.ethereum || CONFIG.NETWORK.rpcUrls[0]); initContracts(); await refreshTokenMetadata();
  await findPair();
  await checkExistingConnection();
}

window.addEventListener('DOMContentLoaded', initApp);
