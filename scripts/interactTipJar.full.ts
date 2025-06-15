import { ethers } from "ethers";
import { vars } from "hardhat/config";
import tipJarABI from "../artifacts/contracts/TipJar.sol/TipJar.json";


// command to run this script:
// npx hardhat run scripts/interactTipJar.ts --network sepolia
// or
// npx ts-node scripts/interactTipJar.ts

// environment variables required:
// npx hardhat vars set ALCHEMY_API_KEY
// npx hardhat vars set SEPOLIA_PRIVATE_KEY
// npx hardhat vars set ETHERSCAN_API_KEY
const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY");
const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");

// Uncomment and fill these if you prefer to use hardcoded values instead of vars
// const ALCHEMY_API_KEY = "";
// const SEPOLIA_PRIVATE_KEY = "";
// const ETHERSCAN_API_KEY = "";

// Connect to Ethereum provider
const provider = new ethers.JsonRpcProvider(
  `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
);

// Load wallet from private key
const wallet = new ethers.Wallet(SEPOLIA_PRIVATE_KEY, provider);

// Replace with your deployed TipJar contract address
const tipJarAddress = "0x_YOUR_DEPLOYED_TIPJAR_ADDRESS_HERE";

// Create a contract instance
const tipJarContract = new ethers.Contract(
  tipJarAddress,
  tipJarABI.abi,
  wallet
);

// 1. Send a tip with message
async function sendTip() {
  console.log("🎁 Sending a tip...");
  
  const tipAmount = ethers.parseEther("0.01"); // Send 0.01 ETH as tip
  const message = "¡Gracias por el excelente trabajo! 🚀";
  
  try {
    const tipTx = await tipJarContract.tip(message, {
      value: tipAmount,
    });
    
    console.log("📄 Transaction hash:", tipTx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tipTx.wait();
    
    console.log("✅ Tip sent successfully!");
    console.log(`💰 Amount: ${ethers.formatEther(tipAmount)} ETH`);
    console.log(`💬 Message: "${message}"`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Extract event data
    const event = receipt.logs.find(log => {
      try {
        const parsed = tipJarContract.interface.parseLog(log);
        return parsed?.name === "NewTip";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsedEvent = tipJarContract.interface.parseLog(event);
      console.log(`📊 Event emitted - From: ${parsedEvent!.args.from}`);
    }
    
  } catch (error) {
    console.error("❌ Error sending tip:", error);
  }
}

// 2. Check contract balance
async function checkContractBalance() {
  console.log("💳 Checking contract balance...");
  
  try {
    const balance = await tipJarContract.getBalance();
    const totalTips = await tipJarContract.getTotalTips();
    
    console.log(`💰 Current balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`📈 Total tips received: ${totalTips.toString()}`);
    
  } catch (error) {
    console.error("❌ Error checking balance:", error);
  }
}

// 3. Get contract owner
async function getContractOwner() {
  console.log("👑 Fetching contract owner...");
  
  try {
    const owner = await tipJarContract.owner();
    const currentWalletAddress = wallet.address;
    
    console.log(`👑 Contract Owner: ${owner}`);
    console.log(`🔑 Current Wallet: ${currentWalletAddress}`);
    console.log(`🤔 Is current wallet the owner? ${owner.toLowerCase() === currentWalletAddress.toLowerCase()}`);
    
    return owner.toLowerCase() === currentWalletAddress.toLowerCase();
  } catch (error) {
    console.error("❌ Error fetching owner:", error);
    return false;
  }
}

