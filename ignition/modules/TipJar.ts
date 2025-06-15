import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// deploy command
// npx hardhat ignition deploy ignition/modules/TipJar.ts --network <network> --verify
// reset if needed
// npx hardhat ignition deploy ignition/modules/TipJar.ts --network <network> --verify --reset


const TipJar = buildModule("TipJarModule", (m) => {

  const tipJar = m.contract("TipJar");

  return { tipJar };
});

export default TipJar;