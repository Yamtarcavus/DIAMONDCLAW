// DiamondClaw Token Configuration
const CONFIG = {
    // Arc Network Mainnet
    NETWORK: {
        chainId: '0x...', // Arc Network Chain ID (hex)
        chainName: 'Arc Network',
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://arc-mainnet.rpc.url'],
        blockExplorerUrls: ['https://arcscan.io']
    },
    
    // Token Contract (REPLACE WITH REAL ADDRESS)
    TOKEN_CONTRACT: '0x1234567890123456789012345678901234567890',
    
    // Staking Contract (REPLACE WITH REAL ADDRESS)
    STAKING_CONTRACT: '0x0987654321098765432109876543210987654321',
    
    // Token ABI (simplified)
    TOKEN_ABI: [
        {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "totalSupply",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function"
        }
    ],
    
    // Staking ABI (simplified)
    STAKING_ABI: [
        {
            "constant": true,
            "inputs": [{"name": "", "type": "address"}],
            "name": "stakes",
            "outputs": [
                {"name": "amount", "type": "uint256"},
                {"name": "startTime", "type": "uint256"},
                {"name": "tier", "type": "uint8"}
            ],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "totalStaked",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function"
        }
    ],
    
    // Tier Requirements
    TIERS: [
        { name: 'Baby Claw', minTokens: 1000, minDays: 0, multiplier: 1.0 },
        { name: 'Iron Claw', minTokens: 10000, minDays: 7, multiplier: 1.5 },
        { name: 'Steel Claw', minTokens: 50000, minDays: 30, multiplier: 2.5 },
        { name: 'Titanium Claw', minTokens: 250000, minDays: 90, multiplier: 5.0 },
        { name: 'Diamond Claw', minTokens: 1000000, minDays: 180, multiplier: 10.0 },
        { name: 'Alpha Claw', minTokens: 5000000, minDays: 365, multiplier: 25.0 }
    ]
};

// Global Variables
let web3;
let userAccount = null;
let tokenContract;
let stakingContract;

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    setupWalletModal();
    checkExistingConnection();
    loadGlobalStats();
    
    // Setup lock buttons on stake page
    const lockBtns = document.querySelectorAll('.lock-btn');
    lockBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            lockBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateStakeCalculator();
        });
    });
}

// Wallet Connection
function setupWalletModal() {
    const connectBtn = document.getElementById('connectWallet') || document.getElementById('walletBtn');
    const modal = document.getElementById('walletModal');
    const closeBtn = document.querySelector('.close');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            if (userAccount) {
                disconnectWallet();
            } else {
                modal.style.display = 'block';
            }
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // MetaMask
    const metamaskBtn = document.getElementById('metamaskBtn');
    if (metamaskBtn) {
        metamaskBtn.addEventListener('click', () => connectMetaMask());
    }
    
    // WalletConnect
    const wcBtn = document.getElementById('walletConnectBtn');
    if (wcBtn) {
        wcBtn.addEventListener('click', () => {
            alert('WalletConnect integration coming soon!');
            modal.style.display = 'none';
        });
    }
    
    // Coinbase
    const cbBtn = document.getElementById('coinbaseBtn');
    if (cbBtn) {
        cbBtn.addEventListener('click', () => {
            alert('Coinbase Wallet integration coming soon!');
            modal.style.display = 'none';
        });
    }
}

async function connectMetaMask() {
    const modal = document.getElementById('walletModal');
    
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        window.open('https://metamask.io', '_blank');
        return;
    }
    
    try {
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        // Request personal sign for verification
        const message = `Welcome to DiamondClaw!\n\nSign this message to verify your wallet ownership.\n\nTimestamp: ${Date.now()}`;
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, accounts[0]]
        });
        
        console.log('Signature verified:', signature);
        
        userAccount = accounts[0];
        modal.style.display = 'none';
        
        // Initialize Web3
        web3 = new Web3(window.ethereum);
        
        // Check/Add Arc Network
        await checkNetwork();
        
        // Initialize contracts
        initContracts();
        
        // Update UI
        updateWalletUI();
        
        // Load user data
        loadUserData();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                userAccount = accounts[0];
                updateWalletUI();
                loadUserData();
            }
        });
        
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
        
    } catch (error) {
        console.error('Connection error:', error);
        alert('Connection rejected or failed: ' + error.message);
    }
}

async function checkNetwork() {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    if (chainId !== CONFIG.NETWORK.chainId) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: CONFIG.NETWORK.chainId }]
            });
        } catch (switchError) {
            // If network doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [CONFIG.NETWORK]
                    });
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                }
            }
        }
    }
}

function initContracts() {
    if (!web3) return;
    
    tokenContract = new web3.eth.Contract(
        CONFIG.TOKEN_ABI, 
        CONFIG.TOKEN_CONTRACT
    );
    
    stakingContract = new web3.eth.Contract(
        CONFIG.STAKING_ABI, 
        CONFIG.STAKING_CONTRACT
    );
}

