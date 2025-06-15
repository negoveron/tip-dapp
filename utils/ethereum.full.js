// Import ethers.js library for interacting with Ethereum blockchain
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../contract/config';


// Check if MetaMask is installed
// This function verifies if the MetaMask extension is available in the browser.
export const isMetaMaskInstalled = () => {
  return window.ethereum !== undefined;
};

// Request account access from MetaMask
// This function prompts the user to connect their wallet and returns the connected account address.
export const connectWallet = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }
  
  try {
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    console.log(accounts);
    return accounts[0];
  } catch (error) {
    throw new Error(`Failed to connect to wallet: ${error.message}`);
  }
};

// Check if connected to Sepolia network
// This function checks the current network and verifies if it matches the Sepolia testnet.
export const checkNetwork = async () => {
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    // Sepolia chain ID is 0xaa36a7 (11155111 in decimal)
    return chainId === '0xaa36a7';
  } catch (error) {
    throw new Error(`Failed to check network: ${error.message}`);
  }
};

// Switch to Sepolia network
// This function switches the user's wallet to the Sepolia testnet. If the network is not added, it attempts to add it.
export const switchToSepolia = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID
    });
    return true;
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'Sepolia ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io/'],
            },
          ],
        });
        return true;
      } catch (addError) {
        throw new Error(`Failed to add Sepolia network: ${addError.message}`);
      }
    }
    throw new Error(`Failed to switch to Sepolia network: ${error.message}`);
  }
};

// Get contract instance
// This function creates an instance of the smart contract using ethers.js.
// If 'withSigner' is true, the contract instance allows sending transactions.
export const getContract = async (withSigner = false) => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    if (withSigner) {
      // A signer is used to send transactions to the blockchain (write operations).
      const signer = provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }

    // A provider is used to read data from the blockchain (read operations).
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  } catch (error) {
    throw new Error(`Failed to get contract: ${error.message}`);
  }
};

// Get contract owner
// This function retrieves the owner of the deployed smart contract.
export const getContractOwner = async () => {
  try {
    const contract = await getContract();
    return await contract.owner();
  } catch (error) {
    throw new Error(`Failed to get contract owner: ${error.message}`);
  }
};

// TIPJAR SPECIFIC FUNCTIONS

/**
 * Send a tip to the TipJar contract
 * @param {string} message - Message to accompany the tip
 * @param {string} amount - Amount of ETH to send (in ETH, not wei)
 * @returns {Promise<Object>} Transaction receipt
 */
