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
    uint256 public electionRound; // Theo dõi đợt bầu cử

    mapping(uint256 => Candidate) public candidates;
    mapping(address => uint256) public lastVotedRound; // Lưu đợt mà ví đã bầu
    mapping(address => string) public voterNames;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin moi co quyen nay!");
        _;
    }

    modifier onlyDuringElection() {
        require(electionStarted, "Cuoc bau cu chua bat dau!");
        require(block.timestamp >= startTime, "Chua den gio!");
        require(block.timestamp <= endTime, "Da ket thuc!");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionRound = 0;
        electionStarted = false;
    }

    function startElection(uint256 _durationMinutes) public onlyAdmin {
        if (electionStarted) {
            require(block.timestamp > endTime, "Dot bau cu hien tai chua ket thuc!");
        }
        
        electionRound++; // Tăng đợt bầu cử để reset lượt bầu của mọi người
        startTime = block.timestamp;
        endTime = block.timestamp + (_durationMinutes * 1 minutes);
        electionStarted = true;

        // Reset phiếu của các ứng viên hiện có về 0 cho đợt mới
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
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Khong ton tai!");
        candidates[_candidateId].active = false;
    }

    function vote(uint256 _candidateId) public onlyDuringElection {
        require(lastVotedRound[msg.sender] < electionRound, "Ban da bau o dot nay roi!");
        require(candidates[_candidateId].active, "Ung vien da bi xoa!");

        lastVotedRound[msg.sender] = electionRound;
        candidates[_candidateId].voteCount++;
    }

    // Hàm này giúp app.js lấy dữ liệu ứng viên (quan trọng)
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}