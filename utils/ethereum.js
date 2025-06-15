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
