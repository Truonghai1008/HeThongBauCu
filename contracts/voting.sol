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

    // Cấu trúc lưu thông tin phiếu bầu để tạo danh sách Hash
    struct VoteRecord {
        address voter;
        uint256 candidateId;
        uint256 timestamp;
        uint256 round;
    }

    address public admin;
    uint256 public candidatesCount;
    uint256 public startTime;
    uint256 public endTime;
    bool public electionStarted;
    uint256 public electionRound; // Theo dõi đợt bầu cử hiện tại

    mapping(uint256 => Candidate) public candidates;
    mapping(address => uint256) public lastVotedRound; // Lưu số đợt mà ví đã bầu
    mapping(address => string) public voterNames;
    
    // Mảng lưu lịch sử tất cả các phiếu bầu từ trước đến nay
    VoteRecord[] public voteHistory;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi danh cho Admin!");
        _;
    }

    modifier onlyDuringElection() {
        require(electionStarted, "Cuoc bau cu chua bat dau!");
        require(block.timestamp >= startTime, "Chua den thoi gian bau cu!");
        require(block.timestamp <= endTime, "Thoi gian bau cu da ket thuc!");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionRound = 0;
        electionStarted = false;
    }

    // Hàm bắt đầu đợt bầu cử mới
    function startElection(uint256 _durationMinutes) public onlyAdmin {
        if (electionStarted) {
            require(block.timestamp > endTime, "Dot bau cu hien tai chua ket thuc!");
        }
        
        electionRound++; // Tăng đợt bầu cử để reset lượt bầu của mọi người
        startTime = block.timestamp;
        endTime = block.timestamp + (_durationMinutes * 1 minutes);
        electionStarted = true;

        // Reset số phiếu của các ứng viên hiện có về 0 cho đợt mới
        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }
    }

    // --- HÀM MỚI THÊM: Dừng cuộc bầu cử ngay lập tức ---
    function endElection() public onlyAdmin {
        require(electionStarted, "Cuoc bau cu chua duoc bat dau!");
        electionStarted = false;
        endTime = block.timestamp; // Chốt thời gian kết thúc là bây giờ
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
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung vien khong ton tai!");
        candidates[_candidateId].active = false;
    }

    function vote(uint256 _candidateId) public onlyDuringElection {
        // Kiểm tra ví đã bầu ở đợt này chưa
        require(lastVotedRound[msg.sender] < electionRound, "Ban da thuc hien bau chon trong dot nay roi!");
        require(candidates[_candidateId].active, "Ung vien nay da bi xoa!");

        lastVotedRound[msg.sender] = electionRound;
        candidates[_candidateId].voteCount++;

        // Lưu bản ghi vào lịch sử
        voteHistory.push(VoteRecord(msg.sender, _candidateId, block.timestamp, electionRound));
    }

    // Lấy dữ liệu ứng viên cho Frontend
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }

    // Lấy tổng số phiếu bầu đã thực hiện trong lịch sử
    function getVoteHistoryCount() public view returns (uint256) {
        return voteHistory.length;
    }
    // Hàm cập nhật thông tin ứng viên
    function updateCandidate(uint256 _id, string memory _newName, string memory _newImageCID) public onlyAdmin {
    require(_id > 0 && _id <= candidatesCount, "Ung vien khong ton tai!");
    require(candidates[_id].active, "Ung vien nay da bi xoa!");
    require(bytes(_newName).length > 0, "Ten khong duoc de trong!");

    candidates[_id].name = _newName;
    candidates[_id].imageCID = _newImageCID;
}
}
