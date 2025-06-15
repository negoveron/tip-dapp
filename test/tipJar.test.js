const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("TipJar", function () {
  let TipJar;
  let tipJar;
  let owner;
  let addr1;    

  beforeEach(async function () {
    // Obtener las cuentas de prueba
    [owner, addr1] = await ethers.getSigners();

    // Desplegar el contrato antes de cada test
    TipJar = await ethers.getContractFactory("TipJar");
    tipJar = (await TipJar.deploy());
    await tipJar.waitForDeployment();
  });

  describe("Tip functionality", function () {
    it("Should receive tips and emit NewTip event", async function () {
      const tipAmount = ethers.parseEther("1.0");
      const message = "¡Gracias por el excelente trabajo!";

      // Verificar que el evento se emite correctamente
      await expect(
        tipJar.connect(addr1).tip(message, { value: tipAmount })
      )
        .to.emit(tipJar, "NewTip")
        .withArgs(addr1.address, tipAmount, message);

      // Verificar que el balance se actualizó
      expect(await tipJar.getBalance()).to.equal(tipAmount);

      // Verificar que el contador se incrementó
      expect(await tipJar.getTotalTips()).to.equal(1);

      // Verificar que la propina se guardó correctamente
      const [from, amount, storedMessage, timestamp] = await tipJar.getTip(1);
      expect(from).to.equal(addr1.address);
      expect(amount).to.equal(tipAmount);
      expect(storedMessage).to.equal(message);
      expect(timestamp).to.be.greaterThan(0);
    });
   
  });

 
  describe("Withdraw functionality", function () {
    beforeEach(async function () {
      // Agregar algunas propinas antes de los tests de withdraw
      const tipAmount = ethers.parseEther("2.0");
      await tipJar.connect(addr1).tip("Test tip", { value: tipAmount });
    });

    it("Should allow only owner to withdraw", async function () {
      const initialBalance = await tipJar.getBalance();
      expect(initialBalance).to.be.greaterThan(0);

      // El owner debería poder retirar
      await expect(tipJar.connect(owner).withdraw())
        .to.emit(tipJar, "Withdrawal")
        .withArgs(owner.address, initialBalance);

      // Verificar que el balance es cero después del retiro
      expect(await tipJar.getBalance()).to.equal(0);
    });    
  });

  describe("Balance updates", function () {
    it("Should update balance correctly with single tip", async function () {
      const initialBalance = await tipJar.getBalance();
      const tipAmount = ethers.parseEther("1.5");

      expect(initialBalance).to.equal(0);

      await tipJar.connect(addr1).tip("Test tip", { value: tipAmount });

      const newBalance = await tipJar.getBalance();
      expect(newBalance).to.equal(tipAmount);
      expect(newBalance).to.equal(initialBalance + tipAmount);
    }); 
    
  });

});