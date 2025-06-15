import { Injectable, signal } from '@angular/core';
import detectEthereumProvider from '@metamask/detect-provider';
import { ethers } from 'ethers';
import { environment } from '../../environments/environment';
import * as contract  from '../../assets/abis/TipJar.json';

const CONTRACT_ADDRESS = environment.contractAddress;
const CONTRACT_ABI = contract.abi;

declare global {
  interface Window {
    ethereum?: any;
  }
}


@Injectable({
  providedIn: 'root'
})
export class TipJarService {
  private provider!: ethers.BrowserProvider;
  private signer!: ethers.JsonRpcSigner;
  private contract!: ethers.Contract;
  public currentAccount = signal('')
  public message = signal('');

  // Verifica si MetaMask está instalado
  private isMetaMaskInstalled(): boolean {    
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  }

  // Inicializa proveedor, signer y contrato
  private async initContract(withSigner = false): Promise<void> {
    const ethProvider: any = await detectEthereumProvider();

    if (!ethProvider) throw new Error('MetaMask no está instalada');

    this.provider = new ethers.BrowserProvider(ethProvider);

    if (withSigner) {
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
    } else {
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
    }
  }

  // Conecta con la wallet y verifica red
  public async connect(): Promise<void> {
    if (!this.isMetaMaskInstalled()) {
      this.message.set('MetaMask no está instalada.');
      throw new Error('MetaMask no está instalada.');
    }

    const isSepolia = await this.checkNetwork();
    if (!isSepolia) {
      await this.switchToSepolia();
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });      
      this.currentAccount.set(accounts[0]);
      this.message.set("La wallet se ha conectado correctamente")     
    } catch (error) {
      this.message.set("No se ha conectado la wallet")     
    }
        

    await this.initContract(true);
  }

  // Verifica si estamos en la red Sepolia
  private async checkNetwork(): Promise<boolean> {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === '0xaa36a7'; // Sepolia
  }

  // Cambia (o agrega) la red Sepolia en MetaMask
  private async switchToSepolia(): Promise<void> {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia Testnet',
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: ['https://sepolia.infura.io/v3/'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/']
          }]
        });
      } else {
        throw new Error(`No se pudo cambiar a la red Sepolia: ${error.message}`);
      }
    }
  }

  // Envía un tip con mensaje
  public async sendTip(message: string, amount: string): Promise<any> {
    if (!message.trim()) throw new Error('El mensaje no puede estar vacío.');
    if (!amount || parseFloat(amount) <= 0) throw new Error('El monto debe ser mayor a 0.');

    await this.initContract(true);
        
    const weiAmount = ethers.parseEther(amount);
        
    const tx = await this.contract['tip'](message, {
      value: weiAmount
    });
        
    const receipt = await tx.wait();
    
    this.message.set("Se ha enviado la propina correctamente")
        
    return { hash: tx.hash, receipt, success: true };
  }

  // Obtiene el propietario del contrato
  public async getOwner(): Promise<string> {
    await this.initContract();
    return await this.contract['owner']();
  }

  // Obtiene el balance del contrato en ETH
  public async getBalance(): Promise<string> {
    await this.initContract();
    const balanceWei = await this.contract['getBalance']();
    return ethers.formatEther(balanceWei);
  }

  // Obtiene el número total de tips
  public async getTotalTips(): Promise<number> {
    await this.initContract();
    const totalTips = await this.contract['getTotalTips']();
    return Number(totalTips);
  }

  // Retira fondos (solo owner)
  public async withdraw(): Promise<any> {
    await this.initContract(true);

    const owner = await this.contract['owner']();
    const signerAddress = await this.signer.getAddress();

    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error('Solo el propietario puede retirar los fondos.');
    }

    const tx = await this.contract['withdraw']();
    const receipt = await tx.wait();
    this.message.set("Se ha realizado el retiro correctamente");
    return { hash: tx.hash, receipt, success: true };
  }

  // Disconnect wallet
  // This function disconnects the wallet by clearing permissions and notifying the user
  public async disconnectWallet(): Promise<void> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error("MetaMask is not installed");
    }

    try {       
      // Clear the permissions (this will prompt user to reconnect next time)
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [
          {
            eth_accounts: {}
          }
        ]
      });
      this.currentAccount.set('');
      this.message.set("La wallet se ha desconectado correctamente");    
      console.log("Wallet disconnected successfully");
    } catch (error: any) {
      this.message.set("Error al desconectar la wallet")      
      // If wallet_revokePermissions is not supported, we can't fully disconnect
      // but we can still clean up our event listeners
      throw new Error(`Failed to disconnect wallet: ${error.message}`);      
    }
  };
}
