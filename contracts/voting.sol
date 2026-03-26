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

    address public admin;
    uint256 public candidatesCount;
    uint256 public startTime;
    uint256 public endTime;
    bool public electionStarted;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    mapping(address => string) public voterNames;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin moi co quyen nay!");
        _;
    }

    modifier onlyDuringElection() {
        require(electionStarted, "Cuoc bau cu chua bat dau!");
        require(block.timestamp >= startTime, "Chua den gio bau cu!");
        require(block.timestamp <= endTime, "Cuoc bau cu da ket thuc!");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionStarted = false;
    }

    // FIX: Cho phép bắt đầu lại nếu cuộc cũ đã kết thúc
    function startElection(uint256 _durationMinutes) public onlyAdmin {
        if (electionStarted) {
            require(block.timestamp > endTime, "Cuoc bau cu hien tai van dang dien ra!");
        }
        
        startTime = block.timestamp;
        endTime = block.timestamp + (_durationMinutes * 1 minutes);
        electionStarted = true;

        // Reset trang thai da bau cua tat ca moi nguoi (Khong the lam tren Blockchain vi ton gas)
        // Thay vao do, chung ta se reset so phieu cua tung ung vien
        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }
    }

    function registerVoter(string memory _name) public {
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
        voterNames[msg.sender] = _name;
    }

    function addCandidate(string memory _name, string memory _imageCID) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
    }

    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung cu vien khong ton tai!");
        candidates[_candidateId].active = false;
    }

    function vote(uint256 _candidateId) public onlyDuringElection {
        require(!hasVoted[msg.sender], "Ban da bau chon roi!");
        require(candidates[_candidateId].active, "Ung cu vien nay da bi go bo!");

        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
    }

    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}