// 4. Withdraw funds (only owner)
async function withdrawFunds() {
  console.log("💸 Attempting to withdraw funds...");
  
  try {
    // First check if current wallet is the owner
    const isOwner = await getContractOwner();
    
    if (!isOwner) {
      console.log("🚫 Only the contract owner can withdraw funds!");
      return;
    }
    
    // Check current balance before withdrawal
    const balanceBefore = await tipJarContract.getBalance();
    
    if (balanceBefore === 0n) {
      console.log("💰 No funds to withdraw!");
      return;
    }
    
    console.log(`💰 Withdrawing ${ethers.formatEther(balanceBefore)} ETH...`);
    
    const withdrawTx = await tipJarContract.withdraw();
    console.log("📄 Transaction hash:", withdrawTx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await withdrawTx.wait();
    
    console.log("✅ Withdrawal successful!");
    console.log(`💰 Amount withdrawn: ${ethers.formatEther(balanceBefore)} ETH`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify balance is now zero
    const balanceAfter = await tipJarContract.getBalance();
    console.log(`💳 New balance: ${ethers.formatEther(balanceAfter)} ETH`);
    
  } catch (error) {
    console.error("❌ Error withdrawing funds:", error);
    
    // Handle specific error cases
    if (error.message.includes("Solo el owner puede ejecutar esta funcion")) {
      console.log("🚫 You are not the contract owner!");
    } else if (error.message.includes("No hay fondos para retirar")) {
      console.log("💰 No funds available to withdraw!");
    }
  }
}

// 5. Get latest tips
async function getLatestTips(count: number = 3) {
  console.log(`📋 Fetching latest ${count} tips...`);
  
  try {
    const totalTips = await tipJarContract.getTotalTips();
    
    if (totalTips === 0n) {
      console.log("📭 No tips found!");
      return;
    }
    
    const actualCount = totalTips < count ? Number(totalTips) : count;
    const [from, amounts, messages, timestamps] = await tipJarContract.getLatestTips(actualCount);
    
    console.log(`📊 Showing latest ${actualCount} tips:`);
    console.log("=".repeat(50));
    
    for (let i = 0; i < from.length; i++) {
      const date = new Date(Number(timestamps[i]) * 1000);
      console.log(`\n🎁 Tip #${actualCount - i}:`);
      console.log(`👤 From: ${from[i]}`);
      console.log(`💰 Amount: ${ethers.formatEther(amounts[i])} ETH`);
      console.log(`💬 Message: "${messages[i]}"`);
      console.log(`📅 Date: ${date.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error("❌ Error fetching tips:", error);
  }
}

// 6. Get user's wallet balance
async function getWalletBalance() {
  console.log("👛 Checking wallet balance...");
  
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`👛 Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
  } catch (error) {
    console.error("❌ Error checking wallet balance:", error);
  }
}

// 7. Send multiple tips (for testing)
async function sendMultipleTips() {
  console.log("🎁 Sending multiple tips for testing...");
  
  const tips = [
    { amount: "0.005", message: "Primera propina de prueba! 🎉" },
    { amount: "0.01", message: "Segunda propina - ¡Excelente trabajo! 💪" },
    { amount: "0.007", message: "Tercera propina - Sigue así! 🚀" }
  ];
  
  for (let i = 0; i < tips.length; i++) {
    try {
      console.log(`\n📤 Sending tip ${i + 1}/${tips.length}...`);
      
      const tipAmount = ethers.parseEther(tips[i].amount);
      const tipTx = await tipJarContract.tip(tips[i].message, {
        value: tipAmount,
      });
      
      await tipTx.wait();
      console.log(`✅ Tip ${i + 1} sent: ${tips[i].amount} ETH`);
      
      // Wait a bit between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error sending tip ${i + 1}:`, error);
    }
  }
}

// Main function with interactive menu
async function main() {
  console.log("🏦 TipJar Contract Interaction Script");
  console.log("=====================================");
  console.log(`🔗 Contract Address: ${tipJarAddress}`);
  console.log(`👤 Wallet Address: ${wallet.address}`);
  
  try {
    // Show current status
    await getWalletBalance();
    await checkContractBalance();
    console.log("\n" + "=".repeat(50) + "\n");
    
    // Uncomment the functions you want to execute:
    
    // 1. Send a single tip
    await sendTip();
    
    // 2. Send multiple tips (for testing)
    // await sendMultipleTips();
    
    // 3. Check balance after tip
    await checkContractBalance();
    
    // 4. Get latest tips
    await getLatestTips(5);
    
    // 5. Check if current wallet is owner and withdraw (if owner)
    await withdrawFunds();
    
    // 6. Final balance check
    await checkContractBalance();
    
  } catch (error) {
    console.error("💥 Script execution error:", error);
  }
}

// Run the main function
main()
  .then(() => {
    console.log("\n✨ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });