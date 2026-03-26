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

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    mapping(address => string) public voterNames;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin moi co quyen nay!");
        _;
    }

    modifier onlyDuringElection() {
        require(block.timestamp >= startTime, "Cuoc bau cu chua bat dau!");
        require(block.timestamp <= endTime, "Cuoc bau cu da ket thuc!");
        _;
    }

    constructor() {
        admin = msg.sender;
        startTime = block.timestamp; 
        endTime = block.timestamp + (2 * 1 minutes);
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
        require(_candidateId > 0 && _candidateId <= candidatesCount, "ID khong hop le!");
        require(candidates[_candidateId].active, "Ung cu vien nay da bi go bo!");

        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
    }

    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}