export const sendTip = async (message, amount) => {
  if (!message || message.trim() === '') {
    throw new Error("Message cannot be empty");
  }
  
  if (!amount || parseFloat(amount) <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  try {
    const contract = await getContract(true); // Need signer for transactions
    
    // Convert ETH to wei
    const weiAmount = ethers.utils.parseEther(amount.toString());
    
    // Send the tip transaction
    const transaction = await contract.tip(message, {
      value: weiAmount,
      gasLimit: 100000 // Set a reasonable gas limit
    });
    
    console.log("Transaction sent:", transaction.hash);
    
    // Wait for transaction confirmation
    const receipt = await transaction.wait();
    console.log("Transaction confirmed:", receipt);
    
    return {
      hash: transaction.hash,
      receipt: receipt,
      success: true
    };
  } catch (error) {
    console.error("Failed to send tip:", error);
    throw new Error(`Failed to send tip: ${error.message}`);
  }
};

/**
 * Withdraw all funds from the contract (only owner can call this)
 * @returns {Promise<Object>} Transaction receipt
 */
export const withdrawFunds = async () => {
  try {
    const contract = await getContract(true); // Need signer for transactions
    
    // Check if current account is the owner
    const owner = await contract.owner();
    const signer = await contract.signer.getAddress();
    
    if (owner.toLowerCase() !== signer.toLowerCase()) {
      throw new Error("Only the contract owner can withdraw funds");
    }
    
    // Send the withdraw transaction
    const transaction = await contract.withdraw({
      gasLimit: 100000
    });
    
    console.log("Withdrawal transaction sent:", transaction.hash);
    
    // Wait for transaction confirmation
    const receipt = await transaction.wait();
    console.log("Withdrawal confirmed:", receipt);
    
    return {
      hash: transaction.hash,
      receipt: receipt,
      success: true
    };
  } catch (error) {
    console.error("Failed to withdraw funds:", error);
    throw new Error(`Failed to withdraw funds: ${error.message}`);
  }
};

/**
 * Get the current balance of the TipJar contract
 * @returns {Promise<string>} Balance in ETH
 */
export const getContractBalance = async () => {
  try {
    const contract = await getContract(); // Read operation, no signer needed
    
    const balanceWei = await contract.getBalance();
    
    // Convert wei to ETH
    const balanceEth = ethers.utils.formatEther(balanceWei);
    
    return balanceEth;
  } catch (error) {
    console.error("Failed to get contract balance:", error);
    throw new Error(`Failed to get contract balance: ${error.message}`);
  }
};

/**
 * Get the total number of tips received by the contract
 * @returns {Promise<number>} Total number of tips
 */
export const getTotalTips = async () => {
  try {
    const contract = await getContract(); // Read operation, no signer needed
    
    const totalTips = await contract.getTotalTips();
    
    // Convert BigNumber to regular number
    return totalTips.toNumber();
  } catch (error) {
    console.error("Failed to get total tips:", error);
    throw new Error(`Failed to get total tips: ${error.message}`);
  }
};

/**
 * Get a specific tip by ID
 * @param {number} tipId - ID of the tip to retrieve
 * @returns {Promise<Object>} Tip data
 */
export const getTipById = async (tipId) => {
  try {
    const contract = await getContract();
    
    const [from, amount, message, timestamp] = await contract.getTip(tipId);
    
    return {
      from: from,
      amount: ethers.utils.formatEther(amount), // Convert to ETH
      message: message,
      timestamp: timestamp.toNumber(),
      date: new Date(timestamp.toNumber() * 1000) // Convert to readable date
    };
  } catch (error) {
    console.error("Failed to get tip:", error);
    throw new Error(`Failed to get tip: ${error.message}`);
  }
};

/**
 * Get the latest N tips
 * @param {number} count - Number of tips to retrieve
 * @returns {Promise<Array>} Array of tip objects
 */
export const getLatestTips = async (count = 10) => {
  try {
    const contract = await getContract();
    
    const [fromAddresses, amounts, messages, timestamps] = await contract.getLatestTips(count);
    
    // Convert the arrays into an array of objects
    const tips = [];
    for (let i = 0; i < fromAddresses.length; i++) {
      tips.push({
        from: fromAddresses[i],
        amount: ethers.utils.formatEther(amounts[i]),
        message: messages[i],
        timestamp: timestamps[i].toNumber(),
        date: new Date(timestamps[i].toNumber() * 1000)
      });
    }
    
    return tips;
  } catch (error) {
    console.error("Failed to get latest tips:", error);
    throw new Error(`Failed to get latest tips: ${error.message}`);
  }
};

/**
 * Get all tip IDs for a specific user
 * @param {string} userAddress - Address of the user
 * @returns {Promise<Array>} Array of tip IDs
 */
export const getUserTipIds = async (userAddress) => {
  try {
    const contract = await getContract();
    
    const tipIds = await contract.getUserTipIds(userAddress);
    
    // Convert BigNumbers to regular numbers
    return tipIds.map(id => id.toNumber());
  } catch (error) {
    console.error("Failed to get user tip IDs:", error);
    throw new Error(`Failed to get user tip IDs: ${error.message}`);
  }
};

/**
 * Check if the current connected account is the contract owner
 * @returns {Promise<boolean>} True if current account is owner
 */
export const isCurrentAccountOwner = async () => {
  try {
    const contract = await getContract(true);
    const owner = await contract.owner();
    const currentAccount = await contract.signer.getAddress();
    
    return owner.toLowerCase() === currentAccount.toLowerCase();
  } catch (error) {
    console.error("Failed to check if current account is owner:", error);
    return false;
  }
};

// Listen for account changes
// This function sets up a listener for changes in the connected wallet account.
export const listenForAccountChanges = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      callback(accounts[0] || null);
    });
  }
};

// Listen for network changes
// This function sets up a listener for changes in the connected network.
export const listenForNetworkChanges = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId) => {
      callback(chainId === '0xaa36a7'); // Check if Sepolia
    });
  }
};

/**
 * Listen for new tip events
 * @param {Function} callback - Function to call when a new tip is received
 */
export const listenForNewTips = (callback) => {
  if (!isMetaMaskInstalled()) {
    console.error("MetaMask is not installed");
    return;
  }

  try {
    getContract().then(contract => {
      // Listen for NewTip events
      contract.on("NewTip", (from, amount, message, event) => {
        const tipData = {
          from: from,
          amount: ethers.utils.formatEther(amount),
          message: message,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        };
        
        callback(tipData);
      });
    });
  } catch (error) {
    console.error("Failed to set up tip listener:", error);
  }
};

/**
 * Stop listening for contract events
 */
export const stopListeningForEvents = async () => {
  try {
    const contract = await getContract();
    contract.removeAllListeners();
  } catch (error) {
    console.error("Failed to stop listening for events:", error);
  }
};