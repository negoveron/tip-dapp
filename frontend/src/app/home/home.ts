import { Component, OnInit, computed, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TipJarService } from '../services/tip-jar.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit{
  balance = '0';
  message: string = '';
  amount: number = 0;
  notificacion: string = '';
  
  private tipJarService = inject(TipJarService);
  
  account = computed(() => this.tipJarService.currentAccount());
  public esOwner: boolean = false;
  
  constructor() {}

  ngOnInit(): void {
    this.init(true);
  }

  async init(conectar: boolean) {
    if(conectar){
      try {
        await this.tipJarService.connect();
        this.balance = await this.tipJarService.getBalance();
      } catch (e) {        
        console.error(e);
      }
    } else {
      try {
        await this.tipJarService.disconnectWallet();
        this.balance = '0';
      } catch (e) {
        console.error(e);
      }
    }
    this.notificacion = this.tipJarService.message();
    await this.verificarSiEsOwner()
  }

  async darTip() {
    try {
      const message = this.message == '' ? '¡Gracias por tu servicio!!' : this.message;
      await this.tipJarService.sendTip(message, this.amount.toString());
      this.balance = await this.tipJarService.getBalance();
      this.notificacion = this.tipJarService.message();
    } catch (e) {
      console.error(e);
    }
  }

  puedeEnviarTip():boolean  {
    const validAmount = this.amount > 0;
    const hasAccount = this.account() !== '';
    return hasAccount && validAmount;    
  }

  async verificarSiEsOwner() {
    const owner = await this.tipJarService.getOwner();
    this.esOwner = this.account().toUpperCase() === owner.toUpperCase();    
  }

  async retirarSaldo(){
    try {      
      const trx = await this.tipJarService.withdraw();
      this.balance = await this.tipJarService.getBalance();
      this.notificacion = this.tipJarService.message();
      console.log(trx);
      
    } catch (e) {
      console.error(e);
    }
  }

}
