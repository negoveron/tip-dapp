// SPDX-License-Identifier: MIT
//Guillermo Verón
pragma solidity ^0.8.28;

contract TipJar {
    // Variable pública para el owner del contrato
    address public owner;
    
    // Contador para el ID de las propinas
    uint256 private tipCounter;
    
    // Estructura para almacenar información de cada propina
    struct Tip {
        address from;
        uint256 amount;
        string message;
        uint256 timestamp;
    }
    
    // Mapping para guardar todas las propinas por ID
    mapping(uint256 => Tip) public tips;
    
    // Mapping para obtener las propinas de un usuario específico
    mapping(address => uint256[]) public userTips;
    
    // Evento que se emite cuando se recibe una nueva propina
    event NewTip(address indexed from, uint256 amount, string message);
    
    // Evento que se emite cuando el owner retira fondos
    event Withdrawal(address indexed owner, uint256 amount);
    
    // Modificador para restringir acceso solo al owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Solo el owner puede ejecutar esta funcion");
        _;
    }
    
    // Constructor que establece el deployer como owner
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Función para enviar propinas con mensaje
     * @param message Mensaje que acompaña la propina
     */
    function tip(string memory message) public payable {
        require(msg.value > 0, "La propina debe ser mayor a 0");
        require(bytes(message).length > 0, "El mensaje no puede estar vacio");
        
        // Incrementar contador
        tipCounter++;
        
        // Guardar la propina en el mapping
        tips[tipCounter] = Tip({
            from: msg.sender,
            amount: msg.value,
            message: message,
            timestamp: block.timestamp
        });
        
        // Agregar el ID de la propina al array del usuario
        userTips[msg.sender].push(tipCounter);
        
        // Emitir evento
        emit NewTip(msg.sender, msg.value, message);
    }
    
    /**
     * @dev Función para que el owner retire todos los fondos
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay fondos para retirar");
        
        // Transferir todos los fondos al owner
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Fallo en la transferencia");
        
        emit Withdrawal(owner, balance);
    }
    
    /**
     * @dev Función para obtener el balance actual del contrato
     * @return El balance en wei
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Función para obtener el número total de propinas recibidas
     * @return Número total de propinas
     */
    function getTotalTips() public view returns (uint256) {
        return tipCounter;
    }
    
    /**
     * @dev Funcion para obtener una propina especifica por ID
     * @param tipId ID de la propina
     * @return from Dirección de quien envió la propina
     * @return amount Cantidad de Ether enviada en wei
     * @return message Mensaje que acompaña la propina
     * @return timestamp Momento en que se envió la propina
     */
    function getTip(uint256 tipId) public view returns (
        address from,
        uint256 amount,
        string memory message,
        uint256 timestamp
    ) {
        require(tipId > 0 && tipId <= tipCounter, "ID de propina invalido");
        
        Tip memory tipData = tips[tipId];
        return (tipData.from, tipData.amount, tipData.message, tipData.timestamp);
    }
    
    /**
     * @dev Función para obtener todos los IDs de propinas de un usuario
     * @param user Dirección del usuario
     * @return Array con los IDs de las propinas del usuario
     */
    function getUserTipIds(address user) public view returns (uint256[] memory) {
        return userTips[user];
    }
    
    /**
     * @dev Función para obtener las últimas N propinas
     * @param count Número de propinas a obtener
     * @return from Array de direcciones de los remitentes
     * @return amounts Array de cantidades enviadas en wei
     * @return messages Array de mensajes de las propinas
     * @return timestamps Array de timestamps de las propinas
     */
    function getLatestTips(uint256 count) public view returns (
        address[] memory from,
        uint256[] memory amounts,
        string[] memory messages,
        uint256[] memory timestamps
    ) {
        require(count > 0, "El count debe ser mayor a 0");
        
        uint256 actualCount = count > tipCounter ? tipCounter : count;
        
        from = new address[](actualCount);
        amounts = new uint256[](actualCount);
        messages = new string[](actualCount);
        timestamps = new uint256[](actualCount);
        
        for (uint256 i = 0; i < actualCount; i++) {
            uint256 tipId = tipCounter - i;
            Tip memory tipData = tips[tipId];
            
            from[i] = tipData.from;
            amounts[i] = tipData.amount;
            messages[i] = tipData.message;
            timestamps[i] = tipData.timestamp;
        }
    }
    
    /**
     * @dev Función para cambiar el owner del contrato
     * @param newOwner Nueva dirección del owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "El nuevo owner no puede ser la direccion cero");
        require(newOwner != owner, "El nuevo owner debe ser diferente al actual");
        
        owner = newOwner;
    }
    
    // Función fallback para recibir Ether sin mensaje
    receive() external payable {
        tip("Propina sin mensaje");
    }
}