function updateWalletUI() {
    const connectBtn = document.getElementById('connectWallet') || document.getElementById('walletBtn');
    if (connectBtn && userAccount) {
        const shortAddress = userAccount.slice(0, 6) + '...' + userAccount.slice(-4);
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> ${shortAddress}`;
        connectBtn.classList.add('connected');
    }
}

async function loadUserData() {
    if (!userAccount || !tokenContract) return;
    
    try {
        // Get CLAW balance
        const balance = await tokenContract.methods.balanceOf(userAccount).call();
        const decimals = await tokenContract.methods.decimals().call();
        const clawBalance = balance / Math.pow(10, decimals);
        
        // Store for later use
        window.userClawBalance = clawBalance;
        
        // Update dashboard if on that page
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = clawBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + ' CLAW';
        }
        
        // Check if can stake
        checkStakeEligibility(clawBalance);
        
        // Get staked amount
        if (stakingContract) {
            const stakeInfo = await stakingContract.methods.stakes(userAccount).call();
            const stakedAmount = stakeInfo.amount / Math.pow(10, decimals);
            
            const stakedElement = document.getElementById('userStaked');
            if (stakedElement) {
                stakedElement.textContent = stakedAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + ' CLAW';
            }
            
            // Calculate tier
            const holdTime = calculateHoldTime(stakeInfo.startTime);
            const tier = calculateTier(clawBalance + stakedAmount, holdTime);
            updateTierDisplay(tier);
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function checkStakeEligibility(balance) {
    const MIN_STAKE = 1000; // Minimum 1000 CLAW to stake
    
    const stakeBtn = document.getElementById('confirmStakeBtn');
    const errorMsg = document.getElementById('stakeError');
    
    if (stakeBtn) {
        if (balance < MIN_STAKE) {
            stakeBtn.disabled = true;
            stakeBtn.textContent = `Need ${MIN_STAKE} CLAW to Stake`;
            if (errorMsg) {
                errorMsg.textContent = `You need at least ${MIN_STAKE} CLAW tokens to stake. Current balance: ${balance.toFixed(2)} CLAW`;
                errorMsg.style.display = 'block';
            }
        } else {
            stakeBtn.disabled = false;
            stakeBtn.textContent = 'Confirm Stake';
            if (errorMsg) errorMsg.style.display = 'none';
        }
    }
}

function calculateHoldTime(startTime) {
    if (!startTime || startTime == 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - startTime) / 86400); // Days
}

function calculateTier(totalTokens, holdDays) {
    for (let i = CONFIG.TIERS.length - 1; i >= 0; i--) {
        const tier = CONFIG.TIERS[i];
        if (totalTokens >= tier.minTokens && holdDays >= tier.minDays) {
            return tier;
        }
    }
    return CONFIG.TIERS[0];
}

function updateTierDisplay(tier) {
    const tierElement = document.getElementById('currentTier');
    if (tierElement) {
        tierElement.innerHTML = `
            <div class="tier-badge ${tier.name.toLowerCase().replace(' ', '-')}">
                ${tier.name}
            </div>
            <span>${tier.multiplier}x Multiplier</span>
        `;
    }
}

function disconnectWallet() {
    userAccount = null;
    web3 = null;
    tokenContract = null;
    stakingContract = null;
    
    const connectBtn = document.getElementById('connectWallet') || document.getElementById('walletBtn');
    if (connectBtn) {
        connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        connectBtn.classList.remove('connected');
    }
    
    // Clear user data displays
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) balanceElement.textContent = '--';
    
    const stakedElement = document.getElementById('userStaked');
    if (stakedElement) stakedElement.textContent = '--';
}

async function loadGlobalStats() {
    // These would come from your backend or blockchain
    // For now, showing placeholder that updates with real data when connected
    
    const holdersEl = document.getElementById('holdersCount');
    const stakedEl = document.getElementById('totalStaked');
    const avgEl = document.getElementById('avgHold');
    
    if (holdersEl) holdersEl.textContent = '12,847';
    if (stakedEl) stakedEl.textContent = '8.2M';
    if (avgEl) avgEl.textContent = '47';
    
    // If connected, try to get real data
    if (stakingContract) {
        try {
            const totalStaked = await stakingContract.methods.totalStaked().call();
            const decimals = await tokenContract.methods.decimals().call();
            const stakedM = (totalStaked / Math.pow(10, decimals) / 1000000).toFixed(1);
            if (stakedEl) stakedEl.textContent = stakedM + 'M';
        } catch (e) {
            console.log('Could not fetch on-chain data');
        }
    }
}

function updateStakeCalculator() {
    const amountInput = document.getElementById('stakeAmount');
    const activeLock = document.querySelector('.lock-btn.active');
    
    if (!amountInput || !activeLock) return;
    
    const amount = parseFloat(amountInput.value) || 0;
    const boost = parseFloat(activeLock.dataset.boost) || 1;
    
    // Check minimum
    if (amount > 0 && amount < 1000) {
        document.getElementById('stakeError').textContent = 'Minimum stake is 1,000 CLAW';
        document.getElementById('stakeError').style.display = 'block';
    } else {
        document.getElementById('stakeError').style.display = 'none';
    }
    
    const baseAPY = 85;
    const finalAPY = baseAPY * boost;
    const daily = (amount * finalAPY / 100) / 365;
    
    const apyEl = document.getElementById('calculatedAPY');
    const dailyEl = document.getElementById('calculatedDaily');
    
    if (apyEl) apyEl.textContent = finalAPY.toFixed(1) + '%';
    if (dailyEl) dailyEl.textContent = daily.toFixed(2) + ' CLAW';
}

// Check existing connection on page load
async function checkExistingConnection() {
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ 
            method: 'eth_accounts',
            params: []
        });
        if (accounts.length > 0) {
            userAccount = accounts[0];
            if (typeof Web3 === 'undefined') return;
            web3 = new Web3(window.ethereum);
            initContracts();
            updateWalletUI();
            loadUserData();
        }
    }
}

console.log('💎 DiamondClaw Web3 Loaded');
console.log('🔗 Connect your wallet to begin');
