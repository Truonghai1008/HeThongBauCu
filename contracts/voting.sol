// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DecentralizedVoting {

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
        string imageCID; 
        bool active;     
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        bytes32 secretHash; // Lưu mã băm ẩn danh của phiếu bầu
    }

    address public admin;
    uint256 public candidatesCount;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    mapping(address => string) public voterNames;
    mapping(address => bool) public whiteList; // Danh sách ví đã qua KYC

    event votedEvent(uint256 indexed _candidateId);
    event candidateAdded(uint256 indexed candidateId, string name, string imageCID);
    event candidateDeleted(uint256 indexed candidateId);
    event voterRegistered(address indexed voterAddress, string name);
    event kycApproved(address indexed voterAddress);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin moi co quyen nay!");
        _;
    }

    constructor() {
        admin = msg.sender;
        // Mặc định Admin được vào whitelist
        whiteList[msg.sender] = true;
    }

    // --- CHỨC NĂNG KYC ---

    // Admin phê duyệt ví sau khi kiểm tra CCCD/Sinh viên ngoài đời
    function approveKYC(address _voter) public onlyAdmin {
        whiteList[_voter] = true;
        emit kycApproved(_voter);
    }

    function registerVoter(string memory _name) public {
        require(whiteList[msg.sender], "Vi cua ban chua duoc Admin duyet KYC!");
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
        
        voterNames[msg.sender] = _name;
        voters[msg.sender].isRegistered = true;
        
        emit voterRegistered(msg.sender, _name);
    }

    // --- QUẢN LÝ ỨNG VIÊN ---

    function addCandidate(string memory _name, string memory _imageCID) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
        emit candidateAdded(candidatesCount, _name, _imageCID);
    }

    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung cu vien khong ton tai!");
        candidates[_candidateId].active = false;
        emit candidateDeleted(_candidateId);
    }

    // --- BỎ PHIẾU ẨN DANH ---

    // Nhận thêm _secretHash từ Frontend để tăng tính bảo mật
    function vote(uint256 _candidateId, bytes32 _secretHash) public {
        require(whiteList[msg.sender], "Ban chua duoc duyet KYC!");
        require(voters[msg.sender].isRegistered, "Ban phai dang ky ten truoc!");
        require(!voters[msg.sender].hasVoted, "Ban da bau chon roi!");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung cu vien khong ton tai!");
        require(candidates[_candidateId].active, "Ung cu vien nay da bi go bo!");

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].secretHash = _secretHash; // Lưu dấu vết đã mã hóa
        
        candidates[_candidateId].voteCount++;

        emit votedEvent(_candidateId);
    }

    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}