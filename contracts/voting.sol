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
        require(msg.sender == admin, "Chỉ Admin mới có quyền này!");
        _;
    }

    modifier onlyDuringElection() {
        require(electionStarted, "Cuộc bầu cử chưa bắt đầu!");
        require(block.timestamp >= startTime, "Chưa đến giờ!");
        require(block.timestamp <= endTime, "Đã kết thúc !");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionRound = 0;
        electionStarted = false;
    }

    function startElection(uint256 _durationMinutes) public onlyAdmin {
        if (electionStarted) {
            require(block.timestamp > endTime, "Đợt bầu cử hiện tại chưa kết thúc!");
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
        require(bytes(_name).length > 0, "Tên không được để trống!");
        voterNames[msg.sender] = _name;
    }

    function addCandidate(string memory _name, string memory _imageCID) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
    }

    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Không tồn tại!");
        candidates[_candidateId].active = false;
    }

    function vote(uint256 _candidateId) public onlyDuringElection {
        require(lastVotedRound[msg.sender] < electionRound, "Bạn đã bầu ở đợt này rồi!");
        require(candidates[_candidateId].active, "Ứng cử viên đã bị xóa!");

        lastVotedRound[msg.sender] = electionRound;
        candidates[_candidateId].voteCount++;
    }

    // Hàm này giúp app.js lấy dữ liệu ứng viên (quan trọng)
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}