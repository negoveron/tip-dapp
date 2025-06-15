const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("TipJar", function () {
  let TipJar;
  let tipJar;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Obtener las cuentas de prueba
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Desplegar el contrato antes de cada test
    TipJar = await ethers.getContractFactory("TipJar");
    tipJar = (await TipJar.deploy());
    await tipJar.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await tipJar.owner()).to.equal(owner.address);
    });

    it("Should start with zero balance", async function () {
      expect(await tipJar.getBalance()).to.equal(0);
    });

    it("Should start with zero tips", async function () {
      expect(await tipJar.getTotalTips()).to.equal(0);
    });
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

    it("Should handle multiple tips correctly", async function () {
      const tipAmount1 = ethers.parseEther("0.5");
      const tipAmount2 = ethers.parseEther("1.5");
      const message1 = "Primera propina";
      const message2 = "Segunda propina";

      // Primera propina
      await tipJar.connect(addr1).tip(message1, { value: tipAmount1 });
      
      // Segunda propina
      await tipJar.connect(addr2).tip(message2, { value: tipAmount2 });

      // Verificar balance total
      const totalAmount = tipAmount1 + tipAmount2;
      expect(await tipJar.getBalance()).to.equal(totalAmount);

      // Verificar contador total
      expect(await tipJar.getTotalTips()).to.equal(2);

      // Verificar que ambas propinas se guardaron
      const [from1, amount1, msg1] = await tipJar.getTip(1);
      const [from2, amount2, msg2] = await tipJar.getTip(2);

      expect(from1).to.equal(addr1.address);
      expect(amount1).to.equal(tipAmount1);
      expect(msg1).to.equal(message1);

      expect(from2).to.equal(addr2.address);
      expect(amount2).to.equal(tipAmount2);
      expect(msg2).to.equal(message2);
    });

    it("Should reject tips with zero value", async function () {
      await expect(
        tipJar.connect(addr1).tip("Test message", { value: 0 })
      ).to.be.revertedWith("La propina debe ser mayor a 0");
    });

    it("Should reject tips with empty message", async function () {
      const tipAmount = ethers.parseEther("1.0");
      
      await expect(
        tipJar.connect(addr1).tip("", { value: tipAmount })
      ).to.be.revertedWith("El mensaje no puede estar vacio");
    });

    it("Should track user tips correctly", async function () {
      const tipAmount = ethers.parseEther("0.1");
      
      // addr1 envía 2 propinas
      await tipJar.connect(addr1).tip("Propina 1", { value: tipAmount });
      await tipJar.connect(addr1).tip("Propina 2", { value: tipAmount });
      
      // addr2 envía 1 propina
      await tipJar.connect(addr2).tip("Propina 3", { value: tipAmount });

      // Verificar IDs de propinas por usuario
      const addr1Tips = await tipJar.getUserTipIds(addr1.address);
      const addr2Tips = await tipJar.getUserTipIds(addr2.address);

      expect(addr1Tips.length).to.equal(2);
      expect(addr1Tips[0]).to.equal(1);
      expect(addr1Tips[1]).to.equal(2);

      expect(addr2Tips.length).to.equal(1);
      expect(addr2Tips[0]).to.equal(3);
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

    it("Should reject withdraw from non-owner", async function () {
      // addr1 no debería poder retirar
      await expect(
        tipJar.connect(addr1).withdraw()
      ).to.be.revertedWith("Solo el owner puede ejecutar esta funcion");

      // addr2 tampoco debería poder retirar
      await expect(
        tipJar.connect(addr2).withdraw()
      ).to.be.revertedWith("Solo el owner puede ejecutar esta funcion");
    });

    it("Should reject withdraw when balance is zero", async function () {
      // Primero retirar todo
      await tipJar.connect(owner).withdraw();
      
      // Intentar retirar de nuevo debería fallar
      await expect(
        tipJar.connect(owner).withdraw()
      ).to.be.revertedWith("No hay fondos para retirar");
    });

    it("Should transfer correct amount to owner", async function () {
      const contractBalance = await tipJar.getBalance();
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      // Realizar el retiro
      const tx = await tipJar.connect(owner).withdraw();
      const receipt = await tx.wait();
      
      // Calcular gas usado
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // El owner debería recibir el balance del contrato menos el gas
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore + contractBalance - gasUsed
      );
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

    it("Should accumulate balance with multiple tips", async function () {
      const tip1 = ethers.parseEther("0.5");
      const tip2 = ethers.parseEther("1.0");
      const tip3 = ethers.parseEther("2.5");

      // Primera propina
      await tipJar.connect(addr1).tip("Tip 1", { value: tip1 });
      expect(await tipJar.getBalance()).to.equal(tip1);

      // Segunda propina
      await tipJar.connect(addr2).tip("Tip 2", { value: tip2 });
      expect(await tipJar.getBalance()).to.equal(tip1 + tip2);

      // Tercera propina
      await tipJar.connect(addr1).tip("Tip 3", { value: tip3 });
      expect(await tipJar.getBalance()).to.equal(tip1 + tip2 + tip3);
    });

    it("Should reset balance to zero after withdraw", async function () {
      const tipAmount = ethers.parseEther("3.0");
      
      // Agregar propina
      await tipJar.connect(addr1).tip("Test tip", { value: tipAmount });
      expect(await tipJar.getBalance()).to.equal(tipAmount);

      // Retirar fondos
      await tipJar.connect(owner).withdraw();
      expect(await tipJar.getBalance()).to.equal(0);
    });

    it("Should handle balance correctly with tips after withdraw", async function () {
      const firstTip = ethers.parseEther("1.0");
      const secondTip = ethers.parseEther("0.5");

      // Primera propina
      await tipJar.connect(addr1).tip("First tip", { value: firstTip });
      expect(await tipJar.getBalance()).to.equal(firstTip);

      // Retirar
      await tipJar.connect(owner).withdraw();
      expect(await tipJar.getBalance()).to.equal(0);

      // Nueva propina después del retiro
      await tipJar.connect(addr2).tip("Second tip", { value: secondTip });
      expect(await tipJar.getBalance()).to.equal(secondTip);
    });
  });

  describe("Query functions", function () {
    beforeEach(async function () {
      // Crear algunas propinas para los tests de consulta
      await tipJar.connect(addr1).tip("Tip 1", { value: ethers.parseEther("1.0") });
      await tipJar.connect(addr2).tip("Tip 2", { value: ethers.parseEther("2.0") });
      await tipJar.connect(addr1).tip("Tip 3", { value: ethers.parseEther("0.5") });
    });

    it("Should get latest tips correctly", async function () {
      const [from, amounts, messages, timestamps] = await tipJar.getLatestTips(2);

      expect(from.length).to.equal(2);
      expect(amounts.length).to.equal(2);
      expect(messages.length).to.equal(2);
      expect(timestamps.length).to.equal(2);

      // Debería retornar las últimas 2 propinas en orden inverso
      expect(from[0]).to.equal(addr1.address); // Tip 3 (más reciente)
      expect(amounts[0]).to.equal(ethers.parseEther("0.5"));
      expect(messages[0]).to.equal("Tip 3");

      expect(from[1]).to.equal(addr2.address); // Tip 2
      expect(amounts[1]).to.equal(ethers.parseEther("2.0"));
      expect(messages[1]).to.equal("Tip 2");
    });

    it("Should reject invalid tip IDs", async function () {
      await expect(tipJar.getTip(0)).to.be.revertedWith("ID de propina invalido");
      await expect(tipJar.getTip(4)).to.be.revertedWith("ID de propina invalido");
      await expect(tipJar.getTip(999)).to.be.revertedWith("ID de propina invalido");
    });
  });

  describe("Receive function", function () {
    it("Should accept direct Ether transfers", async function () {
      const sendAmount = ethers.parseEther("1.0");

      // Enviar Ether directamente al contrato
      await expect(
        addr1.sendTransaction({
          to: await tipJar.getAddress(),
          value: sendAmount
        })
      ).to.emit(tipJar, "NewTip")
        .withArgs(addr1.address, sendAmount, "Propina sin mensaje");

      expect(await tipJar.getBalance()).to.equal(sendAmount);
      expect(await tipJar.getTotalTips()).to.equal(1);
    });
  });
});